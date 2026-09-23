from django.contrib.auth import get_user_model
from django.db.models import Q
from rest_framework import mixins, viewsets
from rest_framework.exceptions import ValidationError

from .models import WorkItem, Workspace
from .serializers import WorkItemSerializer, WorkspaceSerializer, WorkUserSerializer

User = get_user_model()


class WorkspaceViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = WorkspaceSerializer
    lookup_field = "slug"
    queryset = Workspace.objects.filter(archived=False)


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
        queryset = super().get_queryset()
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

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class WorkUserViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = WorkUserSerializer
    queryset = User.objects.filter(is_active=True).order_by("first_name", "last_name", "email")
