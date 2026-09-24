"""Selected user-specific events; activity remains the independent audit trail."""
from django.contrib.auth import get_user_model
from django.db.models import Q
from .access import is_admin, visible_items
from .models import Notification, WorkItem


def visible_notifications(user):
    from intake.models import WorkRequest
    requests = WorkRequest.objects.all()
    if not is_admin(user):
        requests = requests.filter(submitted_by=user)
    return Notification.objects.filter(recipient=user).filter(
        Q(work_item_id__in=visible_items(WorkItem.objects.all(), user).values('pk')) |
        Q(work_request_id__in=requests.values('pk')))


def notify(actor, recipient_id, event, *, item=None, work_request=None):
    if not recipient_id or recipient_id == actor.pk:
        return
    recipient = get_user_model().objects.filter(pk=recipient_id, is_active=True).first()
    if not recipient:
        return
    if item and not visible_items(WorkItem.objects.filter(pk=item.pk), recipient).exists():
        return
    if work_request and not (is_admin(recipient) or work_request.submitted_by_id == recipient.pk):
        return
    Notification.objects.create(recipient=recipient, event=event, work_item=item, work_request=work_request)


def assignment_notifications(item, actor, before=None):
    before = before or {}
    if item.owner_id != before.get('owner_id'):
        notify(actor, item.owner_id, 'assigned', item=item)
    reviewer_changed = item.reviewer_id != before.get('reviewer_id')
    entering_review = item.status == 'review' and before.get('status') != 'review'
    if reviewer_changed or entering_review:
        notify(actor, item.reviewer_id, 'review_ready' if item.status == 'review' else 'reviewer_assigned', item=item)


def comment_notifications(comment, actor, previous_mentions=(), reply=False):
    mentioned = set(comment.mentions.values_list('pk', flat=True)) - set(previous_mentions)
    for recipient in mentioned:
        notify(actor, recipient, 'mentioned', item=comment.work_item)
    if reply and comment.parent_id and comment.parent.author_id not in mentioned:
        notify(actor, comment.parent.author_id, 'reply', item=comment.work_item)
