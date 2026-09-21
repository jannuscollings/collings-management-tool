from rest_framework import viewsets

from .models import Ticket
from .serializers import TicketSerializer


class TicketViewSet(viewsets.ModelViewSet):
    """CRUD for tickets. Authenticated users see all tickets; the creator is
    stamped from the request, not the payload."""

    serializer_class = TicketSerializer
    queryset = Ticket.objects.select_related("created_by").all()

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)
