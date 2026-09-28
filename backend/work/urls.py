from rest_framework.routers import DefaultRouter
from django.urls import path
from .awareness import HomeView, NotificationViewSet

from .views import WorkItemViewSet, WorkspaceViewSet, WorkUserViewSet
from .search import SearchView

router = DefaultRouter()
router.register(r"workspaces", WorkspaceViewSet, basename="workspace")
router.register(r"work-items", WorkItemViewSet, basename="work-item")
router.register(r"work-users", WorkUserViewSet, basename="work-user")

router.register(r"notifications", NotificationViewSet, basename="notification")
urlpatterns = [path("home/", HomeView.as_view(), name="operational-home"),
               path("search/", SearchView.as_view(), name="global-search"), *router.urls]
