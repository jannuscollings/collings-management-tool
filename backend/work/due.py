from datetime import timedelta
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from django.utils import timezone
from rest_framework.exceptions import ValidationError


def local_today(request):
    zone = request.query_params.get('timezone')
    try:
        return timezone.localdate(timezone=ZoneInfo(zone) if zone else timezone.get_current_timezone())
    except (ZoneInfoNotFoundError, ValueError):
        raise ValidationError({'timezone': 'Use a valid IANA timezone.'})


def due_queryset(queryset, state, today):
    opened = queryset.exclude(status='done')
    if state == 'overdue':
        return opened.filter(due_date__lt=today)
    if state == 'today':
        return opened.filter(due_date=today)
    if state == 'soon':
        return opened.filter(due_date__gt=today, due_date__lte=today + timedelta(days=3))
    raise ValidationError({'due': 'Select overdue, today or soon.'})
