from django.contrib.auth import get_user_model
from django.db.models import Q
from django.db import transaction
from django.utils import timezone
from django.shortcuts import get_object_or_404
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.exceptions import PermissionDenied
from .access import is_admin, visible_items, can_edit
from .services import record_activity, record_changes
from .models import SubWork
from .serializers import SubWorkSerializer, WorkCommentSerializer, WorkActivitySerializer, WorkLinkSerializer
from rest_framework import mixins, viewsets
from rest_framework.exceptions import ValidationError

from .models import WorkItem, Workspace
from .serializers import (
    WorkItemSerializer,
    WorkspaceCreateSerializer,
    WorkspaceSerializer,
    WorkspaceSummarySerializer,
    WorkspaceUpdateSerializer,
    WorkUserSerializer,
)

User = get_user_model()


class WorkspaceViewSet(
    mixins.CreateModelMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    viewsets.GenericViewSet,
):
    lookup_field = "slug"
    queryset = Workspace.objects.all()

    def get_queryset(self):
        queryset = super().get_queryset()
        if is_admin(self.request.user):
            if self.action == "list" and self.request.query_params.get("include_archived") != "true":
                return queryset.filter(archived=False)
            return queryset
        return queryset.filter(archived=False)

    def get_serializer_class(self):
        if self.action == "create":
            return WorkspaceCreateSerializer
        if self.action in ("update", "partial_update"):
            return WorkspaceUpdateSerializer
        if self.action == "list":
            return WorkspaceSummarySerializer
        return WorkspaceSerializer

    def require_admin(self):
        if not is_admin(self.request.user):
            raise PermissionDenied("Only administrators can manage workspaces.")

    def create(self, request, *args, **kwargs):
        self.require_admin()
        response = super().create(request, *args, **kwargs)
        workspace = Workspace.objects.get(pk=response.data["id"])
        response.data = WorkspaceSummarySerializer(workspace).data
        return response

    def update(self, request, *args, **kwargs):
        self.require_admin()
        return super().update(request, *args, **kwargs)

    @action(detail=True, methods=["post"])
    @transaction.atomic
    def archive(self, request, slug=None):
        self.require_admin()
        workspace = Workspace.objects.select_for_update().get(pk=self.get_object().pk)
        workspace.archived = True
        workspace.save(update_fields=("archived", "updated_at"))
        return Response(WorkspaceSummarySerializer(workspace).data)

    @action(detail=True, methods=["post"])
    @transaction.atomic
    def restore(self, request, slug=None):
        self.require_admin()
        workspace = Workspace.objects.select_for_update().get(pk=self.get_object().pk)
        workspace.archived = False
        workspace.save(update_fields=("archived", "updated_at"))
        return Response(WorkspaceSummarySerializer(workspace).data)

    @action(detail=False, methods=["post"])
    @transaction.atomic
    def reorder(self, request):
        self.require_admin()
        workspace_ids = request.data.get("workspace_ids")
        if not isinstance(workspace_ids, list) or any(type(value) is not int for value in workspace_ids):
            raise ValidationError({"workspace_ids": "Provide an ordered list of workspace IDs."})
        if len(workspace_ids) != len(set(workspace_ids)):
            raise ValidationError({"workspace_ids": "Each active workspace must appear once."})

        workspaces = list(Workspace.objects.select_for_update().filter(archived=False))
        if set(workspace_ids) != {workspace.pk for workspace in workspaces}:
            raise ValidationError({"workspace_ids": "Include every active workspace exactly once."})
        by_id = {workspace.pk: workspace for workspace in workspaces}
        now = timezone.now()
        ordered = []
        for index, workspace_id in enumerate(workspace_ids, start=1):
            workspace = by_id[workspace_id]
            workspace.display_order = index
            workspace.updated_at = now
            ordered.append(workspace)
        Workspace.objects.bulk_update(ordered, ("display_order", "updated_at"))
        return Response(WorkspaceSummarySerializer(ordered, many=True).data)


