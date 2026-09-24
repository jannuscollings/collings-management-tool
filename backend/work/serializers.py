from django.contrib.auth import get_user_model
from rest_framework import serializers
from rest_framework.exceptions import PermissionDenied
from django.db import transaction
from django.db.models import Prefetch
from django.utils.text import slugify

from .models import WorkGroup, WorkItem, Workspace, SubWork, WorkComment, WorkActivity, WorkLink
from .access import is_admin, visible_items, can_edit, allowed_statuses

User = get_user_model()


class WorkUserSerializer(serializers.ModelSerializer):
    display_name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ("id", "email", "first_name", "last_name", "display_name")

    def get_display_name(self, user):
        return user.get_full_name() or user.email


class WorkItemSerializer(serializers.ModelSerializer):
    permissions = serializers.SerializerMethodField()

    def get_permissions(self, item):
        user = self.context["request"].user
        return {"manage": is_admin(user), "edit": can_edit(item, user),
                "review": item.status == "review" and item.reviewer_id == user.pk,
                "statuses": allowed_statuses(item, user)}

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
            "permissions",
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
            "permissions",
            "owner_detail",
            "reviewer_detail",
            "created_by_detail",
            "created_at",
            "updated_at",
        )

    def validate(self, attrs):
        user = self.context["request"].user
        item = self.instance
        if not is_admin(user):
            if not item or not can_edit(item, user):
                raise PermissionDenied("Only an administrator or the owner can edit this work item.")
            forbidden = set(attrs) - {"title", "brief", "status"}
            if forbidden:
                raise PermissionDenied("Only administrators can change assignments and delivery properties.")
        group = attrs.get("group")
        if group and (group.archived or group.workspace.archived):
            raise serializers.ValidationError({"group": "Select an active group."})
        next_status = attrs.get("status", item.status if item else "new")
        reviewer = attrs.get("reviewer", item.reviewer if item else None)
        if item and item.status == "review" and next_status != "review":
            raise serializers.ValidationError({"status": "Use Approve or Request changes to leave Review."})
        if (not item or next_status != item.status) and next_status == "done" and reviewer:
            raise serializers.ValidationError({"status": "Assigned review must be approved by the reviewer."})
        if next_status == "review" and (not reviewer or not reviewer.is_active):
            raise serializers.ValidationError({"reviewer": "Assign an active reviewer before submitting for review."})
        for field_name in ("owner", "reviewer"):
            user = attrs.get(field_name)
            if user is not None and not user.is_active:
                raise serializers.ValidationError({field_name: "Select an active user."})
        return attrs


class WorkGroupSerializer(serializers.ModelSerializer):
    work_items = serializers.SerializerMethodField()

    def get_work_items(self, group):
        items = group.visible_work_items
        return WorkItemSerializer(items, many=True, context=self.context).data

    class Meta:
        model = WorkGroup
        fields = ("id", "name", "display_order", "work_items")


class WorkspaceSerializer(serializers.ModelSerializer):
    groups = serializers.SerializerMethodField()

    class Meta:
        model = Workspace
        fields = ("id", "name", "slug", "display_order", "archived", "groups")

    def get_groups(self, workspace):
        items = visible_items(WorkItem.objects.select_related(
            "group__workspace", "owner", "reviewer", "created_by"
        ), self.context["request"].user)
        groups = workspace.groups.filter(archived=False).prefetch_related(
            Prefetch("work_items", queryset=items, to_attr="visible_work_items")
        )
        return WorkGroupSerializer(groups, many=True, context=self.context).data


class WorkspaceSummarySerializer(serializers.ModelSerializer):
    class Meta:
        model = Workspace
        fields = ("id", "name", "slug", "display_order", "archived")
        read_only_fields = fields


class WorkspaceCreateSerializer(serializers.ModelSerializer):
    initial_group_name = serializers.CharField(max_length=120, write_only=True)
    slug = serializers.SlugField(max_length=140, required=False)

    class Meta:
        model = Workspace
        fields = ("id", "name", "slug", "display_order", "archived", "initial_group_name")
        read_only_fields = ("id", "display_order", "archived")

    def validate(self, attrs):
        slug = attrs.get("slug") or slugify(attrs["name"])
        if not slug:
            raise serializers.ValidationError({"slug": "Enter a name that can form a URL."})
        if Workspace.objects.filter(slug=slug).exists():
            raise serializers.ValidationError({"slug": "A workspace already uses this URL slug."})
        attrs["slug"] = slug
        return attrs

    @transaction.atomic
    def create(self, validated_data):
        initial_group_name = validated_data.pop("initial_group_name")
        highest_order = Workspace.objects.select_for_update().order_by("-display_order").values_list(
            "display_order", flat=True
        ).first()
        workspace = Workspace.objects.create(
            display_order=(highest_order or 0) + 1,
            **validated_data,
        )
        WorkGroup.objects.create(workspace=workspace, name=initial_group_name, display_order=1)
        return workspace


class WorkspaceUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Workspace
        fields = ("name",)


class SubWorkSerializer(serializers.ModelSerializer):
    assignee_detail = WorkUserSerializer(source="assignee", read_only=True)

    class Meta:
        model = SubWork
        fields = ("id", "title", "assignee", "assignee_detail", "completed", "created_at", "updated_at")
        read_only_fields = ("id", "created_at", "updated_at")

    def validate_assignee(self, user):
        if user and not user.is_active:
            raise serializers.ValidationError("Select an active user.")
        return user


class WorkCommentSerializer(serializers.ModelSerializer):
    author_detail = WorkUserSerializer(source="author", read_only=True)
    body = serializers.CharField(max_length=10000, allow_blank=False)
    mentions = serializers.PrimaryKeyRelatedField(queryset=User.objects.filter(is_active=True), many=True, required=False)
    mention_details = WorkUserSerializer(source='mentions', many=True, read_only=True)
    can_manage = serializers.SerializerMethodField()

    def get_can_manage(self, comment):
        user = self.context['request'].user
        return not comment.deleted_at and (comment.author_id == user.pk or is_admin(user))

    def validate(self, attrs):
        if self.instance and 'parent' in attrs and attrs['parent'] != self.instance.parent:
            raise serializers.ValidationError({'parent': 'Replies cannot be moved.'})
        parent = attrs.get('parent')
        if parent and (parent.work_item_id != self.context['item'].pk or parent.parent_id or parent.deleted_at):
            raise serializers.ValidationError({'parent': 'Reply to an active top-level comment on this work item.'})
        return attrs

    def to_representation(self, instance):
        data = super().to_representation(instance)
        if instance.deleted_at:
            data.update(body='', mentions=[], mention_details=[])
        return data

    class Meta:
        model = WorkComment
        fields = ("id", "author_detail", "body", "created_at", "parent", "mentions", "mention_details", "edited_at", "deleted_at", "can_manage")
        read_only_fields = ("id", "created_at", "edited_at", "deleted_at")


class WorkActivitySerializer(serializers.ModelSerializer):
    actor_detail = WorkUserSerializer(source="actor", read_only=True)

    class Meta:
        model = WorkActivity
        fields = ("id", "actor_detail", "event", "details", "created_at")
        read_only_fields = fields


class WorkLinkSerializer(serializers.ModelSerializer):
    class Meta:
        model = WorkLink
        fields = ("id", "label", "url", "created_at")
        read_only_fields = ("id", "created_at")

    def validate_url(self, value):
        from urllib.parse import urlsplit
        if urlsplit(value).scheme not in ("http", "https"):
            raise serializers.ValidationError("Use an HTTP or HTTPS URL.")
        return value
