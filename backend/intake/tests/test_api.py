from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.test import TestCase, override_settings
from rest_framework import status
from rest_framework.test import APIClient

from intake.models import WorkRequest
from intake.services import accept_work_request
from work.models import WorkItem, Workspace

User = get_user_model()


@override_settings(SECURE_SSL_REDIRECT=False)
class WorkRequestApiTests(TestCase):
    def setUp(self):
        self.submitter = User.objects.create_user(
            email="submitter@example.com",
            password="password123",
        )
        self.triager = User.objects.create_user(
            email="triager@example.com",
            password="password123",
        )
        self.owner = User.objects.create_user(
            email="owner@example.com",
            password="password123",
        )
        self.reviewer = User.objects.create_user(
            email="reviewer@example.com",
            password="password123",
        )
        self.workspace = Workspace.objects.get(slug="creative-design")
        self.group = self.workspace.groups.get(name="Campaign content")
        self.client = APIClient()

    def request_payload(self, **overrides):
        payload = {
            "title": "Prepare spring campaign artwork",
            "brief": "Create social and display assets.",
            "request_type": WorkRequest.RequestType.CREATIVE_DESIGN,
            "priority": WorkRequest.Priority.MEDIUM,
            "requested_due_date": "2026-10-20",
        }
        payload.update(overrides)
        return payload

    def create_request(self, **overrides):
        return WorkRequest.objects.create(
            submitted_by=self.submitter,
            **self.request_payload(**overrides),
        )

    def triage_request(self, work_request, **overrides):
        values = {
            "destination_group": self.group,
            "triage_priority": WorkRequest.Priority.HIGH,
            "triage_due_date": "2026-10-18",
            "owner": self.owner,
            "reviewer": self.reviewer,
            "status": WorkRequest.Status.TRIAGING,
        }
        values.update(overrides)
        for field_name, value in values.items():
            setattr(work_request, field_name, value)
        work_request.save()
        return work_request

    def test_request_endpoints_require_authentication(self):
        work_request = self.create_request()

        responses = (
            self.client.get("/api/requests/"),
            self.client.post("/api/requests/", self.request_payload(), format="json"),
            self.client.get(f"/api/requests/{work_request.pk}/"),
            self.client.post(f"/api/requests/{work_request.pk}/accept/"),
        )

        self.assertTrue(
            all(response.status_code == status.HTTP_401_UNAUTHORIZED for response in responses)
        )

    def test_submission_stamps_user_and_generates_immutable_reference(self):
        self.client.force_authenticate(self.submitter)
        payload = self.request_payload()
        payload.update({"status": "accepted", "submitted_by": self.triager.pk})

        response = self.client.post("/api/requests/", payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        work_request = WorkRequest.objects.get(pk=response.data["id"])
        self.assertEqual(work_request.submitted_by, self.submitter)
        self.assertEqual(work_request.status, WorkRequest.Status.NEW)
        self.assertEqual(work_request.reference, f"WR-{work_request.pk:06d}")

        original_reference = work_request.reference
        work_request.reference = "WR-999999"
        work_request.save()
        work_request.refresh_from_db()
        self.assertEqual(work_request.reference, original_reference)

    def test_new_request_can_be_edited(self):
        work_request = self.create_request()
        self.client.force_authenticate(self.submitter)

        response = self.client.patch(
            f"/api/requests/{work_request.pk}/",
            {"title": "Updated request title"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["title"], "Updated request title")

    def test_triage_validates_destination_and_active_users(self):
        work_request = self.create_request()
        inactive_user = User.objects.create_user(
            email="inactive@example.com",
            password="password123",
            is_active=False,
        )
        self.group.archived = True
        self.group.save()
        self.client.force_authenticate(self.triager)

        archived_response = self.client.post(
            f"/api/requests/{work_request.pk}/triage/",
            {"destination_group": self.group.pk},
            format="json",
        )
        self.group.archived = False
        self.group.save()
        inactive_response = self.client.post(
            f"/api/requests/{work_request.pk}/triage/",
            {"destination_group": self.group.pk, "owner": inactive_user.pk},
            format="json",
        )

        self.assertEqual(archived_response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(inactive_response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_triage_preserves_original_values_and_sets_status(self):
        work_request = self.create_request()
        self.client.force_authenticate(self.triager)

        response = self.client.post(
            f"/api/requests/{work_request.pk}/triage/",
            {
                "destination_group": self.group.pk,
                "triage_priority": "high",
                "triage_due_date": "2026-10-18",
                "owner": self.owner.pk,
                "reviewer": self.reviewer.pk,
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        work_request.refresh_from_db()
        self.assertEqual(work_request.status, WorkRequest.Status.TRIAGING)
        self.assertEqual(work_request.priority, WorkRequest.Priority.MEDIUM)
        self.assertEqual(str(work_request.requested_due_date), "2026-10-20")
        self.assertEqual(work_request.triage_priority, WorkRequest.Priority.HIGH)
        self.assertEqual(str(work_request.triage_due_date), "2026-10-18")

    def test_acceptance_copies_fields_and_attributes_accepting_user(self):
        work_request = self.triage_request(self.create_request())
        self.client.force_authenticate(self.triager)

        response = self.client.post(f"/api/requests/{work_request.pk}/accept/")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        work_request.refresh_from_db()
        item = work_request.resulting_work_item
        self.assertEqual(work_request.status, WorkRequest.Status.ACCEPTED)
        self.assertEqual(work_request.accepted_by, self.triager)
        self.assertIsNotNone(work_request.accepted_at)
        self.assertEqual(item.title, work_request.title)
        self.assertEqual(item.brief, work_request.brief)
        self.assertEqual(item.group, self.group)
        self.assertEqual(item.status, WorkItem.Status.NEW)
        self.assertEqual(item.priority, WorkItem.Priority.HIGH)
        self.assertEqual(str(item.due_date), "2026-10-18")
        self.assertEqual(item.owner, self.owner)
        self.assertEqual(item.reviewer, self.reviewer)
        self.assertEqual(item.created_by, self.triager)

    def test_acceptance_uses_submitted_values_without_overrides(self):
        work_request = self.triage_request(
            self.create_request(priority="low", requested_due_date="2026-11-01"),
            triage_priority=None,
            triage_due_date=None,
        )
        self.client.force_authenticate(self.triager)

        response = self.client.post(f"/api/requests/{work_request.pk}/accept/")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        work_request.refresh_from_db()
        self.assertEqual(work_request.resulting_work_item.priority, WorkItem.Priority.LOW)
        self.assertEqual(str(work_request.resulting_work_item.due_date), "2026-11-01")

    def test_repeated_accept_returns_existing_item(self):
        work_request = self.triage_request(self.create_request())
        self.client.force_authenticate(self.triager)

        first = self.client.post(f"/api/requests/{work_request.pk}/accept/")
        second = self.client.post(f"/api/requests/{work_request.pk}/accept/")

        self.assertEqual(first.status_code, status.HTTP_201_CREATED)
        self.assertEqual(second.status_code, status.HTTP_200_OK)
        self.assertEqual(
            first.data["resulting_work_item"],
            second.data["resulting_work_item"],
        )
        self.assertEqual(WorkItem.objects.count(), 1)

    def test_acceptance_rolls_back_created_item_when_request_save_fails(self):
        work_request = self.triage_request(self.create_request())

        with patch.object(WorkRequest, "save", side_effect=RuntimeError("save failed")):
            with self.assertRaises(RuntimeError):
                accept_work_request(work_request.pk, self.triager)

        work_request.refresh_from_db()
        self.assertEqual(work_request.status, WorkRequest.Status.TRIAGING)
        self.assertIsNone(work_request.resulting_work_item)
        self.assertEqual(WorkItem.objects.count(), 0)

    def test_acceptance_revalidates_archived_destination_and_inactive_users(self):
        archived_request = self.triage_request(self.create_request(title="Archived destination"))
        self.group.archived = True
        self.group.save()
        self.client.force_authenticate(self.triager)

        archived_response = self.client.post(
            f"/api/requests/{archived_request.pk}/accept/"
        )

        self.group.archived = False
        self.group.save()
        inactive_request = self.triage_request(self.create_request(title="Inactive owner"))
        self.owner.is_active = False
        self.owner.save()
        inactive_response = self.client.post(
            f"/api/requests/{inactive_request.pk}/accept/"
        )

        self.assertEqual(archived_response.status_code, status.HTTP_409_CONFLICT)
        self.assertEqual(inactive_response.status_code, status.HTTP_409_CONFLICT)
        self.assertEqual(WorkItem.objects.count(), 0)

    def test_rejected_request_cannot_be_accepted_or_edited(self):
        work_request = self.create_request()
        self.client.force_authenticate(self.triager)

        rejected = self.client.post(f"/api/requests/{work_request.pk}/reject/")
        accepted = self.client.post(f"/api/requests/{work_request.pk}/accept/")
        edited = self.client.patch(
            f"/api/requests/{work_request.pk}/",
            {"title": "Should not change"},
            format="json",
        )

        self.assertEqual(rejected.status_code, status.HTTP_200_OK)
        self.assertEqual(accepted.status_code, status.HTTP_409_CONFLICT)
        self.assertEqual(edited.status_code, status.HTTP_409_CONFLICT)
        self.assertEqual(WorkItem.objects.count(), 0)

    def test_accepted_request_cannot_be_edited_or_triaged(self):
        work_request = self.triage_request(self.create_request())
        accept_work_request(work_request.pk, self.triager)
        self.client.force_authenticate(self.triager)

        edited = self.client.patch(
            f"/api/requests/{work_request.pk}/",
            {"title": "Should not change"},
            format="json",
        )
        triaged = self.client.post(
            f"/api/requests/{work_request.pk}/triage/",
            {"destination_group": self.group.pk},
            format="json",
        )

        self.assertEqual(edited.status_code, status.HTTP_409_CONFLICT)
        self.assertEqual(triaged.status_code, status.HTTP_409_CONFLICT)

    def test_inconsistent_accepted_request_is_rejected(self):
        work_request = self.create_request()
        WorkRequest.objects.filter(pk=work_request.pk).update(status=WorkRequest.Status.ACCEPTED)
        self.client.force_authenticate(self.triager)

        response = self.client.post(f"/api/requests/{work_request.pk}/accept/")

        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)
        self.assertEqual(WorkItem.objects.count(), 0)

    def test_accepted_item_appears_in_existing_workspace_endpoint(self):
        work_request = self.triage_request(self.create_request())
        accepted_request, _ = accept_work_request(work_request.pk, self.triager)
        self.client.force_authenticate(self.triager)

        response = self.client.get("/api/workspaces/creative-design/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        item_ids = [
            item["id"]
            for group in response.data["groups"]
            for item in group["work_items"]
        ]
        self.assertIn(accepted_request.resulting_work_item_id, item_ids)

    def test_delete_is_not_exposed(self):
        work_request = self.create_request()
        self.client.force_authenticate(self.triager)

        response = self.client.delete(f"/api/requests/{work_request.pk}/")

        self.assertEqual(response.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)
        self.assertTrue(WorkRequest.objects.filter(pk=work_request.pk).exists())

    def test_seed_demo_is_idempotent_for_requests(self):
        call_command("seed_demo", verbosity=0)
        call_command("seed_demo", verbosity=0)

        self.assertEqual(WorkRequest.objects.count(), 2)
        self.assertEqual(
            WorkRequest.objects.filter(status=WorkRequest.Status.NEW).count(),
            1,
        )
        self.assertEqual(
            WorkRequest.objects.filter(status=WorkRequest.Status.TRIAGING).count(),
            1,
        )
