from django.conf import settings
from django.db import models


class Workspace(models.Model):
    name = models.CharField(max_length=120)
    slug = models.SlugField(max_length=140, unique=True)
    display_order = models.PositiveIntegerField(default=0)
    archived = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("display_order", "name")

    def __str__(self):
        return self.name


class WorkGroup(models.Model):
    workspace = models.ForeignKey(
        Workspace,
        on_delete=models.PROTECT,
        related_name="groups",
    )
    name = models.CharField(max_length=120)
    display_order = models.PositiveIntegerField(default=0)
    archived = models.BooleanField(default=False)

    class Meta:
        ordering = ("display_order", "name")
        constraints = [
            models.UniqueConstraint(
                fields=("workspace", "name"),
                name="unique_work_group_name_per_workspace",
            )
        ]

    def __str__(self):
        return f"{self.workspace.name} / {self.name}"


class WorkItem(models.Model):
    class Status(models.TextChoices):
        NEW = "new", "New"
        IN_PROGRESS = "in_progress", "In progress"
        REVIEW = "review", "Review"
        DONE = "done", "Done"

    class Priority(models.TextChoices):
        LOW = "low", "Low"
        MEDIUM = "medium", "Medium"
        HIGH = "high", "High"

    reference = models.CharField(max_length=20, unique=True, null=True, editable=False)
    group = models.ForeignKey(
        WorkGroup,
        on_delete=models.PROTECT,
        related_name="work_items",
    )
    title = models.CharField(max_length=200)
    brief = models.TextField(blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.NEW)
    priority = models.CharField(max_length=10, choices=Priority.choices, default=Priority.MEDIUM)
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="owned_work_items",
        null=True,
        blank=True,
    )
    reviewer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="review_work_items",
        null=True,
        blank=True,
    )
    due_date = models.DateField(null=True, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="created_work_items",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("-created_at",)

    def save(self, *args, **kwargs):
        is_new = self.pk is None
        super().save(*args, **kwargs)
        if is_new and self.reference is None:
            self.reference = f"WI-{self.pk:06d}"
            super().save(update_fields=("reference",))

    def __str__(self):
        return f"{self.reference or 'New work item'} {self.title}"



class SubWork(models.Model):
    work_item = models.ForeignKey(WorkItem, on_delete=models.CASCADE, related_name="sub_work")
    title = models.CharField(max_length=200)
    assignee = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL)
    completed = models.BooleanField(default=False)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="created_sub_work")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("created_at", "pk")


class WorkComment(models.Model):
    parent = models.ForeignKey('self', null=True, blank=True, on_delete=models.PROTECT, related_name='replies')
    mentions = models.ManyToManyField(settings.AUTH_USER_MODEL, blank=True, related_name='work_mentions')
    edited_at = models.DateTimeField(null=True, blank=True)
    deleted_at = models.DateTimeField(null=True, blank=True)
    work_item = models.ForeignKey(WorkItem, on_delete=models.CASCADE, related_name="comments")
    author = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    body = models.TextField(max_length=10000)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("created_at", "pk")


class WorkCommentAttachment(models.Model):
    comment = models.ForeignKey(WorkComment, on_delete=models.CASCADE, related_name="attachments")
    file = models.FileField(upload_to="discussion/")
    filename = models.CharField(max_length=255)
    content_type = models.CharField(max_length=100)
    size = models.PositiveIntegerField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("created_at", "pk")


class WorkActivity(models.Model):
    work_item = models.ForeignKey(WorkItem, on_delete=models.CASCADE, related_name="activity")
    actor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    event = models.CharField(max_length=60)
    details = models.JSONField(default=dict)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("-created_at", "-pk")


class WorkLink(models.Model):
    work_item = models.ForeignKey(WorkItem, on_delete=models.CASCADE, related_name="links")
    label = models.CharField(max_length=160)
    url = models.URLField(max_length=2000)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("created_at", "pk")


class Notification(models.Model):
    recipient = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="work_notifications")
    event = models.CharField(max_length=40)
    work_item = models.ForeignKey(WorkItem, null=True, blank=True, on_delete=models.CASCADE)
    work_request = models.ForeignKey("intake.WorkRequest", null=True, blank=True, on_delete=models.CASCADE)
    read_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("-created_at", "-pk")
        indexes = [models.Index(fields=("recipient", "read_at", "-created_at"), name="notification_inbox_idx")]
        constraints = [models.CheckConstraint(
            check=(models.Q(work_item__isnull=False, work_request__isnull=True) |
                       models.Q(work_item__isnull=True, work_request__isnull=False)),
            name="notification_one_target")]
