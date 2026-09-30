from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from intake.models import WorkRequest
from work.models import (Notification, SubWork, WorkActivity, WorkComment,
                         WorkCommentAttachment, WorkGroup, WorkItem, WorkLink, Workspace)


@override_settings(SECURE_SSL_REDIRECT=False)
class ArchiveApiTests(TestCase):
    def setUp(self):
        User = get_user_model()
        self.admin = User.objects.create_user(email="archive-admin@example.com", is_staff=True)
        self.staff = User.objects.create_user(email="archive-staff@example.com")
        self.workspace = Workspace.objects.create(name="Production", slug="production")
        self.board = WorkGroup.objects.create(workspace=self.workspace, name="Delivery")
        self.item = WorkItem.objects.create(group=self.board, title="Launch", owner=self.staff,
                                            reviewer=self.staff, created_by=self.admin)
        self.sub = SubWork.objects.create(work_item=self.item, title="Prepare", assignee=self.staff,
                                          created_by=self.admin)
        self.comment = WorkComment.objects.create(work_item=self.item, author=self.staff, body="Update")
        self.reply = WorkComment.objects.create(work_item=self.item, author=self.admin,
                                                parent=self.comment, body="Reply")
        self.attachment = WorkCommentAttachment.objects.create(
            comment=self.comment, file="discussion/keep.png", filename="keep.png",
            content_type="image/png", size=4)
        self.activity = WorkActivity.objects.create(work_item=self.item, actor=self.admin, event="created")
        self.link = WorkLink.objects.create(work_item=self.item, label="Brief",
                                            url="https://example.com/brief", created_by=self.admin)
        self.notification = Notification.objects.create(recipient=self.staff, event="assigned", work_item=self.item)
        self.admin_notification = Notification.objects.create(recipient=self.admin, event="assigned", work_item=self.item)
        self.request = WorkRequest.objects.create(
            title="Launch request", submitted_by=self.staff, status=WorkRequest.Status.ACCEPTED,
            destination_group=self.board, resulting_work_item=self.item)
        self.client = APIClient()
        self.board_url = f"/api/workspaces/{self.workspace.slug}/boards/{self.board.pk}/"
        self.item_url = f"/api/work-items/{self.item.pk}/"

    def authenticate(self, user):
        self.client.force_authenticate(user)

    def assert_related_records(self):
        self.item.refresh_from_db()
        self.request.refresh_from_db()
        self.assertEqual(self.item.reference, f"WI-{self.item.pk:06d}")
        self.assertEqual(self.request.reference, f"WR-{self.request.pk:06d}")
        self.assertEqual(self.request.resulting_work_item_id, self.item.pk)
        self.assertEqual(self.request.destination_group_id, self.board.pk)
        for model, pk in ((SubWork, self.sub.pk), (WorkComment, self.comment.pk),
                          (WorkComment, self.reply.pk), (WorkCommentAttachment, self.attachment.pk),
                          (WorkActivity, self.activity.pk), (WorkLink, self.link.pk),
                          (Notification, self.notification.pk), (Notification, self.admin_notification.pk)):
            self.assertTrue(model.objects.filter(pk=pk).exists())

    def assert_hidden_everywhere(self):
        self.board.refresh_from_db()
        self.workspace.refresh_from_db()
        for user in (self.admin, self.staff):
            self.authenticate(user)
            self.assertNotIn(self.item.pk, [row["id"] for row in self.client.get("/api/work-items/").data])
            self.assertNotIn(self.item.pk, [row["id"] for row in self.client.get(
                "/api/work-items/", {"relevance": "mine"}).data])
            workspace = self.client.get(f"/api/workspaces/{self.workspace.slug}/")
            if workspace.status_code == 200:
                self.assertNotIn(self.item.pk, [row["id"] for group in workspace.data["groups"]
                                                 for row in group["work_items"]])
            home = self.client.get("/api/home/").data
            for section in (value for value in home.values() if isinstance(value, dict) and "items" in value):
                self.assertNotIn(self.item.pk, [row["id"] for row in section["items"]
                                                 if row.get("reference", "").startswith("WI-")])
            search = self.client.get("/api/search/", {"q": self.item.reference}).data
            self.assertEqual(search["results"]["workItems"], [])
            if self.board.archived:
                self.assertEqual(self.client.get("/api/search/", {"q": self.board.name}).data["results"]["boards"], [])
            if self.workspace.archived:
                self.assertEqual(self.client.get("/api/search/", {"q": self.workspace.name}).data["results"]["workspaces"], [])
            self.assertEqual(self.client.get(self.item_url).status_code, 404)
            for suffix in ("comments/", "activity/", "sub-work/", "links/",
                           f"comments/{self.comment.pk}/attachments/{self.attachment.pk}/"):
                self.assertEqual(self.client.get(self.item_url + suffix).status_code, 404)
            self.assertEqual(self.client.patch(self.item_url, {"title": "Changed"}).status_code, 404)
            self.assertEqual(self.client.post(self.item_url + "comments/", {"body": "Changed"}).status_code, 404)
            self.assertEqual(self.client.post(self.item_url + "review/", {"decision": "approve"}).status_code, 404)
            inbox = self.client.get("/api/notifications/").data
            self.assertNotIn(self.notification.pk, [row["id"] for row in inbox["items"]])
            self.assertNotIn(self.admin_notification.pk, [row["id"] for row in inbox["items"]])
            request_detail = self.client.get(f"/api/requests/{self.request.pk}/").data
            self.assertEqual(request_detail["resulting_work_item_detail"]["reference"], self.item.reference)
            self.assertFalse(request_detail["can_view_resulting_work_item"])
            self.assertTrue(request_detail["resulting_work_item_archived"])

    def test_staff_cannot_manage_or_list_archive(self):
        self.authenticate(self.staff)
        for url in ("/api/archive/",):
            self.assertEqual(self.client.get(url).status_code, 403)
        for url in (self.board_url + "archive/", self.board_url + "restore/",
                    self.item_url + "archive/", self.item_url + "restore/",
                    f"/api/workspaces/{self.workspace.slug}/restore/"):
            self.assertEqual(self.client.post(url).status_code, 403)
        self.assertFalse(WorkItem.objects.get(pk=self.item.pk).archived)
        self.assertFalse(WorkGroup.objects.get(pk=self.board.pk).archived)

    def test_board_archive_preserves_work_and_last_board_can_restore(self):
        self.authenticate(self.admin)
        self.assertEqual(self.client.post(self.board_url + "archive/").status_code, 200)
        self.board.refresh_from_db()
        self.assertTrue(self.board.archived)
        self.assertEqual(self.client.get(f"/api/workspaces/{self.workspace.slug}/").data["groups"], [])
        self.assert_related_records()
        self.assert_hidden_everywhere()
        self.authenticate(self.admin)
        archive = self.client.get("/api/archive/").data
        self.assertEqual([row["id"] for row in archive["boards"]], [self.board.pk])
        self.assertEqual(archive["work_items"], [])
        self.assertEqual(self.client.post(self.board_url + "restore/").status_code, 200)
        self.assertTrue(self.client.get(self.item_url).status_code == 200)

    def test_work_item_archive_preserves_data_and_independent_restore(self):
        self.authenticate(self.admin)
        self.assertEqual(self.client.post(self.item_url + "archive/").status_code, 200)
        self.assert_related_records()
        self.assert_hidden_everywhere()
        self.authenticate(self.admin)
        archive = self.client.get("/api/archive/").data
        self.assertEqual([row["id"] for row in archive["work_items"]], [self.item.pk])
        self.assertEqual(self.item.activity.filter(event="archived").count(), 1)
        self.assertEqual(self.client.post(self.item_url + "archive/").status_code, 200)
        self.assertEqual(self.item.activity.filter(event="archived").count(), 1)
        self.assertEqual(self.client.post(self.board_url + "archive/").status_code, 200)
        self.assertEqual(self.client.post(self.board_url + "restore/").status_code, 200)
        self.assertEqual(self.client.get(self.item_url).status_code, 404)
        self.assertEqual(self.client.post(self.board_url + "archive/").status_code, 200)
        self.assertEqual(self.client.post(self.item_url + "restore/").status_code, 200)
        self.assertEqual(self.item.activity.filter(event="restored").count(), 1)
        self.assertEqual(self.client.get(self.item_url).status_code, 404)
        self.assertEqual(self.client.post(self.board_url + "restore/").status_code, 200)
        self.assertEqual(self.client.get(self.item_url).status_code, 200)
        self.authenticate(self.staff)
        self.assertEqual(self.client.get(self.item_url).status_code, 200)
        self.assertIn(self.item.pk, [row["id"] for row in self.client.get("/api/work-items/", {"relevance": "mine"}).data])
        self.assertEqual(self.client.get("/api/notifications/").data["unread_count"], 1)
        detail = self.client.get(f"/api/requests/{self.request.pk}/").data
        self.assertTrue(detail["can_view_resulting_work_item"])
        self.assertFalse(detail["resulting_work_item_archived"])

    def test_workspace_archive_hides_admin_work_and_restoring_item_keeps_parent_gate(self):
        self.authenticate(self.admin)
        self.assertEqual(self.client.post(f"/api/workspaces/{self.workspace.slug}/archive/").status_code, 200)
        self.assertEqual(self.client.get(f"/api/workspaces/{self.workspace.slug}/").status_code, 404)
        self.assert_hidden_everywhere()
        self.authenticate(self.admin)
        self.assertEqual([row["id"] for row in self.client.get("/api/archive/").data["workspaces"]], [self.workspace.pk])
        self.assertEqual(self.client.post(self.board_url + "archive/").status_code, 200)
        self.assertEqual(self.client.post(self.board_url + "restore/").status_code, 200)
        self.assertEqual(self.client.get(self.item_url).status_code, 404)
        self.assertEqual(self.client.post(self.item_url + "archive/").status_code, 200)
        self.assertEqual(self.client.post(self.item_url + "restore/").status_code, 200)
        self.assertEqual(self.client.get(self.item_url).status_code, 404)
        self.assertEqual(self.client.post(f"/api/workspaces/{self.workspace.slug}/restore/").status_code, 200)
        self.assertEqual(self.client.get(self.item_url).status_code, 200)
