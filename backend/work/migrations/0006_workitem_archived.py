from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("work", "0005_workcommentattachment")]

    operations = [
        migrations.AddField(
            model_name="workitem",
            name="archived",
            field=models.BooleanField(default=False),
        ),
    ]
