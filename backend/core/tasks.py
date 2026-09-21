"""Sample Celery task — proof the worker + broker are wired.

Run it from a shell:  python manage.py shell -c "from core.tasks import add; print(add.delay(2, 3))"
"""
from celery import shared_task


@shared_task
def add(x: int, y: int) -> int:
    return x + y
