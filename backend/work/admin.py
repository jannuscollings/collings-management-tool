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

    # WorkItem mutations go through the application so review rules and actor history apply.
    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


# Discussion and audit records are inspectable, but cannot be rewritten in admin.
from .models import SubWork, WorkComment, WorkActivity, WorkLink


class OperationalRecordAdmin(admin.ModelAdmin):
    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


for model in (SubWork, WorkComment, WorkActivity, WorkLink):
    admin.site.register(model, OperationalRecordAdmin)
