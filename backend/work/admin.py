from django.contrib import admin

from .models import WorkGroup, WorkItem, Workspace


@admin.register(Workspace)
class WorkspaceAdmin(admin.ModelAdmin):
    list_display = ("name", "slug", "display_order", "archived", "updated_at")
    list_editable = ("display_order", "archived")
    prepopulated_fields = {"slug": ("name",)}


@admin.register(WorkGroup)
class WorkGroupAdmin(admin.ModelAdmin):
    list_display = ("name", "workspace", "display_order", "archived")
    list_filter = ("workspace", "archived")
    list_editable = ("display_order", "archived")


@admin.register(WorkItem)
class WorkItemAdmin(admin.ModelAdmin):
    list_display = ("reference", "title", "group", "status", "priority", "owner", "due_date")
    list_filter = ("status", "priority", "group__workspace", "group")
    search_fields = ("reference", "title", "brief")
    readonly_fields = ("reference", "created_at", "updated_at")

