from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from intake.models import WorkRequest
from work.models import WorkGroup, WorkItem, Workspace


User = get_user_model()


@override_settings(SECURE_SSL_REDIRECT=False)
class SearchApiTests(TestCase):
    def setUp(self):
        self.admin = User.objects.create_user(email="admin@example.com", password="secret", is_staff=True)
        self.user = User.objects.create_user(email="user@example.com", password="secret")
        self.other = User.objects.create_user(email="other@example.com", password="secret")
        self.workspace = Workspace.objects.create(name="Creative Search", slug="creative-search")
        self.board = WorkGroup.objects.create(workspace=self.workspace, name="Website Projects")
        self.client = APIClient()

    def item(self, title, **kwargs):
        return WorkItem.objects.create(group=self.board, title=title, created_by=self.admin, **kwargs)

    def request(self, title, **kwargs):
        return WorkRequest.objects.create(title=title, submitted_by=self.user, **kwargs)

    def search(self, query, user=None, **params):
        if user:
            self.client.force_authenticate(user)
        return self.client.get("/api/search/", {"q": query, **params})

    def test_requires_authentication_and_validates_query(self):
        self.assertEqual(self.search("creative").status_code, 401)
        self.assertEqual(self.search("x", self.user).status_code, 400)
        self.assertEqual(self.search("x" * 121, self.user).status_code, 400)
        self.assertEqual(self.search("creative", self.user, types="invalid").status_code, 400)

    def test_references_titles_descriptions_places_and_context(self):
        item = self.item("Homepage revisions", owner=self.user, brief="Revise <b>mobile layout</b>.")
        work_request = self.request("New homepage request", brief="Need mobile artwork")
        by_item_ref = self.search(item.reference.lower(), self.user).data
        by_request_ref = self.search(work_request.reference.lower(), self.user).data
        by_description = self.search("MOBILE layout", self.user).data
        by_workspace = self.search("creative search", self.user).data
        by_board = self.search("website projects", self.user).data
        self.assertEqual(by_item_ref["results"]["workItems"][0]["id"], item.pk)
        self.assertEqual(by_request_ref["results"]["requests"][0]["id"], work_request.pk)
        self.assertEqual(by_description["results"]["workItems"][0]["excerpt"], "Revise mobile layout.")
        self.assertEqual(by_description["results"]["workItems"][0]["boardName"], self.board.name)
        self.assertEqual(by_workspace["results"]["workspaces"][0]["slug"], self.workspace.slug)
        self.assertEqual(by_board["results"]["boards"][0]["id"], self.board.pk)

    def test_ranking_limit_and_normalization(self):
        exact = self.item("Website", owner=self.user)
        prefix = self.item("Website assets", owner=self.user)
        contains = self.item("New website design", owner=self.user)
        description = self.item("Creative brief", owner=self.user, brief="Website work")
        for index in range(5):
            self.item(f"Website extra {index}", owner=self.user)
        data = self.search("  WEBSITE  ", self.user).data
        self.assertEqual(data["query"], "WEBSITE")
        self.assertEqual([row["id"] for row in data["results"]["workItems"][:2]], [exact.pk, prefix.pk])
        self.assertEqual(data["counts"]["workItems"], 9)
        self.assertEqual(len(data["results"]["workItems"]), 6)
        self.assertNotIn(description.pk, [row["id"] for row in data["results"]["workItems"]])
        self.assertEqual(self.search("new website", self.user).data["results"]["workItems"][0]["id"], contains.pk)

    def test_markup_only_description_match_does_not_count_and_partial_reference_works(self):
        item = self.item("Ordinary title", owner=self.user, brief="<span class='secret-marker'>Plain text</span>")
        hidden_markup = self.search("secret-marker", self.user).data
        self.assertEqual(hidden_markup["counts"]["workItems"], 0)
        self.assertEqual(hidden_markup["results"]["workItems"], [])
        partial_reference = self.search(item.reference[:5], self.user).data
        self.assertIn(item.pk, [row["id"] for row in partial_reference["results"]["workItems"]])

    def test_restricted_records_do_not_leak_through_results_or_counts(self):
        hidden_item = self.item("Secret launch", owner=self.other, brief="Secret details")
        hidden_request = WorkRequest.objects.create(title="Secret request", submitted_by=self.other)
        user_data = self.search("secret", self.user).data
        admin_data = self.search("secret", self.admin).data
        self.assertEqual(user_data["counts"]["workItems"], 0)
        self.assertEqual(user_data["counts"]["requests"], 0)
        self.assertEqual(user_data["results"]["workItems"], [])
        self.assertEqual(user_data["results"]["requests"], [])
        self.assertEqual(admin_data["results"]["workItems"][0]["id"], hidden_item.pk)
        self.assertEqual(admin_data["results"]["requests"][0]["id"], hidden_request.pk)
        self.assertEqual(self.client.get(f"/api/work-items/{hidden_item.pk}/").status_code, 200)
        self.client.force_authenticate(self.user)
        self.assertEqual(self.client.get(f"/api/work-items/{hidden_item.pk}/").status_code, 404)
        self.assertEqual(self.client.get(f"/api/requests/{hidden_request.pk}/").status_code, 404)

    def test_destination_rechecks_changed_permission(self):
        item = self.item("Visible now", owner=self.user)
        self.assertEqual(self.search("visible now", self.user).data["results"]["workItems"][0]["id"], item.pk)
        item.owner = self.other
        item.save(update_fields=("owner",))
        self.client.force_authenticate(self.user)
        self.assertEqual(self.client.get(f"/api/work-items/{item.pk}/").status_code, 404)

    def test_archived_places_are_not_searchable(self):
        self.workspace.archived = True
        self.workspace.save()
        data = self.search("creative search", self.admin).data
        self.assertEqual(data["results"]["workspaces"], [])
        data = self.search("website projects", self.admin).data
        self.assertEqual(data["results"]["boards"], [])
