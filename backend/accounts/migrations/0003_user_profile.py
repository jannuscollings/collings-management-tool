from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("accounts", "0002_user_job_title")]

    operations = [
        migrations.AddField(model_name="user", name="bio", field=models.TextField(blank=True, default="")),
        migrations.AddField(model_name="user", name="avatar_data", field=models.BinaryField(blank=True, editable=False, null=True)),
        migrations.AddField(model_name="user", name="avatar_updated_at", field=models.DateTimeField(blank=True, editable=False, null=True)),
    ]
