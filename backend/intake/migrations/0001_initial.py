import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("work", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="WorkRequest",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("reference", models.CharField(editable=False, max_length=20, null=True, unique=True)),
                ("title", models.CharField(max_length=200)),
                ("brief", models.TextField(blank=True)),
                ("request_type", models.CharField(choices=[("creative_design", "Creative & Design")], default="creative_design", max_length=30)),
                ("priority", models.CharField(choices=[("low", "Low"), ("medium", "Medium"), ("high", "High")], default="medium", max_length=10)),
                ("requested_due_date", models.DateField(blank=True, null=True)),
                ("status", models.CharField(choices=[("new", "New"), ("triaging", "Triaging"), ("accepted", "Accepted"), ("rejected", "Rejected")], default="new", max_length=20)),
                ("triage_priority", models.CharField(blank=True, choices=[("low", "Low"), ("medium", "Medium"), ("high", "High")], max_length=10, null=True)),
                ("triage_due_date", models.DateField(blank=True, null=True)),
                ("accepted_at", models.DateTimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("accepted_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="accepted_work_requests", to=settings.AUTH_USER_MODEL)),
                ("destination_group", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.PROTECT, related_name="routed_work_requests", to="work.workgroup")),
                ("owner", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="assigned_work_requests", to=settings.AUTH_USER_MODEL)),
                ("resulting_work_item", models.OneToOneField(blank=True, null=True, on_delete=django.db.models.deletion.PROTECT, related_name="source_request", to="work.workitem")),
                ("reviewer", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="review_work_requests", to=settings.AUTH_USER_MODEL)),
                ("submitted_by", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="submitted_work_requests", to=settings.AUTH_USER_MODEL)),
            ],
            options={"ordering": ("-created_at",)},
        ),
    ]

