from django.db.models import Q


def is_admin(user):
    return user.is_authenticated and (user.is_staff or user.is_superuser)


def visible_items(queryset, user):
    if is_admin(user):
        return queryset
    return queryset.filter(
        Q(owner=user) | Q(reviewer=user) | Q(sub_work__assignee=user),
        group__archived=False, group__workspace__archived=False,
    ).distinct()


def can_edit(item, user):
    return is_admin(user) or item.owner_id == user.pk


def allowed_statuses(item, user):
    if not can_edit(item, user) or item.status == 'review':
        return [item.status]
    statuses = ['new', 'in_progress']
    if item.reviewer_id and item.reviewer.is_active:
        statuses.append('review')
    elif not item.reviewer_id:
        statuses.append('done')
    return list(dict.fromkeys([item.status, *statuses]))
