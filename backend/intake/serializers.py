from rest_framework import serializers

from work.models import WorkGroup
from work.serializers import WorkUserSerializer

from .models import WorkRequest


class ResultingWorkItemSerializer(serializers.Serializer):
    id = serializers.IntegerField(read_only=True)
    reference = serializers.CharField(read_only=True)
    title = serializers.CharField(read_only=True)
    group_name = serializers.CharField(source="group.name", read_only=True)
    workspace_slug = serializers.CharField(source="group.workspace.slug", read_only=True)


class WorkRequestSerializer(serializers.ModelSerializer):
    request_type_label = serializers.CharField(source="get_request_type_display", read_only=True)
    status_label = serializers.CharField(source="get_status_display", read_only=True)
    submitted_by_detail = WorkUserSerializer(source="submitted_by", read_only=True)
    destination_group_name = serializers.CharField(source="destination_group.name", read_only=True)
    destination_workspace_slug = serializers.CharField(
        source="destination_group.workspace.slug",
        read_only=True,
    )
    owner_detail = WorkUserSerializer(source="owner", read_only=True)
    reviewer_detail = WorkUserSerializer(source="reviewer", read_only=True)
    accepted_by_detail = WorkUserSerializer(source="accepted_by", read_only=True)
    resulting_work_item_detail = ResultingWorkItemSerializer(
        source="resulting_work_item",
        read_only=True,
    )

    class Meta:
        model = WorkRequest
        fields = (
            "id",
            "reference",
            "title",
            "brief",
            "request_type",
            "request_type_label",
            "priority",
            "requested_due_date",
            "status",
            "status_label",
            "submitted_by_detail",
            "destination_group",
            "destination_group_name",
            "destination_workspace_slug",
            "triage_priority",
            "triage_due_date",
            "owner",
            "owner_detail",
            "reviewer",
            "reviewer_detail",
            "resulting_work_item",
            "resulting_work_item_detail",
            "accepted_by_detail",
            "accepted_at",
            "created_at",
            "updated_at",
        )
        read_only_fields = fields


class WorkRequestWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = WorkRequest
        fields = ("title", "brief", "request_type", "priority", "requested_due_date")


class WorkRequestTriageSerializer(serializers.ModelSerializer):
    destination_group = serializers.PrimaryKeyRelatedField(queryset=WorkGroup.objects.all())

    class Meta:
        model = WorkRequest
        fields = (
            "destination_group",
            "triage_priority",
            "triage_due_date",
            "owner",
            "reviewer",
        )

    def validate_destination_group(self, group):
        if group.archived or group.workspace.archived:
            raise serializers.ValidationError("Select an active group in an active workspace.")
        return group

    def validate(self, attrs):
        for field_name in ("owner", "reviewer"):
            user = attrs.get(field_name)
            if user is not None and not user.is_active:
                raise serializers.ValidationError({field_name: "Select an active user."})
        return attrs
