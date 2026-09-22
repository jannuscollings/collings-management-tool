from django.contrib import admin

from .models import WorkRequest


@admin.register(WorkRequest)
class WorkRequestAdmin(admin.ModelAdmin):
    list_display = (
        "reference",
        "title",
        "status",
        "priority",
        "submitted_by",
        "destination_group",
        "resulting_work_item",
        "created_at",
    )
    list_filter = ("status", "request_type", "priority")
    search_fields = ("reference", "title", "brief", "submitted_by__email")
    readonly_fields = (
        "reference",
        "status",
        "resulting_work_item",
        "accepted_by",
        "accepted_at",
        "created_at",
        "updated_at",
    )
