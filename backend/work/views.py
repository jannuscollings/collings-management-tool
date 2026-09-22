from django.contrib.auth import get_user_model
from rest_framework import mixins, viewsets

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
        workspace = self.request.query_params.get("workspace")
        if workspace:
            queryset = queryset.filter(group__workspace__slug=workspace)
        return queryset

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class WorkUserViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = WorkUserSerializer
    queryset = User.objects.filter(is_active=True).order_by("first_name", "last_name", "email")

