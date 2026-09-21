"""Make the Celery app import when Django starts, so shared_task works."""
from .celery import app as celery_app

__all__ = ("celery_app",)
