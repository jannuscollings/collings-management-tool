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

