from datetime import timedelta
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError
from django.db.models import Q, Max, F
from django.db.models.functions import Greatest
from django.utils import timezone
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView
from django.shortcuts import get_object_or_404
from .access import is_admin, visible_items
from .models import WorkItem
from .notifications import visible_notifications


class HomeView(APIView):
    def get(self, request):
        zone = request.query_params.get('timezone')
        try:
            today = timezone.localdate(timezone=ZoneInfo(zone) if zone else timezone.get_current_timezone())
        except (ZoneInfoNotFoundError, ValueError):
            raise ValidationError({'timezone': 'Use a valid IANA timezone.'})
        visible = visible_items(WorkItem.objects.filter(group__archived=False, group__workspace__archived=False), request.user)
        relevant = visible.filter(Q(owner=request.user) | Q(reviewer=request.user) | Q(sub_work__assignee=request.user)).distinct()
        opened = relevant.exclude(status='done')
        def section(qs, order=('due_date', 'pk')):
            # Compact projection avoids per-item permission/serializer queries.
            return {'count': qs.count(), 'items': list(qs.order_by(*order).values(
                'id', 'reference', 'title', 'status', 'priority', 'due_date', 'owner_id', 'reviewer_id',
                'group__workspace__name', 'updated_at')[:12])}
        result = {
            'today': today.isoformat(), 'due_soon_days': 3,
            'my_open': section(opened),
            'due_soon': section(opened.filter(due_date__gte=today, due_date__lte=today+timedelta(days=3))),
            'overdue': section(opened.filter(due_date__lt=today)),
            'review': section(relevant.filter(reviewer=request.user, status='review')),
            'recent': section(relevant.annotate(last_touch=Greatest(F('updated_at'), Max('activity__created_at')))
                              .filter(last_touch__gte=timezone.now()-timedelta(days=7)), ('-last_touch', '-pk')),
        }
        if is_admin(request.user):
            from intake.models import WorkRequest
            queue = WorkRequest.objects.filter(status='new')
            result['triage'] = {'count': queue.count(), 'items': list(queue.order_by('created_at', 'pk').values(
                'id', 'reference', 'title', 'created_at')[:12])}
        return Response(result)


class NotificationViewSet(viewsets.GenericViewSet):
    def get_queryset(self):
        return visible_notifications(self.request.user)

    def list(self, request):
        qs = self.get_queryset()
        try:
            before = int(request.query_params['before']) if 'before' in request.query_params else None
        except ValueError:
            raise ValidationError({'before': 'Use a notification ID.'})
        page = qs.filter(pk__lt=before) if before else qs
        rows = list(page.select_related('work_item', 'work_request').order_by('-pk')[:51])
        data = []
        for n in rows[:50]:
            target = n.work_item or n.work_request
            data.append({'id': n.pk, 'event': n.event, 'read_at': n.read_at, 'created_at': n.created_at,
                         'title': target.title, 'reference': target.reference,
                         'target': {'kind': 'item' if n.work_item_id else 'request', 'id': target.pk}})
        return Response({'items': data, 'unread_count': qs.filter(read_at__isnull=True).count(),
                         'next_before': rows[49].pk if len(rows)>50 else None})

    @action(detail=True, methods=['post'])
    def read(self, request, pk=None):
        notification = get_object_or_404(self.get_queryset(), pk=pk)
        self.get_queryset().filter(pk=notification.pk, read_at__isnull=True).update(read_at=timezone.now())
        return Response({'read': True})

    @action(detail=False, methods=['post'], url_path='read-all')
    def read_all(self, request):
        count = self.get_queryset().filter(read_at__isnull=True).update(read_at=timezone.now())
        return Response({'updated': count})
