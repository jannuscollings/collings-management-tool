"""Admin-only recovery listing; normal work APIs expose active records only."""

from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from rest_framework.views import APIView

from .access import is_admin
from .models import WorkGroup, WorkItem, Workspace


class ArchiveView(APIView):
    def get(self, request):
        if not is_admin(request.user):
            raise PermissionDenied("Only administrators can view the archive.")
        return Response({
            "workspaces": list(Workspace.objects.filter(archived=True).order_by("name", "pk").values(
                "id", "name", "slug")),
            "boards": list(WorkGroup.objects.filter(archived=True).order_by(
                "workspace__name", "name", "pk"
            ).values("id", "name", "workspace__name", "workspace__slug", "workspace__archived")),
            "work_items": list(WorkItem.objects.filter(archived=True).order_by(
                "group__workspace__name", "group__name", "reference", "pk"
            ).values("id", "reference", "title", "group__name", "group__archived",
                     "group__workspace__name", "group__workspace__archived")),
        })
