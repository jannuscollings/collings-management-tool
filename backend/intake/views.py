from django.db import transaction
from django.shortcuts import get_object_or_404
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from .models import WorkRequest
from .serializers import (
    WorkRequestSerializer,
    WorkRequestTriageSerializer,
    WorkRequestWriteSerializer,
)
from .services import RequestAcceptanceError, accept_work_request


class WorkRequestViewSet(
    mixins.CreateModelMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    viewsets.GenericViewSet,
):
    queryset = WorkRequest.objects.select_related(
        "submitted_by",
        "destination_group",
        "destination_group__workspace",
        "owner",
        "reviewer",
        "resulting_work_item",
        "resulting_work_item__group",
        "resulting_work_item__group__workspace",
        "accepted_by",
    )

    def get_queryset(self):
        queryset = super().get_queryset()
        request_status = self.request.query_params.get("status")
        if request_status in WorkRequest.Status.values:
            queryset = queryset.filter(status=request_status)
        return queryset

    def get_serializer_class(self):
        if self.action in ("create", "update", "partial_update"):
            return WorkRequestWriteSerializer
        if self.action == "triage":
            return WorkRequestTriageSerializer
        return WorkRequestSerializer

    def perform_create(self, serializer):
        serializer.save(submitted_by=self.request.user)

    def get_locked_object(self):
        queryset = self.filter_queryset(self.get_queryset().select_for_update())
        work_request = get_object_or_404(queryset, pk=self.kwargs["pk"])
        self.check_object_permissions(self.request, work_request)
        return work_request

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        work_request = self.get_queryset().get(pk=serializer.instance.pk)
        return Response(
            WorkRequestSerializer(work_request, context=self.get_serializer_context()).data,
            status=status.HTTP_201_CREATED,
        )

    @transaction.atomic
    def update(self, request, *args, **kwargs):
        work_request = self.get_locked_object()
        if work_request.status != WorkRequest.Status.NEW:
            return Response(
                {"detail": "Only new requests can be edited."},
                status=status.HTTP_409_CONFLICT,
            )
        response = super().update(request, *args, **kwargs)
        work_request.refresh_from_db()
        response.data = WorkRequestSerializer(work_request, context=self.get_serializer_context()).data
        return response

    @action(detail=True, methods=("post",))
    @transaction.atomic
    def triage(self, request, pk=None):
        work_request = self.get_locked_object()
        if work_request.status not in (WorkRequest.Status.NEW, WorkRequest.Status.TRIAGING):
            return Response(
                {"detail": "Accepted and rejected requests cannot be triaged."},
                status=status.HTTP_409_CONFLICT,
            )

        serializer = self.get_serializer(work_request, data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(status=WorkRequest.Status.TRIAGING)
        work_request.refresh_from_db()
        return Response(WorkRequestSerializer(work_request, context=self.get_serializer_context()).data)

    @action(detail=True, methods=("post",))
    def accept(self, request, pk=None):
        try:
            work_request, created = accept_work_request(pk, request.user)
        except WorkRequest.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)
        except RequestAcceptanceError as error:
            return Response({"detail": str(error)}, status=status.HTTP_409_CONFLICT)

        work_request = self.get_queryset().get(pk=work_request.pk)
        return Response(
            WorkRequestSerializer(work_request, context=self.get_serializer_context()).data,
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )

    @action(detail=True, methods=("post",))
    @transaction.atomic
    def reject(self, request, pk=None):
        work_request = self.get_locked_object()
        if work_request.status not in (WorkRequest.Status.NEW, WorkRequest.Status.TRIAGING):
            return Response(
                {"detail": "Only new or triaging requests can be rejected."},
                status=status.HTTP_409_CONFLICT,
            )
        if work_request.resulting_work_item_id:
            return Response(
                {"detail": "A request with a work item cannot be rejected."},
                status=status.HTTP_409_CONFLICT,
            )
        work_request.status = WorkRequest.Status.REJECTED
        work_request.save(update_fields=("status", "updated_at"))
        return Response(WorkRequestSerializer(work_request, context=self.get_serializer_context()).data)
