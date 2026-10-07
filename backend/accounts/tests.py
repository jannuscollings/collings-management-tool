from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from django.core.files.uploadedfile import SimpleUploadedFile
from io import BytesIO
from PIL import Image
from rest_framework.test import APIClient, APIRequestFactory, force_authenticate
from rest_framework.request import Request
from work.models import Workspace, WorkGroup, WorkItem, SubWork
from work.serializers import WorkItemSerializer, SubWorkSerializer, WorkUserSerializer
from accounts.serializers import PeopleSerializer


User = get_user_model()


def photo_file(format="JPEG", name="photo.jpg"):
    stream = BytesIO()
    Image.new("RGB", (640, 480), "#297b88").save(stream, format=format)
    return SimpleUploadedFile(name, stream.getvalue(), content_type={"JPEG": "image/jpeg", "PNG": "image/png", "WEBP": "image/webp"}[format])


@override_settings(SECURE_SSL_REDIRECT=False)
class SelfProfileApiTests(TestCase):
    def setUp(self):
        self.admin = User.objects.create_user(email="admin@example.com", password="password123", is_staff=True, job_title="Director")
        self.staff = User.objects.create_user(email="staff@example.com", password="password123", first_name="Sam", last_name="Staff")
        self.other = User.objects.create_user(email="other@example.com", password="password123")
        self.client = APIClient()

    def test_profile_requires_auth_and_persists_only_allowed_fields(self):
        self.assertEqual(self.client.get("/api/auth/me/").status_code, 401)
        self.assertEqual(self.client.get("/api/auth/me/photo/").status_code, 401)
        self.assertEqual(self.client.post("/api/auth/me/photo/", {"photo": photo_file()}, format="multipart").status_code, 401)
        self.client.force_authenticate(user=self.staff)
        response = self.client.get("/api/auth/me/")
        self.assertEqual(response.data["display_name"], "Sam Staff")
        self.assertFalse(response.data["has_photo"])
        response = self.client.patch("/api/auth/me/", {"first_name": "Alex", "last_name": "Designer", "bio": "Designs accessible campaigns."})
        self.assertEqual(response.status_code, 200, response.data)
        self.staff.refresh_from_db()
        self.assertEqual((self.staff.first_name, self.staff.last_name, self.staff.bio), ("Alex", "Designer", "Designs accessible campaigns."))
        self.assertEqual(self.client.get("/api/auth/me/").data["display_name"], "Alex Designer")

    def test_profile_rejects_email_role_job_title_and_other_account_changes(self):
        self.client.force_authenticate(user=self.staff)
        for field, value in (("email", "new@example.com"), ("is_staff", True), ("is_active", False), ("job_title", "Director"), ("id", self.other.pk), ("avatar_data", "fake")):
            response = self.client.patch("/api/auth/me/", {field: value})
            self.assertEqual(response.status_code, 400, (field, response.data))
        self.staff.refresh_from_db()
        self.assertEqual(self.staff.email, "staff@example.com")
        self.assertFalse(self.staff.is_staff)
        self.assertTrue(self.staff.is_active)
        self.assertEqual(self.staff.job_title, "")
        self.assertEqual(self.client.patch(f"/api/auth/people/{self.other.pk}/", {"bio": "Changed"}).status_code, 403)
        self.client.force_authenticate(user=self.admin)
        self.assertEqual(self.client.patch("/api/auth/me/", {"is_staff": False}).status_code, 400)
        self.admin.refresh_from_db()
        self.assertTrue(self.admin.is_staff)

    def test_photo_upload_replace_and_remove_are_private_and_persisted(self):
        self.client.force_authenticate(user=self.staff)
        response = self.client.post("/api/auth/me/photo/", {"photo": photo_file()}, format="multipart")
        self.assertEqual(response.status_code, 200, response.data)
        self.assertTrue(response.data["has_photo"])
        self.staff.refresh_from_db()
        self.assertTrue(self.staff.avatar_data)
        saved = self.client.get("/api/auth/me/photo/")
        self.assertEqual(saved.status_code, 200)
        self.assertEqual(saved["Content-Type"], "image/jpeg")
        self.assertEqual(saved["Cache-Control"], "private, no-store")
        self.assertTrue(saved.content.startswith(b"\xff\xd8"))
        replacement = self.client.post("/api/auth/me/photo/", {"photo": photo_file("PNG", "replacement.png")}, format="multipart")
        self.assertEqual(replacement.status_code, 200, replacement.data)
        webp = self.client.post("/api/auth/me/photo/", {"photo": photo_file("WEBP", "replacement.webp")}, format="multipart")
        self.assertEqual(webp.status_code, 200, webp.data)
        self.assertEqual(self.client.get("/api/auth/me/photo/").status_code, 200)
        self.client.force_authenticate(user=self.other)
        self.assertEqual(self.client.get("/api/auth/me/photo/").status_code, 404)
        self.client.force_authenticate(user=self.staff)
        removed = self.client.delete("/api/auth/me/photo/")
        self.assertEqual(removed.status_code, 200)
        self.assertFalse(removed.data["has_photo"])
        self.staff.refresh_from_db()
        self.assertIsNone(self.staff.avatar_data)
        self.assertEqual(self.client.get("/api/auth/me/photo/").status_code, 404)

    def test_authenticated_user_photo_and_identity_metadata_preserve_people_permissions(self):
        self.client.force_authenticate(user=self.admin)
        self.assertEqual(self.client.post("/api/auth/me/photo/", {"photo": photo_file()}, format="multipart").status_code, 200)
        self.admin.refresh_from_db()
        self.assertTrue(WorkUserSerializer(self.admin).data["has_photo"])
        self.assertTrue(PeopleSerializer(self.admin).data["avatar_updated_at"])
        self.client.force_authenticate(user=self.staff)
        response = self.client.get(f"/api/auth/users/{self.admin.pk}/photo/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["Content-Type"], "image/jpeg")
        self.assertEqual(response["Cache-Control"], "private, no-store")
        self.assertEqual(self.client.get(f"/api/auth/users/{self.other.pk}/photo/").status_code, 404)
        self.assertEqual(self.client.get("/api/auth/users/999999/photo/").status_code, 404)
        self.assertEqual(self.client.post(f"/api/auth/users/{self.admin.pk}/photo/", {}).status_code, 405)
        self.assertEqual(self.client.patch(f"/api/auth/users/{self.admin.pk}/photo/", {}).status_code, 405)
        self.assertEqual(self.client.delete(f"/api/auth/users/{self.admin.pk}/photo/").status_code, 405)
        self.assertEqual(self.client.get("/api/auth/people/").status_code, 403)
        self.client.force_authenticate(user=None)
        self.assertEqual(self.client.get(f"/api/auth/users/{self.admin.pk}/photo/").status_code, 401)

    def test_invalid_and_oversized_photos_are_rejected_without_replacing_previous_photo(self):
        self.client.force_authenticate(user=self.staff)
        self.assertEqual(self.client.post("/api/auth/me/photo/", {"photo": photo_file()}, format="multipart").status_code, 200)
        self.staff.refresh_from_db()
        original = bytes(self.staff.avatar_data)
        uploads = [
            SimpleUploadedFile("vector.svg", b"<svg xmlns='http://www.w3.org/2000/svg'/>", content_type="image/svg+xml"),
            SimpleUploadedFile("fake.jpg", b"not a jpeg", content_type="image/jpeg"),
            SimpleUploadedFile("huge.png", b"x" * (5 * 1024 * 1024 + 1), content_type="image/png"),
        ]
        for upload in uploads:
            response = self.client.post("/api/auth/me/photo/", {"photo": upload}, format="multipart")
            self.assertEqual(response.status_code, 400, response.data)
        self.staff.refresh_from_db()
        self.assertEqual(bytes(self.staff.avatar_data), original)


@override_settings(SECURE_SSL_REDIRECT=False)
class PeopleApiTests(TestCase):
    def setUp(self):
        self.admin = User.objects.create_user(email="admin@example.com", password="password123", is_staff=True)
        self.staff = User.objects.create_user(email="staff@example.com", password="password123")
        self.client = APIClient()

    def as_user(self, user):
        self.client.force_authenticate(user=user)

    def test_people_and_registration_require_admin(self):
        self.assertEqual(self.client.get("/api/auth/people/").status_code, 401)
        self.assertEqual(self.client.post("/api/auth/register/", {}).status_code, 401)
        self.as_user(self.staff)
        self.assertEqual(self.client.get("/api/auth/people/").status_code, 403)
        self.assertEqual(self.client.post("/api/auth/people/", {}).status_code, 403)
        self.assertEqual(self.client.patch(f"/api/auth/people/{self.admin.pk}/", {}).status_code, 403)
        self.assertEqual(self.client.post("/api/auth/register/", {}).status_code, 403)

    def test_create_edit_deactivate_reactivate_and_no_delete(self):
        self.as_user(self.admin)
        response = self.client.post("/api/auth/people/", {
            "first_name": "New", "last_name": "Person", "email": "NEW@example.com",
            "is_staff": False, "password": "password123", "is_superuser": True,
        })
        self.assertEqual(response.status_code, 201, response.data)
        person = User.objects.get(email="new@example.com")
        self.assertFalse(person.is_superuser)
        self.assertFalse(person.is_staff)
        self.assertTrue(person.check_password("password123"))
        self.assertEqual(self.client.patch(f"/api/auth/people/{person.pk}/", {"is_staff": True}).status_code, 200)
        self.assertEqual(self.client.patch(f"/api/auth/people/{person.pk}/", {"is_active": False}).status_code, 200)
        person.refresh_from_db()
        self.assertFalse(person.is_active)
        self.assertEqual(self.client.patch(f"/api/auth/people/{person.pk}/", {"is_active": True}).status_code, 200)
        self.assertEqual(self.client.delete(f"/api/auth/people/{person.pk}/").status_code, 405)

    def test_job_title_is_optional_editable_and_does_not_grant_admin_access(self):
        self.as_user(self.admin)
        response = self.client.post("/api/auth/people/", {
            "first_name": "Jane", "last_name": "Designer", "email": "jane@example.com",
            "job_title": "UI/UX Designer", "is_staff": False, "password": "password123",
        })
        self.assertEqual(response.status_code, 201, response.data)
        person = User.objects.get(email="jane@example.com")
        self.assertEqual(response.data["job_title"], "UI/UX Designer")
        self.assertFalse(person.is_staff)
        self.as_user(person)
        self.assertEqual(self.client.get("/api/auth/people/").status_code, 403)

        self.as_user(self.admin)
        url = f"/api/auth/people/{person.pk}/"
        self.assertEqual(self.client.patch(url, {"job_title": "Graphic Designer"}).status_code, 200)
        person.refresh_from_db()
        self.assertEqual(person.job_title, "Graphic Designer")
        self.assertFalse(person.is_staff)
        self.assertEqual(self.client.patch(url, {"job_title": ""}).status_code, 200)
        person.refresh_from_db()
        self.assertEqual(person.job_title, "")
        self.assertFalse(person.is_staff)

    def test_self_and_last_admin_lockout(self):
        self.as_user(self.admin)
        url = f"/api/auth/people/{self.admin.pk}/"
        self.assertEqual(self.client.patch(url, {"is_staff": False}).status_code, 400)
        self.assertEqual(self.client.patch(url, {"is_active": False}).status_code, 400)
        self.assertEqual(self.client.patch(f"/api/auth/people/{self.staff.pk}/", {"is_staff": True}).status_code, 200)
        self.staff.refresh_from_db()
        self.as_user(self.staff)
        self.assertEqual(self.client.get("/api/auth/people/").status_code, 200)
        self.as_user(self.admin)
        self.assertEqual(self.client.patch(f"/api/auth/people/{self.staff.pk}/", {"is_staff": False}).status_code, 200)
        self.staff.refresh_from_db()
        self.as_user(self.staff)
        self.assertEqual(self.client.get("/api/auth/people/").status_code, 403)
        self.as_user(self.admin)
        self.assertEqual(self.client.patch(f"/api/auth/people/{self.staff.pk}/", {"is_staff": True}).status_code, 200)
        self.assertEqual(self.client.patch(f"/api/auth/people/{self.staff.pk}/", {"is_active": False}).status_code, 200)
        self.admin.refresh_from_db()
        self.assertTrue(self.admin.is_staff and self.admin.is_active)

    def test_superuser_cannot_be_demoted_or_deactivated(self):
        root = User.objects.create_superuser(email="root@example.com", password="password123")
        self.as_user(self.admin)
        url = f"/api/auth/people/{root.pk}/"
        self.assertEqual(self.client.patch(url, {"is_staff": False}).status_code, 400)
        self.assertEqual(self.client.patch(url, {"is_active": False}).status_code, 400)

    def test_last_active_admin_is_protected_when_editing_another_user(self):
        root = User.objects.create_superuser(email="root@example.com", password="password123")
        User.objects.filter(pk=root.pk).update(is_staff=False)
        root.refresh_from_db()
        self.as_user(root)
        self.assertEqual(self.client.patch(f"/api/auth/people/{self.admin.pk}/", {"is_active": False}).status_code, 400)
        self.assertEqual(self.client.patch(f"/api/auth/people/{self.admin.pk}/", {"is_staff": False}).status_code, 400)

    def test_inactive_assignments_stay_visible_but_cannot_be_newly_assigned(self):
        workspace = Workspace.objects.create(name="Main", slug="main")
        group = WorkGroup.objects.create(workspace=workspace, name="Board")
        item = WorkItem.objects.create(group=group, title="Existing", owner=self.staff, created_by=self.admin)
        sub = SubWork.objects.create(work_item=item, title="Sub", assignee=self.staff, created_by=self.admin)
        self.staff.is_active = False
        self.staff.save(update_fields=["is_active"])
        self.as_user(self.admin)
        self.assertNotIn(self.staff.pk, [person["id"] for person in self.client.get("/api/work-users/").data])
        request = APIRequestFactory().get("/api/work-items/")
        force_authenticate(request, user=self.admin)
        context = {"request": Request(request)}
        existing = WorkItemSerializer(item, data={"title": "Edited", "owner": self.staff.pk}, partial=True, context=context)
        self.assertTrue(existing.is_valid(), existing.errors)
        self.assertEqual(WorkItemSerializer(item, context=context).data["owner_detail"]["email"], self.staff.email)
        new = WorkItemSerializer(data={"group": group.pk, "title": "New", "owner": self.staff.pk}, context=context)
        self.assertFalse(new.is_valid())
        self.assertIn("owner", new.errors)
        retained_sub = SubWorkSerializer(sub, data={"title": "Edited", "assignee": self.staff.pk}, partial=True)
        self.assertTrue(retained_sub.is_valid(), retained_sub.errors)
        new_sub = SubWorkSerializer(data={"title": "New", "assignee": self.staff.pk})
        self.assertFalse(new_sub.is_valid())
        self.assertEqual(self.client.patch(f"/api/auth/people/{self.staff.pk}/", {"is_active": True}).status_code, 200)
        self.assertIn(self.staff.pk, [person["id"] for person in self.client.get("/api/work-users/").data])
        available_item = WorkItemSerializer(data={"group": group.pk, "title": "New", "owner": self.staff.pk}, context=context)
        self.assertTrue(available_item.is_valid(), available_item.errors)
        available_sub = SubWorkSerializer(data={"title": "New", "assignee": self.staff.pk})
        self.assertTrue(available_sub.is_valid(), available_sub.errors)
