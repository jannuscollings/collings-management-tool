"""Small, permission-scoped global search previews."""

import re
from html import unescape

from django.db.models import Case, IntegerField, Q, Value, When
from django.utils.html import strip_tags
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from intake.models import WorkRequest

from .access import is_admin, visible_items
from .models import WorkGroup, WorkItem, Workspace


LIMIT = 6
MAX_QUERY_LENGTH = 120
VALID_TYPES = {"work-items", "requests", "places"}


def plain_text(value):
    return " ".join(unescape(strip_tags(value or "")).split())


def excerpt(value, query):
    content = plain_text(value)
    match = content.casefold().find(query.casefold())
    if match < 0:
        return None
    start = max(0, match - 48)
    end = min(len(content), match + len(query) + 64)
    return ("…" if start else "") + content[start:end] + ("…" if end < len(content) else "")


def ranked(queryset, query, name_field, description_field=None, reference_field=None):
    conditions = Q(**{f"{name_field}__icontains": query})
    if reference_field:
        conditions |= Q(**{f"{reference_field}__icontains": query})
    if description_field:
        # Fetch by the first word, then verify against sanitized text below.
        # This also finds phrases split by stored markup.
        conditions |= Q(**{f"{description_field}__icontains": query.split()[0]})
    ranking = []
    if reference_field:
        ranking.append(When(**{f"{reference_field}__iexact": query}, then=Value(0)))
    ranking.extend([
        When(**{f"{name_field}__iexact": query}, then=Value(1)),
        When(**{f"{name_field}__istartswith": query}, then=Value(2)),
        When(**{f"{name_field}__icontains": query}, then=Value(3)),
    ])
    if reference_field:
        ranking.append(When(**{f"{reference_field}__icontains": query}, then=Value(4)))
    return queryset.filter(conditions).annotate(
        search_rank=Case(*ranking, default=Value(5), output_field=IntegerField())
    ).order_by("search_rank", "pk")


class SearchView(APIView):
    def get(self, request):
        raw_query = request.query_params.get("q", "")
        if not isinstance(raw_query, str):
            raise ValidationError({"q": "Enter one search query."})
        query = " ".join(raw_query.split())
        if len(query) > MAX_QUERY_LENGTH:
            raise ValidationError({"q": f"Use {MAX_QUERY_LENGTH} characters or fewer."})
        reference_prefix = bool(re.match(r"^(?:WI|WR)-", query, re.IGNORECASE))
        if len(query) < 2 and not reference_prefix:
            raise ValidationError({"q": "Enter at least 2 characters."})
        types_param = request.query_params.get("types")
        types = set(types_param.split(",")) if types_param else VALID_TYPES
        if not types or not types <= VALID_TYPES:
            raise ValidationError({"types": "Choose work-items, requests, or places."})

        results = {key: [] for key in ("workItems", "requests", "workspaces", "boards")}
        counts = {key: 0 for key in results}
        user = request.user

        if "work-items" in types:
            visible = visible_items(WorkItem.objects.select_related("group__workspace", "owner"), user)
            matches = ranked(visible, query, "title", "brief", "reference")
            for item in matches.iterator(chunk_size=200):
                if item.search_rank == 5 and query.casefold() not in plain_text(item.brief).casefold():
                    continue
                counts["workItems"] += 1
                if len(results["workItems"]) >= LIMIT:
                    continue
                results["workItems"].append({
                    "id": item.pk, "reference": item.reference, "title": item.title,
                    "workspaceName": item.group.workspace.name,
                    "workspaceSlug": item.group.workspace.slug,
                    "boardName": item.group.name,
                    "status": item.status, "priority": item.priority,
                    "owner": item.owner.get_full_name() or item.owner.email if item.owner else None,
                    "dueDate": item.due_date,
                    "excerpt": excerpt(item.brief, query) if item.search_rank == 5 else None,
                })

        if "requests" in types:
            visible = WorkRequest.objects.select_related("submitted_by", "destination_group__workspace")
            if not is_admin(user):
                visible = visible.filter(submitted_by=user)
            matches = ranked(visible, query, "title", "brief", "reference")
            for work_request in matches.iterator(chunk_size=200):
                if work_request.search_rank == 5 and query.casefold() not in plain_text(work_request.brief).casefold():
                    continue
                counts["requests"] += 1
                if len(results["requests"]) >= LIMIT:
                    continue
                destination = work_request.destination_group if work_request.status == WorkRequest.Status.ACCEPTED else None
                results["requests"].append({
                    "id": work_request.pk, "reference": work_request.reference,
                    "title": work_request.title, "status": work_request.status,
                    "requester": work_request.submitted_by.get_full_name() or work_request.submitted_by.email,
                    "workspaceName": destination.workspace.name if destination else None,
                    "boardName": destination.name if destination else None,
                    "excerpt": excerpt(work_request.brief, query) if work_request.search_rank == 5 else None,
                })

        if "places" in types:
            workspaces = ranked(Workspace.objects.filter(archived=False), query, "name")
            counts["workspaces"] = workspaces.count()
            results["workspaces"] = [
                {"id": workspace.pk, "name": workspace.name, "slug": workspace.slug}
                for workspace in workspaces[:LIMIT]
            ]
            boards = ranked(WorkGroup.objects.select_related("workspace").filter(
                archived=False, workspace__archived=False
            ), query, "name")
            counts["boards"] = boards.count()
            results["boards"] = [
                {"id": board.pk, "name": board.name,
                 "workspaceName": board.workspace.name, "workspaceSlug": board.workspace.slug}
                for board in boards[:LIMIT]
            ]

        return Response({"query": query, "results": results, "counts": counts})
