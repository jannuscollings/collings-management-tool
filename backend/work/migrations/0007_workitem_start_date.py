from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("work", "0006_workitem_archived")]

    operations = [
        migrations.AddField(
            model_name="workitem",
            name="start_date",
            field=models.DateField(blank=True, null=True),
        ),
    ]
