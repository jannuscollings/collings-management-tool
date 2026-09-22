from rest_framework.routers import DefaultRouter

from .views import WorkItemViewSet, WorkspaceViewSet, WorkUserViewSet

router = DefaultRouter()
router.register(r"workspaces", WorkspaceViewSet, basename="workspace")
router.register(r"work-items", WorkItemViewSet, basename="work-item")
router.register(r"work-users", WorkUserViewSet, basename="work-user")

urlpatterns = router.urls

