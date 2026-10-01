from django.contrib.auth import get_user_model
from django.db.models import Count, Q
from django.db import transaction
from django.utils import timezone
from django.shortcuts import get_object_or_404
from django.core.files.storage import default_storage
from django.http import FileResponse
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.exceptions import NotFound, PermissionDenied
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from .attachments import validate_files
from .access import is_admin, visible_items, can_edit
from .services import record_activity, record_changes
from .notifications import notify, assignment_notifications, comment_notifications
from .due import local_today, due_queryset
from .review import with_latest_review_event
from .models import SubWork, WorkComment, WorkCommentAttachment
from .serializers import SubWorkSerializer, WorkCommentSerializer, WorkActivitySerializer, WorkLinkSerializer
from rest_framework import mixins, viewsets
from rest_framework.exceptions import ValidationError

from .models import WorkGroup, WorkItem, Workspace
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
            if self.action in ("archive", "restore", "archive_board", "restore_board"):
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

    @staticmethod
    def board_data(workspace):
        return list(workspace.groups.filter(archived=False).annotate(
            work_item_count=Count("work_items", distinct=True),
            request_count=Count("routed_work_requests", distinct=True),
        ).order_by("display_order", "name").values("id", "name", "display_order", "work_item_count", "request_count"))

    @action(detail=True, methods=["get", "post"])
    @transaction.atomic
    def boards(self, request, slug=None):
        self.require_admin()
        workspace = Workspace.objects.select_for_update().get(pk=self.get_object().pk)
        if request.method == "GET":
            return Response(self.board_data(workspace))
        if workspace.archived:
            raise ValidationError({"detail": "Restore the workspace before managing boards."})
        name = request.data.get("name")
        if not isinstance(name, str) or not name.strip() or len(name.strip()) > 120:
            raise ValidationError({"name": "Enter a board name of up to 120 characters."})
        name = name.strip()
        if workspace.groups.filter(name__iexact=name).exists():
            raise ValidationError({"name": "A board with this name already exists."})
        highest = workspace.groups.order_by("-display_order").values_list("display_order", flat=True).first()
        WorkGroup.objects.create(workspace=workspace, name=name, display_order=(highest or 0) + 1)
        return Response(self.board_data(workspace), status=201)

    @action(detail=True, methods=["patch", "delete"], url_path=r"boards/(?P<board_id>\d+)")
    @transaction.atomic
    def board(self, request, slug=None, board_id=None):
        self.require_admin()
        workspace = Workspace.objects.select_for_update().get(pk=self.get_object().pk)
        if workspace.archived:
            raise ValidationError({"detail": "Restore the workspace before managing boards."})
        board = get_object_or_404(WorkGroup.objects.select_for_update(), pk=board_id, workspace=workspace, archived=False)
        if request.method == "PATCH":
            name = request.data.get("name")
            if not isinstance(name, str) or not name.strip() or len(name.strip()) > 120:
                raise ValidationError({"name": "Enter a board name of up to 120 characters."})
            name = name.strip()
            if workspace.groups.filter(name__iexact=name).exclude(pk=board.pk).exists():
                raise ValidationError({"name": "A board with this name already exists."})
            board.name = name
            board.save(update_fields=("name",))
            return Response(self.board_data(workspace))
        if board.work_items.exists():
            raise ValidationError({"detail": "This board contains work items. Move them manually before deleting it."})
        if board.routed_work_requests.exists():
            raise ValidationError({"detail": "This board is used by requests and cannot be deleted."})
        if workspace.groups.filter(archived=False).count() == 1:
            raise ValidationError({"detail": "A workspace must keep at least one board."})
        board.delete()
        return Response(self.board_data(workspace))

    @action(detail=True, methods=["post"], url_path=r"boards/(?P<board_id>\d+)/archive")
    @transaction.atomic
    def archive_board(self, request, slug=None, board_id=None):
        self.require_admin()
        workspace = Workspace.objects.select_for_update().get(pk=self.get_object().pk)
        board = get_object_or_404(WorkGroup.objects.select_for_update(), pk=board_id, workspace=workspace)
        if not board.archived:
            board.archived = True
            board.save(update_fields=("archived",))
        return Response({"id": board.pk, "archived": board.archived})

    @action(detail=True, methods=["post"], url_path=r"boards/(?P<board_id>\d+)/restore")
    @transaction.atomic
    def restore_board(self, request, slug=None, board_id=None):
        self.require_admin()
        workspace = Workspace.objects.select_for_update().get(pk=self.get_object().pk)
        board = get_object_or_404(WorkGroup.objects.select_for_update(), pk=board_id, workspace=workspace)
        if board.archived:
            board.archived = False
            board.save(update_fields=("archived",))
        return Response({"id": board.pk, "archived": board.archived})

    @action(detail=True, methods=["post"], url_path="boards/reorder")
    @transaction.atomic
    def reorder_boards(self, request, slug=None):
        self.require_admin()
        workspace = Workspace.objects.select_for_update().get(pk=self.get_object().pk)
        if workspace.archived:
            raise ValidationError({"detail": "Restore the workspace before managing boards."})
        board_ids = request.data.get("board_ids")
        boards = list(workspace.groups.select_for_update().filter(archived=False))
        if (not isinstance(board_ids, list) or any(type(value) is not int for value in board_ids)
                or len(board_ids) != len(set(board_ids))
                or set(board_ids) != {board.pk for board in boards}):
            raise ValidationError({"board_ids": "Include every active board exactly once."})
        by_id = {board.pk: board for board in boards}
        for order, board_id in enumerate(board_ids, start=1):
            by_id[board_id].display_order = order
        WorkGroup.objects.bulk_update(boards, ("display_order",))
        return Response(self.board_data(workspace))

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
    queryset = with_latest_review_event(WorkItem.objects.select_related(
        "group",
        "group__workspace",
        "owner",
        "reviewer",
        "created_by",
    ))

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
            ).filter(
                Q(owner=self.request.user) | Q(reviewer=self.request.user)
                | Q(sub_work__assignee=self.request.user)
            ).distinct()

        due = params.get("due")
        if due:
            queryset = due_queryset(queryset, due, local_today(self.request))

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

    @action(detail=True, methods=["post"])
    @transaction.atomic
    def archive(self, request, pk=None):
        if not is_admin(request.user):
            raise PermissionDenied("Only administrators can archive work items.")
        item = get_object_or_404(WorkItem.objects.select_for_update(), pk=pk)
        if not item.archived:
            item.archived = True
            item.save(update_fields=("archived", "updated_at"))
            record_activity(item, request.user, "archived")
        return Response({"id": item.pk, "archived": item.archived})

    @action(detail=True, methods=["post"])
    @transaction.atomic
    def restore(self, request, pk=None):
        if not is_admin(request.user):
            raise PermissionDenied("Only administrators can restore work items.")
        item = get_object_or_404(WorkItem.objects.select_for_update(), pk=pk)
        if item.archived:
            item.archived = False
            item.save(update_fields=("archived", "updated_at"))
            record_activity(item, request.user, "restored")
        return Response({"id": item.pk, "archived": item.archived})

    @transaction.atomic
    def perform_create(self, serializer):
        if not is_admin(self.request.user):
            raise PermissionDenied("Only administrators can create work items.")
        item = serializer.save(created_by=self.request.user)
        record_activity(item, self.request.user, "created")
        if item.start_date:
            record_activity(item, self.request.user, "start_date_added", before=None, after=str(item.start_date))
        assignment_notifications(item, self.request.user)

    @transaction.atomic
    def update(self, request, *args, **kwargs):
        item = self.locked_item()
        serializer = self.get_serializer(item, data=request.data, partial=kwargs.get("partial", False))
        serializer.is_valid(raise_exception=True)
        before = {field: getattr(item, field) for field in
                  ("title", "brief", "group_id", "status", "priority", "owner_id", "reviewer_id", "start_date", "due_date")}
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

    @action(detail=True, methods=["get", "post"], parser_classes=[JSONParser, MultiPartParser, FormParser])
    def comments(self, request, pk=None):
        if request.method == "POST":
            stored = []
            try:
                with transaction.atomic():
                    item = self.locked_item()
                    files = validate_files(request.FILES.getlist("attachments"))
                    context = {'request': request, 'item': item, 'attachment_count': len(files)}
                    serializer = WorkCommentSerializer(data=request.data, context=context)
                    serializer.is_valid(raise_exception=True)
                    serializer.save(work_item=item, author=request.user, body=serializer.validated_data.get('body', ''))
                    for file, filename, content_type, key in files:
                        name = default_storage.save(key, file)
                        stored.append(name)
                        WorkCommentAttachment.objects.create(comment=serializer.instance, file=name,
                                                             filename=filename, content_type=content_type, size=file.size)
                    comment_notifications(serializer.instance, request.user, reply=True)
                    record_activity(item, request.user, "reply_added" if serializer.instance.parent_id else "comment_added", comment_id=serializer.instance.pk)
            except Exception:
                for name in stored:
                    default_storage.delete(name)
                raise
            return Response(serializer.data, status=201)
        item = self.get_object()
        context = {'request': request, 'item': item}
        return Response(WorkCommentSerializer(item.comments.select_related("author").prefetch_related('mentions', 'attachments'), many=True, context=context).data)

    @action(detail=True, methods=['get'], url_path=r'comments/(?P<comment_id>[0-9]+)/attachments/(?P<attachment_id>[0-9]+)')
    def comment_attachment(self, request, pk=None, comment_id=None, attachment_id=None):
        item = self.get_object()
        attachment = get_object_or_404(WorkCommentAttachment.objects.select_related('comment'),
                                       pk=attachment_id, comment_id=comment_id, comment__work_item=item,
                                       comment__deleted_at__isnull=True)
        try:
            stream = attachment.file.open('rb')
        except (OSError, FileNotFoundError):
            raise NotFound('Attachment is unavailable.')
        response = FileResponse(stream, as_attachment=not attachment.content_type.startswith('image/'),
                                filename=attachment.filename, content_type=attachment.content_type)
        response['X-Content-Type-Options'] = 'nosniff'
        response['Cache-Control'] = 'private, no-store'
        return response

    @action(detail=True, methods=['patch', 'delete'], url_path=r'comments/(?P<comment_id>[0-9]+)')
    @transaction.atomic
    def edit_comment(self, request, pk=None, comment_id=None):
        item = self.locked_item()
        comment = get_object_or_404(WorkComment.objects.select_for_update(), pk=comment_id, work_item=item)
        if comment.author_id != request.user.pk and not is_admin(request.user):
            raise PermissionDenied('Only the author or an administrator can manage this comment.')
        if request.method == 'DELETE':
            if not comment.deleted_at:
                comment.deleted_at = timezone.now()
                comment.body = ''
                comment.save(update_fields=('deleted_at', 'body'))
                comment.mentions.clear()
                record_activity(item, request.user, 'comment_deleted', comment_id=comment.pk)
            return Response(status=204)
        if comment.deleted_at:
            return Response({'detail': 'Deleted comments cannot be edited.'}, status=409)
        serializer = WorkCommentSerializer(comment, data=request.data, partial=True, context={'request': request, 'item': item})
        serializer.is_valid(raise_exception=True)
        before = (comment.body, set(comment.mentions.values_list('pk', flat=True)))
        serializer.save()
        if before != (comment.body, set(comment.mentions.values_list('pk', flat=True))):
            comment.edited_at = timezone.now()
            comment.save(update_fields=('edited_at',))
            record_activity(item, request.user, 'comment_edited', comment_id=comment.pk)
            comment_notifications(comment, request.user, previous_mentions=before[1])
        return Response(serializer.data)

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
            notify(request.user, sub.assignee_id, "sub_work_assigned", item=item)
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
        if before[1] != sub.assignee_id:
            notify(request.user, sub.assignee_id, "sub_work_assigned", item=item)
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
        notify(request.user, item.owner_id, "approved" if decision == "approve" else "changes_requested", item=item)
        return Response(self.get_serializer(item).data)


class WorkUserViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = WorkUserSerializer
    queryset = User.objects.filter(is_active=True).order_by("first_name", "last_name", "email")
