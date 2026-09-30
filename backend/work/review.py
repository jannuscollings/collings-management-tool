from django.db.models import OuterRef, Subquery

from .models import WorkActivity


def with_latest_review_event(queryset):
    """Expose the latest review submission or decision for current-cycle awareness."""
    latest = WorkActivity.objects.filter(
        work_item_id=OuterRef('pk'),
        event__in=('review_submitted', 'changes_requested', 'approved'),
    ).order_by('-created_at', '-pk')
    return queryset.annotate(
        latest_review_event=Subquery(latest.values('event')[:1]),
        latest_review_note=Subquery(latest.values('details__note')[:1]),
        latest_review_actor_email=Subquery(latest.values('actor__email')[:1]),
    )
