from rest_framework import serializers

from .models import Ticket


class TicketSerializer(serializers.ModelSerializer):
    created_by_email = serializers.EmailField(source="created_by.email", read_only=True)

    class Meta:
        model = Ticket
        fields = (
            "id",
            "title",
            "description",
            "status",
            "priority",
            "created_by_email",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_by_email", "created_at", "updated_at")