class WorkItemViewSet(
    mixins.CreateModelMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    viewsets.GenericViewSet,
):
    serializer_class = WorkItemSerializer
    queryset = WorkItem.objects.select_related(
        "group",
        "group__workspace",
        "owner",
        "reviewer",
        "created_by",
    )

    def get_queryset(self):
        queryset = visible_items(super().get_queryset(), self.request.user)
        params = self.request.query_params
        relevance = params.get("relevance")
        if relevance:
            if relevance != "mine":
                raise ValidationError({"relevance": "Select a valid relevance scope."})
            queryset = queryset.filter(
                group__archived=False,
                group__workspace__archived=False,
            ).filter(Q(owner=self.request.user) | Q(reviewer=self.request.user))

        workspace = params.get("workspace")
        if workspace:
            queryset = queryset.filter(group__workspace__slug=workspace)

        status_value = params.get("status")
        if status_value:
            valid_statuses = {value for value, _ in WorkItem.Status.choices}
            if status_value not in valid_statuses:
                raise ValidationError({"status": "Select a valid status."})
            queryset = queryset.filter(status=status_value)

        priority = params.get("priority")
        if priority:
            valid_priorities = {value for value, _ in WorkItem.Priority.choices}
            if priority not in valid_priorities:
                raise ValidationError({"priority": "Select a valid priority."})
            queryset = queryset.filter(priority=priority)

        owner = params.get("owner")
        if owner:
            try:
                owner_id = int(owner)
            except (TypeError, ValueError):
                raise ValidationError({"owner": "Select a valid owner."})
            queryset = queryset.filter(owner_id=owner_id)

        search = params.get("q", "").strip()
        if search:
            queryset = queryset.filter(
                Q(reference__icontains=search)
                | Q(title__icontains=search)
                | Q(brief__icontains=search)
            )

        return queryset.order_by("-created_at", "-pk")

    @transaction.atomic
    def perform_create(self, serializer):
        if not is_admin(self.request.user):
            raise PermissionDenied("Only administrators can create work items.")
        item = serializer.save(created_by=self.request.user)
        record_activity(item, self.request.user, "created")

    @transaction.atomic
    def update(self, request, *args, **kwargs):
        item = self.locked_item()
        serializer = self.get_serializer(item, data=request.data, partial=kwargs.get("partial", False))
        serializer.is_valid(raise_exception=True)
        before = {field: getattr(item, field) for field in
                  ("title", "brief", "group_id", "status", "priority", "owner_id", "reviewer_id", "due_date")}
        serializer.save()
        record_changes(item, request.user, before)
        return Response(serializer.data)

    def locked_item(self):
        # Lock only the work item, not nullable joined owner/reviewer rows (PostgreSQL).
        visible = self.get_object()
        item = WorkItem.objects.select_for_update().get(pk=visible.pk)
        # Recheck after acquiring the lock in case assignment changed while waiting.
        if not visible_items(WorkItem.objects.filter(pk=item.pk), self.request.user).exists():
            raise PermissionDenied("Your access to this work item has changed.")
        return item

    @action(detail=True, methods=["get", "post"])
    @transaction.atomic
    def comments(self, request, pk=None):
        item = self.get_object()
        if request.method == "POST":
            serializer = WorkCommentSerializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            serializer.save(work_item=item, author=request.user)
            record_activity(item, request.user, "comment_added")
            return Response(serializer.data, status=201)
        return Response(WorkCommentSerializer(item.comments.select_related("author"), many=True).data)

    @action(detail=True, methods=["get"])
    def activity(self, request, pk=None):
        return Response(WorkActivitySerializer(self.get_object().activity.select_related("actor"), many=True).data)

    @action(detail=True, methods=["get", "post"], url_path="sub-work")
    @transaction.atomic
    def sub_work(self, request, pk=None):
        item = self.get_object()
        if request.method == "POST":
            if not is_admin(request.user):
                raise PermissionDenied("Only administrators can create sub-work.")
            serializer = SubWorkSerializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            sub = serializer.save(work_item=item, created_by=request.user)
            record_activity(item, request.user, "sub_work_created", title=sub.title)
            return Response(serializer.data, status=201)
        return Response(SubWorkSerializer(item.sub_work.select_related("assignee"), many=True).data)

    @action(detail=True, methods=["patch"], url_path=r"sub-work/(?P<sub_id>[0-9]+)")
    @transaction.atomic
    def edit_sub_work(self, request, pk=None, sub_id=None):
        item = self.get_object()
        sub = get_object_or_404(SubWork.objects.select_for_update(), work_item=item, pk=sub_id)
        if not is_admin(request.user):
            if sub.assignee_id != request.user.pk or set(request.data) - {"completed"}:
                raise PermissionDenied("You may only complete or reopen your assigned sub-work.")
        before = (sub.title, sub.assignee_id, sub.completed)
        serializer = SubWorkSerializer(sub, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        after = (sub.title, sub.assignee_id, sub.completed)
        if before != after:
            event = ("sub_work_completed" if sub.completed else "sub_work_reopened") if before[2] != after[2] else "sub_work_updated"
            record_activity(item, request.user, event, title=sub.title)
        return Response(serializer.data)

    @action(detail=True, methods=["get", "post"])
    @transaction.atomic
    def links(self, request, pk=None):
        item = self.get_object()
        if request.method == "POST":
            if not can_edit(item, request.user):
                raise PermissionDenied("Only the owner or an administrator can add links.")
            serializer = WorkLinkSerializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            serializer.save(work_item=item, created_by=request.user)
            record_activity(item, request.user, "link_added", label=serializer.instance.label)
            return Response(serializer.data, status=201)
        return Response(WorkLinkSerializer(item.links.all(), many=True).data)

    @action(detail=True, methods=["delete"], url_path=r"links/(?P<link_id>[0-9]+)")
    @transaction.atomic
    def remove_link(self, request, pk=None, link_id=None):
        item = self.get_object()
        if not can_edit(item, request.user):
            raise PermissionDenied("Only the owner or an administrator can remove links.")
        link = get_object_or_404(item.links, pk=link_id)
        record_activity(item, request.user, "link_removed", label=link.label)
        link.delete()
        return Response(status=204)

    @action(detail=True, methods=["post"])
    @transaction.atomic
    def review(self, request, pk=None):
        item = self.locked_item()
        if item.reviewer_id != request.user.pk:
            raise PermissionDenied("Only the assigned reviewer can decide this review.")
        if item.status != "review":
            return Response({"detail": "This work item is not awaiting review."}, status=409)
        decision = request.data.get("decision")
        if decision not in ("approve", "request_changes"):
            raise ValidationError({"decision": "Choose approve or request_changes."})
        note = request.data.get("note", "")
        if not isinstance(note, str) or len(note) > 10000:
            raise ValidationError({"note": "Use a note of at most 10000 characters."})
        if decision == "request_changes" and not note.strip():
            raise ValidationError({"note": "Explain the changes needed."})
        item.status = "done" if decision == "approve" else "in_progress"
        item.save(update_fields=("status", "updated_at"))
        record_activity(item, request.user, "approved" if decision == "approve" else "changes_requested", note=note.strip())
        return Response(self.get_serializer(item).data)


class WorkUserViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = WorkUserSerializer
    queryset = User.objects.filter(is_active=True).order_by("first_name", "last_name", "email")
