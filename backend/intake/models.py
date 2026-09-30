from django.conf import settings
from django.db import models

from work.models import WorkGroup, WorkItem


class WorkRequest(models.Model):
    class RequestType(models.TextChoices):
        CREATIVE_DESIGN = "creative_design", "Creative & Design"

    class Status(models.TextChoices):
        NEW = "new", "New"
        TRIAGING = "triaging", "Triaging"
        ACCEPTED = "accepted", "Accepted"
        REJECTED = "rejected", "Rejected"

    class Priority(models.TextChoices):
        LOW = "low", "Low"
        MEDIUM = "medium", "Medium"
        HIGH = "high", "High"

    reference = models.CharField(max_length=20, unique=True, null=True, editable=False)
    title = models.CharField(max_length=200)
    brief = models.TextField(blank=True)
    request_type = models.CharField(
        max_length=30,
        choices=RequestType.choices,
        default=RequestType.CREATIVE_DESIGN,
    )
    priority = models.CharField(
        max_length=10,
        choices=Priority.choices,
        default=Priority.MEDIUM,
    )
    requested_due_date = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.NEW)
    submitted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="submitted_work_requests",
    )
    destination_group = models.ForeignKey(
        WorkGroup,
        on_delete=models.PROTECT,
        related_name="routed_work_requests",
        null=True,
        blank=True,
    )
    triage_priority = models.CharField(
        max_length=10,
        choices=Priority.choices,
        null=True,
        blank=True,
    )
    triage_due_date = models.DateField(null=True, blank=True)
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="assigned_work_requests",
        null=True,
        blank=True,
    )
    reviewer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="review_work_requests",
        null=True,
        blank=True,
    )
    resulting_work_item = models.OneToOneField(
        WorkItem,
        on_delete=models.PROTECT,
        related_name="source_request",
        null=True,
        blank=True,
    )
    accepted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="accepted_work_requests",
        null=True,
        blank=True,
    )
    accepted_at = models.DateTimeField(null=True, blank=True)
    rejection_reason = models.CharField(max_length=300, blank=True)
    rejected_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="rejected_work_requests",
        null=True,
        blank=True,
    )
    rejected_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("-created_at",)

    def save(self, *args, **kwargs):
        is_new = self.pk is None
        if not is_new:
            original_reference = (
                type(self).objects.filter(pk=self.pk).values_list("reference", flat=True).first()
            )
            if original_reference:
                self.reference = original_reference

        super().save(*args, **kwargs)

        if is_new and self.reference is None:
            self.reference = f"WR-{self.pk:06d}"
            type(self).objects.filter(pk=self.pk, reference__isnull=True).update(
                reference=self.reference
            )

    def __str__(self):
        return f"{self.reference or 'New request'} {self.title}"
