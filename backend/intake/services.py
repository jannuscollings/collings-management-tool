from django.contrib.auth import get_user_model
from django.db import transaction
from django.utils import timezone

from work.models import WorkGroup, WorkItem
from work.services import record_activity
from work.notifications import notify, assignment_notifications

from .models import WorkRequest

User = get_user_model()


class RequestAcceptanceError(Exception):
    pass


@transaction.atomic
def accept_work_request(request_id, actor):
    work_request = (
        WorkRequest.objects.select_for_update(of=("self",))
        .select_related("resulting_work_item")
        .get(pk=request_id)
    )

    if work_request.status == WorkRequest.Status.ACCEPTED:
        if work_request.resulting_work_item_id:
            return work_request, False
        raise RequestAcceptanceError("Accepted request has no resulting work item.")

    if work_request.resulting_work_item_id:
        raise RequestAcceptanceError("Request has a work item but is not accepted.")

    if work_request.status != WorkRequest.Status.TRIAGING:
        raise RequestAcceptanceError("Only a request in triage can be accepted.")

    if not work_request.destination_group_id:
        raise RequestAcceptanceError("Choose a destination group before accepting.")

    destination_group = (
        WorkGroup.objects.select_for_update()
        .select_related("workspace")
        .get(pk=work_request.destination_group_id)
    )
    if destination_group.archived or destination_group.workspace.archived:
        raise RequestAcceptanceError("The destination group or workspace is archived.")
    if destination_group.workspace.slug != "creative-design":
        raise RequestAcceptanceError("This request slice only supports Creative & Design.")

    assigned_user_ids = {
        user_id
        for user_id in (work_request.owner_id, work_request.reviewer_id)
        if user_id is not None
    }
    users_by_id = {
        user.pk: user
        for user in User.objects.select_for_update()
        .filter(pk__in=assigned_user_ids)
        .order_by("pk")
    }
    assigned_users = {}
    for field_name in ("owner", "reviewer"):
        user_id = getattr(work_request, f"{field_name}_id")
        user = users_by_id.get(user_id) if user_id is not None else None
        if user_id is not None and user is None:
            raise RequestAcceptanceError(f"The selected {field_name} no longer exists.")
        if user is not None and not user.is_active:
            raise RequestAcceptanceError(f"The selected {field_name} is inactive.")
        assigned_users[field_name] = user

    work_item = WorkItem.objects.create(
        group=destination_group,
        title=work_request.title,
        brief=work_request.brief,
        status=WorkItem.Status.NEW,
        priority=work_request.triage_priority or work_request.priority,
        due_date=work_request.triage_due_date or work_request.requested_due_date,
        owner=assigned_users["owner"],
        reviewer=assigned_users["reviewer"],
        created_by=actor,
    )

    record_activity(work_item, actor, "created", request=work_request.reference)
    work_request.resulting_work_item = work_item
    work_request.status = WorkRequest.Status.ACCEPTED
    work_request.accepted_by = actor
    work_request.accepted_at = timezone.now()
    work_request.save(
        update_fields=(
            "resulting_work_item",
            "status",
            "accepted_by",
            "accepted_at",
            "updated_at",
        )
    )
    assignment_notifications(work_item, actor)
    notify(actor, work_request.submitted_by_id, "request_accepted", work_request=work_request)
    return work_request, True
