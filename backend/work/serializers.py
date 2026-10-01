from django.contrib.auth import get_user_model
from rest_framework import serializers
from rest_framework.exceptions import PermissionDenied
from django.db import transaction
from django.db.models import Prefetch
from django.utils.text import slugify

from .models import WorkGroup, WorkItem, Workspace, SubWork, WorkComment, WorkCommentAttachment, WorkActivity, WorkLink
from .access import is_admin, visible_items, can_edit, allowed_statuses
from .review import with_latest_review_event

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
    outstanding_review_feedback = serializers.SerializerMethodField()

    def get_outstanding_review_feedback(self, item):
        if item.status != 'in_progress':
            return None
        if not hasattr(item, 'latest_review_event'):
            item = with_latest_review_event(WorkItem.objects.filter(pk=item.pk)).get()
        if item.latest_review_event != 'changes_requested':
            return None
        return {'note': item.latest_review_note, 'requested_by': item.latest_review_actor_email}

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
            "archived",
            "group",
            "group_name",
            "workspace_slug",
            "workspace_name",
            "permissions",
            "outstanding_review_feedback",
            "title",
            "brief",
            "status",
            "priority",
            "owner",
            "owner_detail",
            "reviewer",
            "reviewer_detail",
            "start_date",
            "due_date",
            "created_by_detail",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "reference",
            "archived",
            "group_name",
            "workspace_slug",
            "workspace_name",
            "permissions",
            "outstanding_review_feedback",
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
        start_date = attrs.get("start_date", item.start_date if item else None)
        due_date = attrs.get("due_date", item.due_date if item else None)
        if start_date and not due_date:
            raise serializers.ValidationError({"due_date": "Set a due date when a start date is set."})
        if start_date and due_date and start_date > due_date:
            raise serializers.ValidationError({"start_date": "Start date must be on or before due date."})
        if group and (group.archived or group.workspace.archived):
            raise serializers.ValidationError({"group": "Select an active group."})
        next_status = attrs.get("status", item.status if item else "new")
        reviewer = attrs.get("reviewer", item.reviewer if item else None)
        if item and item.status == "review" and next_status != "review":
            raise serializers.ValidationError({"status": "Use Approve or Request changes to leave Review."})
        if (not item or next_status != item.status) and next_status == "done" and reviewer:
            raise serializers.ValidationError({"status": "Assigned review must be approved by the reviewer."})
        if next_status == "review" and (not reviewer or (
            not reviewer.is_active and (not item or item.status != "review" or item.reviewer_id != reviewer.pk)
        )):
            raise serializers.ValidationError({"reviewer": "Assign an active reviewer before submitting for review."})
        for field_name in ("owner", "reviewer"):
            user = attrs.get(field_name)
            if user is not None and not user.is_active and (not item or getattr(item, f"{field_name}_id") != user.pk):
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
        items = visible_items(with_latest_review_event(WorkItem.objects.select_related(
            "group__workspace", "owner", "reviewer", "created_by"
        )), self.context["request"].user)
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
    initial_group_name = serializers.CharField(max_length=120, write_only=True, required=False)
    board_names = serializers.ListField(child=serializers.CharField(max_length=120), write_only=True, required=False)
    slug = serializers.SlugField(max_length=140, required=False)

    class Meta:
        model = Workspace
        fields = ("id", "name", "slug", "display_order", "archived", "initial_group_name", "board_names")
        read_only_fields = ("id", "display_order", "archived")

    def validate(self, attrs):
        names = attrs.get("board_names")
        initial = attrs.get("initial_group_name")
        if names is not None and initial is not None:
            raise serializers.ValidationError({"board_names": "Use one board name format."})
        names = names if names is not None else ([initial] if initial is not None else [])
        names = [name.strip() for name in names]
        if not names or any(not name for name in names):
            raise serializers.ValidationError({"board_names": "Provide at least one nonblank board name."})
        if len({name.casefold() for name in names}) != len(names):
            raise serializers.ValidationError({"board_names": "Board names must be unique within a workspace."})
        attrs["board_names"] = names
        attrs.pop("initial_group_name", None)
        slug = attrs.get("slug") or slugify(attrs["name"])
        if not slug:
            raise serializers.ValidationError({"slug": "Enter a name that can form a URL."})
        if Workspace.objects.filter(slug=slug).exists():
            raise serializers.ValidationError({"slug": "A workspace already uses this URL slug."})
        attrs["slug"] = slug
        return attrs

    @transaction.atomic
    def create(self, validated_data):
        board_names = validated_data.pop("board_names")
        highest_order = Workspace.objects.select_for_update().order_by("-display_order").values_list(
            "display_order", flat=True
        ).first()
        workspace = Workspace.objects.create(
            display_order=(highest_order or 0) + 1,
            **validated_data,
        )
        for order, name in enumerate(board_names, start=1):
            WorkGroup.objects.create(workspace=workspace, name=name, display_order=order)
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
        if user and not user.is_active and (not self.instance or self.instance.assignee_id != user.pk):
            raise serializers.ValidationError("Select an active user.")
        return user


class WorkCommentAttachmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = WorkCommentAttachment
        fields = ("id", "filename", "content_type", "size", "created_at")
        read_only_fields = fields


class WorkCommentSerializer(serializers.ModelSerializer):
    author_detail = WorkUserSerializer(source="author", read_only=True)
    body = serializers.CharField(max_length=10000, allow_blank=True)
    mentions = serializers.PrimaryKeyRelatedField(queryset=User.objects.filter(is_active=True), many=True, required=False)
    mention_details = WorkUserSerializer(source='mentions', many=True, read_only=True)
    can_manage = serializers.SerializerMethodField()
    attachments = WorkCommentAttachmentSerializer(many=True, read_only=True)

    def get_can_manage(self, comment):
        user = self.context['request'].user
        return not comment.deleted_at and (comment.author_id == user.pk or is_admin(user))

    def validate(self, attrs):
        if (self.instance and 'body' in attrs and not attrs['body'].strip()) or (
            not self.instance and not attrs.get('body', '').strip() and not self.context.get('attachment_count')
        ):
            raise serializers.ValidationError({'body': 'Enter a comment or attach a file.'})
        if self.instance and 'parent' in attrs and attrs['parent'] != self.instance.parent:
            raise serializers.ValidationError({'parent': 'Replies cannot be moved.'})
        parent = attrs.get('parent')
        if parent and (parent.work_item_id != self.context['item'].pk or parent.parent_id or parent.deleted_at):
            raise serializers.ValidationError({'parent': 'Reply to an active top-level comment on this work item.'})
        return attrs

    def to_representation(self, instance):
        data = super().to_representation(instance)
        if instance.deleted_at:
            data.update(body='', mentions=[], mention_details=[], attachments=[])
        return data

    class Meta:
        model = WorkComment
        fields = ("id", "author_detail", "body", "created_at", "parent", "mentions", "mention_details", "edited_at", "deleted_at", "can_manage", "attachments")
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
