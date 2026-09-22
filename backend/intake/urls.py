from rest_framework.routers import DefaultRouter

from .views import WorkRequestViewSet

router = DefaultRouter()
router.register(r"requests", WorkRequestViewSet, basename="work-request")

urlpatterns = router.urls

