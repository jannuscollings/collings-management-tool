from django.contrib.auth import get_user_model
from .models import WorkActivity, WorkGroup


def record_activity(item, actor, event, **details):
    return WorkActivity.objects.create(work_item=item, actor=actor, event=event, details=details)


def record_changes(item, actor, before):
    for field, old in before.items():
        new = getattr(item, field)
        if new != old:
            if field == 'start_date':
                event = 'start_date_added' if old is None else 'start_date_cleared' if new is None else 'start_date_changed'
            else:
                event = 'review_submitted' if field == 'status' and new == 'review' else f'{field}_changed'
            def label(value):
                if value is None:
                    return None
                if field in ("owner_id", "reviewer_id"):
                    user = get_user_model().objects.filter(pk=value).first()
                    return (user.get_full_name() or user.email) if user else str(value)
                if field == "group_id":
                    group = WorkGroup.objects.filter(pk=value).first()
                    return str(group) if group else str(value)
                if field == "status":
                    return dict(item.Status.choices).get(value, value)
                return str(value)
            record_activity(item, actor, event, before=label(old), after=label(new))
    from .notifications import assignment_notifications
    assignment_notifications(item, actor, before)
