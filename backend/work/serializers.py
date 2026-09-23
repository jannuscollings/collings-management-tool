from django.contrib.auth import get_user_model
from rest_framework import serializers

from .models import WorkGroup, WorkItem, Workspace

User = get_user_model()


class WorkUserSerializer(serializers.ModelSerializer):
    display_name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ("id", "email", "first_name", "last_name", "display_name")

    def get_display_name(self, user):
        return user.get_full_name() or user.email


class WorkItemSerializer(serializers.ModelSerializer):
    owner_detail = WorkUserSerializer(source="owner", read_only=True)
    reviewer_detail = WorkUserSerializer(source="reviewer", read_only=True)
    created_by_detail = WorkUserSerializer(source="created_by", read_only=True)
    group_name = serializers.CharField(source="group.name", read_only=True)
    workspace_slug = serializers.CharField(source="group.workspace.slug", read_only=True)
    workspace_name = serializers.CharField(source="group.workspace.name", read_only=True)

    class Meta:
        model = WorkItem
        fields = (
            "id",
            "reference",
            "group",
            "group_name",
            "workspace_slug",
            "workspace_name",
            "title",
            "brief",
            "status",
            "priority",
            "owner",
            "owner_detail",
            "reviewer",
            "reviewer_detail",
            "due_date",
            "created_by_detail",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "reference",
            "group_name",
            "workspace_slug",
            "workspace_name",
            "owner_detail",
            "reviewer_detail",
            "created_by_detail",
            "created_at",
            "updated_at",
        )

    def validate(self, attrs):
        for field_name in ("owner", "reviewer"):
            user = attrs.get(field_name)
            if user is not None and not user.is_active:
                raise serializers.ValidationError({field_name: "Select an active user."})
        return attrs


class WorkGroupSerializer(serializers.ModelSerializer):
    work_items = WorkItemSerializer(many=True, read_only=True)

    class Meta:
        model = WorkGroup
        fields = ("id", "name", "display_order", "work_items")


class WorkspaceSerializer(serializers.ModelSerializer):
    groups = serializers.SerializerMethodField()

    class Meta:
        model = Workspace
        fields = ("id", "name", "slug", "display_order", "groups")

    def get_groups(self, workspace):
        groups = workspace.groups.filter(archived=False).prefetch_related(
            "work_items__owner",
            "work_items__reviewer",
            "work_items__created_by",
        )
        return WorkGroupSerializer(groups, many=True, context=self.context).data
