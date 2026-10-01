from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from rest_framework.test import APIClient, APIRequestFactory, force_authenticate
from rest_framework.request import Request
from work.models import Workspace, WorkGroup, WorkItem, SubWork
from work.serializers import WorkItemSerializer, SubWorkSerializer


User = get_user_model()


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

    def test_self_and_last_admin_lockout(self):
        self.as_user(self.admin)
        url = f"/api/auth/people/{self.admin.pk}/"
        self.assertEqual(self.client.patch(url, {"is_staff": False}).status_code, 400)
        self.assertEqual(self.client.patch(url, {"is_active": False}).status_code, 400)
        self.assertEqual(self.client.patch(f"/api/auth/people/{self.staff.pk}/", {"is_staff": True}).status_code, 200)
        self.assertEqual(self.client.patch(f"/api/auth/people/{self.staff.pk}/", {"is_staff": False}).status_code, 200)
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
