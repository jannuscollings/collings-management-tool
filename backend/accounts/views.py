from django.middleware.csrf import get_token
from rest_framework import generics, permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.views import APIView

from .serializers import RegisterSerializer, UserSerializer


class RegisterView(generics.CreateAPIView):
    serializer_class = RegisterSerializer
    permission_classes = [permissions.AllowAny]


class MeView(APIView):
    """The current user — the frontend calls this to hydrate auth state."""

    def get(self, request):
        return Response(UserSerializer(request.user).data)


@api_view(["GET"])
@permission_classes([permissions.AllowAny])
def csrf(request):
    """Hand the SPA a CSRF token (frontend fetches /api/auth/csrf/ on boot)."""
    return Response({"csrfToken": get_token(request)})
