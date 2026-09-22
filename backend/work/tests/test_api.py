from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.test import TestCase, override_settings
from rest_framework import status
from rest_framework.test import APIClient

from work.models import WorkGroup, WorkItem, Workspace

User = get_user_model()


@override_settings(SECURE_SSL_REDIRECT=False)
class WorkApiTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(email="creator@example.com", password="password123")
        self.assignee = User.objects.create_user(email="owner@example.com", password="password123")
        self.workspace = Workspace.objects.get(slug="creative-design")
        self.group = self.workspace.groups.get(name="Property launch")
        self.client = APIClient()

    def test_workspace_requires_authentication(self):
        response = self.client.get("/api/workspaces/creative-design/")

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_workspace_returns_seeded_groups(self):
        self.client.force_authenticate(self.user)

        response = self.client.get("/api/workspaces/creative-design/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            [group["name"] for group in response.data["groups"]],
            ["Property launch", "Campaign content", "Ongoing requests"],
        )

    def test_create_stamps_creator_and_generates_stable_reference(self):
        self.client.force_authenticate(self.user)

        response = self.client.post(
            "/api/work-items/",
            {
                "group": self.group.pk,
                "title": "Create auction social tiles",
                "brief": "Produce three sizes.",
                "priority": "high",
                "owner": self.assignee.pk,
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        item = WorkItem.objects.get(pk=response.data["id"])
        self.assertEqual(item.created_by, self.user)
        self.assertEqual(item.reference, f"WI-{item.pk:06d}")
        self.assertEqual(response.data["workspace_slug"], "creative-design")

        original_reference = item.reference
        item.title = "Updated title"
        item.save()
        item.refresh_from_db()
        self.assertEqual(item.reference, original_reference)

    def test_update_accepts_active_assignee_and_rejects_inactive_assignee(self):
        item = WorkItem.objects.create(
            group=self.group,
            title="Update brochure",
            created_by=self.user,
        )
        inactive = User.objects.create_user(
            email="inactive@example.com",
            password="password123",
            is_active=False,
        )
        self.client.force_authenticate(self.user)

        accepted = self.client.patch(
            f"/api/work-items/{item.pk}/",
            {"owner": self.assignee.pk},
            format="json",
        )
        rejected = self.client.patch(
            f"/api/work-items/{item.pk}/",
            {"owner": inactive.pk},
            format="json",
        )

        self.assertEqual(accepted.status_code, status.HTTP_200_OK)
        self.assertEqual(rejected.status_code, status.HTTP_400_BAD_REQUEST)

    def test_delete_is_not_exposed(self):
        item = WorkItem.objects.create(
            group=self.group,
            title="Keep this item",
            created_by=self.user,
        )
        self.client.force_authenticate(self.user)

        response = self.client.delete(f"/api/work-items/{item.pk}/")

        self.assertEqual(response.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)
        self.assertTrue(WorkItem.objects.filter(pk=item.pk).exists())

    def test_seed_demo_is_idempotent_for_work_items(self):
        call_command("seed_demo", verbosity=0)
        call_command("seed_demo", verbosity=0)

        self.assertEqual(Workspace.objects.filter(slug="creative-design").count(), 1)
        self.assertEqual(
            WorkGroup.objects.filter(workspace__slug="creative-design").count(),
            3,
        )
        self.assertEqual(
            WorkItem.objects.filter(group__workspace__slug="creative-design").count(),
            3,
        )
