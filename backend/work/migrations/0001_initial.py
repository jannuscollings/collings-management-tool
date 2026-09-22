import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


def create_creative_workspace(apps, schema_editor):
    Workspace = apps.get_model("work", "Workspace")
    WorkGroup = apps.get_model("work", "WorkGroup")
    workspace, _ = Workspace.objects.get_or_create(
        slug="creative-design",
        defaults={"name": "Creative & Design", "display_order": 1},
    )
    for display_order, name in enumerate(
        ("Property launch", "Campaign content", "Ongoing requests"),
        start=1,
    ):
        WorkGroup.objects.get_or_create(
            workspace=workspace,
            name=name,
            defaults={"display_order": display_order},
        )


def remove_creative_workspace(apps, schema_editor):
    Workspace = apps.get_model("work", "Workspace")
    WorkGroup = apps.get_model("work", "WorkGroup")
    WorkItem = apps.get_model("work", "WorkItem")
    WorkItem.objects.filter(group__workspace__slug="creative-design").delete()
    WorkGroup.objects.filter(workspace__slug="creative-design").delete()
    Workspace.objects.filter(slug="creative-design").delete()


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="Workspace",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=120)),
                ("slug", models.SlugField(max_length=140, unique=True)),
                ("display_order", models.PositiveIntegerField(default=0)),
                ("archived", models.BooleanField(default=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
            options={"ordering": ("display_order", "name")},
        ),
        migrations.CreateModel(
            name="WorkGroup",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=120)),
                ("display_order", models.PositiveIntegerField(default=0)),
                ("archived", models.BooleanField(default=False)),
                ("workspace", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="groups", to="work.workspace")),
            ],
            options={"ordering": ("display_order", "name")},
        ),
        migrations.CreateModel(
            name="WorkItem",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("reference", models.CharField(editable=False, max_length=20, null=True, unique=True)),
                ("title", models.CharField(max_length=200)),
                ("brief", models.TextField(blank=True)),
                ("status", models.CharField(choices=[("new", "New"), ("in_progress", "In progress"), ("review", "Review"), ("done", "Done")], default="new", max_length=20)),
                ("priority", models.CharField(choices=[("low", "Low"), ("medium", "Medium"), ("high", "High")], default="medium", max_length=10)),
                ("due_date", models.DateField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("created_by", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="created_work_items", to=settings.AUTH_USER_MODEL)),
                ("group", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="work_items", to="work.workgroup")),
                ("owner", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="owned_work_items", to=settings.AUTH_USER_MODEL)),
                ("reviewer", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="review_work_items", to=settings.AUTH_USER_MODEL)),
            ],
            options={"ordering": ("-created_at",)},
        ),
        migrations.AddConstraint(
            model_name="workgroup",
            constraint=models.UniqueConstraint(fields=("workspace", "name"), name="unique_work_group_name_per_workspace"),
        ),
        migrations.RunPython(create_creative_workspace, remove_creative_workspace),
    ]
