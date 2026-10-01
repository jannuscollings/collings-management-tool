from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from work.models import WorkActivity, WorkItem, Workspace


@override_settings(SECURE_SSL_REDIRECT=False)
class SchedulingTests(TestCase):
    def setUp(self):
        User = get_user_model()
        self.admin = User.objects.create_user(email="schedule-admin@test.test", is_staff=True)
        self.owner = User.objects.create_user(email="schedule-owner@test.test")
        self.group = Workspace.objects.get(slug="creative-design").groups.first()
        self.client = APIClient()
        self.client.force_authenticate(self.admin)

    def create(self, **dates):
        return self.client.post("/api/work-items/", {"group": self.group.pk, "title": "Schedule", **dates}, format="json")

    def patch(self, item_id, **dates):
        return self.client.patch(f"/api/work-items/{item_id}/", dates, format="json")

    def test_create_due_only_and_unscheduled(self):
        due_only = self.create(due_date="2026-10-10")
        unscheduled = self.create()
        self.assertEqual(due_only.status_code, 201)
        self.assertIsNone(due_only.data["start_date"])
        self.assertEqual(due_only.data["due_date"], "2026-10-10")
        self.assertEqual(unscheduled.status_code, 201)
        self.assertIsNone(unscheduled.data["start_date"])
        self.assertIsNone(unscheduled.data["due_date"])

    def test_create_start_due_and_equal_dates(self):
        for start, due in (("2026-10-01", "2026-10-10"), ("2026-10-10", "2026-10-10")):
            with self.subTest(start=start):
                response = self.create(start_date=start, due_date=due)
                self.assertEqual(response.status_code, 201)
                self.assertEqual(response.data["start_date"], start)
                event = WorkActivity.objects.get(work_item_id=response.data["id"], event="start_date_added")
                self.assertEqual(event.details, {"before": None, "after": start})

    def test_invalid_create_dates(self):
        missing_due = self.create(start_date="2026-10-01")
        reversed_dates = self.create(start_date="2026-10-11", due_date="2026-10-10")
        self.assertEqual(missing_due.status_code, 400)
        self.assertIn("due_date", missing_due.data)
        self.assertEqual(reversed_dates.status_code, 400)
        self.assertIn("start_date", reversed_dates.data)
        self.assertFalse(WorkItem.objects.filter(title="Schedule").exists())

    def test_partial_updates_validate_resulting_state_and_activity(self):
        created = self.create(due_date="2026-10-10")
        item_id = created.data["id"]
        added = self.patch(item_id, start_date="2026-10-01")
        self.assertEqual(added.status_code, 200)
        self.assertEqual(added.data["start_date"], "2026-10-01")
        changed = self.patch(item_id, start_date="2026-10-02")
        self.assertEqual(changed.status_code, 200)
        self.assertEqual(self.patch(item_id, due_date=None).status_code, 400)
        self.assertEqual(self.patch(item_id, start_date="2026-10-11").status_code, 400)
        item = WorkItem.objects.get(pk=item_id)
        self.assertEqual(str(item.start_date), "2026-10-02")
        self.assertEqual(str(item.due_date), "2026-10-10")
        cleared = self.patch(item_id, start_date=None)
        self.assertEqual(cleared.status_code, 200)
        self.assertIsNone(cleared.data["start_date"])
        self.assertEqual(self.patch(item_id, start_date="2026-10-03").status_code, 200)
        both = self.patch(item_id, start_date=None, due_date=None)
        self.assertEqual(both.status_code, 200)
        self.assertIsNone(both.data["start_date"])
        self.assertIsNone(both.data["due_date"])
        self.assertEqual(list(WorkActivity.objects.filter(work_item_id=item_id, event__startswith="start_date_").order_by("pk").values_list("event", flat=True)),
                         ["start_date_added", "start_date_changed", "start_date_cleared", "start_date_added", "start_date_cleared"])
        self.assertEqual(WorkActivity.objects.filter(work_item_id=item_id, event="due_date_changed").count(), 1)

    def test_start_permissions_match_due_permissions(self):
        item = WorkItem.objects.create(group=self.group, title="Owned", owner=self.owner, created_by=self.admin,
                                       due_date="2026-10-10")
        self.client.force_authenticate(self.owner)
        url = f"/api/work-items/{item.pk}/"
        for field, value in (("start_date", "2026-10-01"), ("due_date", "2026-10-11")):
            with self.subTest(field=field):
                response = self.client.patch(url, {field: value}, format="json")
                self.assertEqual(response.status_code, 403)
        self.assertEqual(self.client.get(url).data["start_date"], None)
        item.refresh_from_db()
        self.assertIsNone(item.start_date)
        self.assertEqual(str(item.due_date), "2026-10-10")
