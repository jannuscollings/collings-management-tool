from django.middleware.csrf import get_token
from django.contrib.auth import get_user_model
from django.db import transaction
from rest_framework import generics, permissions, mixins, viewsets
from rest_framework.decorators import api_view, permission_classes
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from .serializers import RegisterSerializer, UserSerializer, PeopleSerializer

User = get_user_model()


class IsPeopleAdmin(permissions.BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and (request.user.is_staff or request.user.is_superuser))


class PeopleViewSet(mixins.ListModelMixin, mixins.CreateModelMixin,
                    mixins.RetrieveModelMixin, mixins.UpdateModelMixin,
                    viewsets.GenericViewSet):
    serializer_class = PeopleSerializer
    permission_classes = [IsPeopleAdmin]
    queryset = User.objects.all().order_by("first_name", "last_name", "email")

    @transaction.atomic
    def perform_update(self, serializer):
        user = User.objects.select_for_update().get(pk=serializer.instance.pk)
        next_staff = serializer.validated_data.get("is_staff", user.is_staff)
        next_active = serializer.validated_data.get("is_active", user.is_active)
        if user.pk == self.request.user.pk and (not next_staff or not next_active):
            raise ValidationError({"detail": "You cannot remove your own Admin access or deactivate your account."})
        if user.is_superuser and (not next_staff or not next_active):
            raise ValidationError({"detail": "A superuser's role and status are managed outside People."})
        if user.is_active and user.is_staff and (not next_staff or not next_active):
            active_admin_ids = list(User.objects.select_for_update().filter(is_active=True, is_staff=True).values_list("pk", flat=True))
            if len(active_admin_ids) <= 1:
                raise ValidationError({"detail": "Keep at least one active Admin."})
        serializer.instance = user
        serializer.save()


class RegisterView(generics.CreateAPIView):
    serializer_class = RegisterSerializer
    permission_classes = [IsPeopleAdmin]


class MeView(APIView):
    """The current user — the frontend calls this to hydrate auth state."""

    def get(self, request):
        return Response(UserSerializer(request.user).data)


@api_view(["GET"])
@permission_classes([permissions.AllowAny])
def csrf(request):
    """Hand the SPA a CSRF token (frontend fetches /api/auth/csrf/ on boot)."""
    return Response({"csrfToken": get_token(request)})
