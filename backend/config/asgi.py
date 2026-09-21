"""
ASGI entrypoint — HTTP via Django + WebSocket via Channels, from one process
(Daphne), the same shape prod uses.

Add your websocket routes to `websocket_urlpatterns` below.
"""
import os

from channels.auth import AuthMiddlewareStack
from channels.routing import ProtocolTypeRouter, URLRouter
from channels.security.websocket import AllowedHostsOriginValidator
from django.core.asgi import get_asgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

# Initialise Django before importing anything that touches the app registry.
django_asgi_app = get_asgi_application()

websocket_urlpatterns = []  # e.g. path("ws/notifications/", NotificationsConsumer.as_asgi())

application = ProtocolTypeRouter(
    {
        "http": django_asgi_app,
        "websocket": AllowedHostsOriginValidator(
            AuthMiddlewareStack(URLRouter(websocket_urlpatterns))
        ),
    }
)
