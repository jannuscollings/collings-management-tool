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
        self.user = User.objects.create_user(email="creator@example.com", password="password123", is_staff=True)
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

    def test_work_item_list_requires_authentication(self):
        response = self.client.get("/api/work-items/")

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_work_item_list_preserves_unfiltered_behavior_and_ordering(self):
        older = WorkItem.objects.create(
            group=self.group,
            title="Older item",
            created_by=self.user,
        )
        newer = WorkItem.objects.create(
            group=self.group,
            title="Newer item",
            created_by=self.user,
        )
        self.client.force_authenticate(self.user)

        response = self.client.get("/api/work-items/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual([item["id"] for item in response.data], [newer.pk, older.pk])

    def test_work_item_list_filters_by_workspace(self):
        creative_item = WorkItem.objects.create(
            group=self.group,
            title="Creative item",
            created_by=self.user,
        )
        other_workspace = Workspace.objects.create(name="Video", slug="video")
        other_group = WorkGroup.objects.create(workspace=other_workspace, name="Production")
        WorkItem.objects.create(
            group=other_group,
            title="Video item",
            created_by=self.user,
        )
        self.client.force_authenticate(self.user)

        response = self.client.get("/api/work-items/", {"workspace": "creative-design"})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual([item["id"] for item in response.data], [creative_item.pk])

    def test_work_item_list_filters_by_status_priority_and_owner(self):
        matching = WorkItem.objects.create(
            group=self.group,
            title="Matching item",
            status=WorkItem.Status.IN_PROGRESS,
            priority=WorkItem.Priority.HIGH,
            owner=self.assignee,
            created_by=self.user,
        )
        WorkItem.objects.create(
            group=self.group,
            title="Different item",
            status=WorkItem.Status.NEW,
            priority=WorkItem.Priority.LOW,
            created_by=self.user,
        )
        self.client.force_authenticate(self.user)

        cases = (
            ({"status": WorkItem.Status.IN_PROGRESS}, matching.pk),
            ({"priority": WorkItem.Priority.HIGH}, matching.pk),
            ({"owner": self.assignee.pk}, matching.pk),
        )
        for query, expected_id in cases:
            with self.subTest(query=query):
                response = self.client.get("/api/work-items/", query)
                self.assertEqual(response.status_code, status.HTTP_200_OK)
                self.assertEqual([item["id"] for item in response.data], [expected_id])

    def test_work_item_list_searches_reference_title_and_brief(self):
        reference_match = WorkItem.objects.create(
            group=self.group,
            title="Reference target",
            created_by=self.user,
        )
        title_match = WorkItem.objects.create(
            group=self.group,
            title="Seasonal brochure artwork",
            created_by=self.user,
        )
        brief_match = WorkItem.objects.create(
            group=self.group,
            title="Generic title",
            brief="Prepare vendor campaign materials",
            created_by=self.user,
        )
        self.client.force_authenticate(self.user)

        cases = (
            (reference_match.reference.lower(), reference_match.pk),
            ("BROCHURE", title_match.pk),
            ("vendor campaign", brief_match.pk),
        )
        for query, expected_id in cases:
            with self.subTest(query=query):
                response = self.client.get("/api/work-items/", {"q": query})
                self.assertEqual(response.status_code, status.HTTP_200_OK)
                self.assertEqual([item["id"] for item in response.data], [expected_id])

    def test_work_item_list_combines_allowlisted_filters(self):
        matching = WorkItem.objects.create(
            group=self.group,
            title="Harbour launch suite",
            brief="Creative campaign",
            status=WorkItem.Status.REVIEW,
            priority=WorkItem.Priority.HIGH,
            owner=self.assignee,
            created_by=self.user,
        )
        WorkItem.objects.create(
            group=self.group,
            title="Harbour launch suite without owner",
            status=WorkItem.Status.REVIEW,
            priority=WorkItem.Priority.HIGH,
            created_by=self.user,
        )
        self.client.force_authenticate(self.user)

        response = self.client.get(
            "/api/work-items/",
            {
                "workspace": "creative-design",
                "status": WorkItem.Status.REVIEW,
                "priority": WorkItem.Priority.HIGH,
                "owner": self.assignee.pk,
                "q": "harbour",
            },
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual([item["id"] for item in response.data], [matching.pk])

    def test_my_work_returns_owner_and_reviewer_items_once(self):
        owned = WorkItem.objects.create(
            group=self.group,
            title="Owned item",
            owner=self.user,
            created_by=self.user,
        )
        reviewed = WorkItem.objects.create(
            group=self.group,
            title="Reviewed item",
            reviewer=self.user,
            created_by=self.assignee,
        )
        both = WorkItem.objects.create(
            group=self.group,
            title="Owned and reviewed item",
            owner=self.user,
            reviewer=self.user,
            created_by=self.user,
        )
        WorkItem.objects.create(
            group=self.group,
            title="Unrelated item",
            owner=self.assignee,
            created_by=self.assignee,
        )
        self.client.force_authenticate(self.user)

        response = self.client.get("/api/work-items/", {"relevance": "mine"})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            [item["id"] for item in response.data],
            [both.pk, reviewed.pk, owned.pk],
        )
        self.assertEqual(response.data[0]["workspace_name"], "Creative & Design")

    def test_my_work_uses_authenticated_user(self):
        mine = WorkItem.objects.create(
            group=self.group,
            title="My item",
            owner=self.user,
            created_by=self.user,
        )
        theirs = WorkItem.objects.create(
            group=self.group,
            title="Someone else's item",
            owner=self.assignee,
            created_by=self.assignee,
        )
        self.client.force_authenticate(self.user)

        my_response = self.client.get("/api/work-items/", {"relevance": "mine"})
        self.client.force_authenticate(self.assignee)
        their_response = self.client.get("/api/work-items/", {"relevance": "mine"})

        self.assertEqual(my_response.status_code, status.HTTP_200_OK)
        self.assertEqual([item["id"] for item in my_response.data], [mine.pk])
        self.assertEqual(their_response.status_code, status.HTTP_200_OK)
        self.assertEqual([item["id"] for item in their_response.data], [theirs.pk])

    def test_my_work_combines_search_status_and_priority_filters(self):
        matching = WorkItem.objects.create(
            group=self.group,
            title="Harbour campaign artwork",
            status=WorkItem.Status.REVIEW,
            priority=WorkItem.Priority.HIGH,
            reviewer=self.user,
            created_by=self.assignee,
        )
        WorkItem.objects.create(
            group=self.group,
            title="Harbour campaign draft",
            status=WorkItem.Status.NEW,
            priority=WorkItem.Priority.HIGH,
            owner=self.user,
            created_by=self.user,
        )
        self.client.force_authenticate(self.user)

        response = self.client.get(
            "/api/work-items/",
            {
                "relevance": "mine",
                "q": "harbour",
                "status": WorkItem.Status.REVIEW,
                "priority": WorkItem.Priority.HIGH,
            },
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual([item["id"] for item in response.data], [matching.pk])

    def test_my_work_excludes_archived_groups_and_workspaces(self):
        active = WorkItem.objects.create(
            group=self.group,
            title="Active item",
            owner=self.user,
            created_by=self.user,
        )
        archived_group = WorkGroup.objects.create(
            workspace=self.workspace,
            name="Archived group",
            archived=True,
        )
        WorkItem.objects.create(
            group=archived_group,
            title="Archived group item",
            owner=self.user,
            created_by=self.user,
        )
        archived_workspace = Workspace.objects.create(
            name="Archived workspace",
            slug="archived-workspace",
            archived=True,
        )
        archived_workspace_group = WorkGroup.objects.create(
            workspace=archived_workspace,
            name="Group",
        )
        WorkItem.objects.create(
            group=archived_workspace_group,
            title="Archived workspace item",
            reviewer=self.user,
            created_by=self.user,
        )
        self.client.force_authenticate(self.user)

        response = self.client.get("/api/work-items/", {"relevance": "mine"})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual([item["id"] for item in response.data], [active.pk])

    def test_my_work_rejects_an_unknown_relevance_scope(self):
        self.client.force_authenticate(self.user)

        response = self.client.get("/api/work-items/", {"relevance": "another-user"})

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_admin_can_create_workspace_with_initial_group(self):
        self.client.force_authenticate(self.user)

        response = self.client.post(
            "/api/workspaces/",
            {"name": "Video Production", "initial_group_name": "Incoming projects"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        workspace = Workspace.objects.get(slug="video-production")
        self.assertEqual(response.data["id"], workspace.pk)
        self.assertTrue(workspace.groups.filter(name="Incoming projects").exists())
        self.assertGreater(workspace.display_order, self.workspace.display_order)

    def test_workspace_creation_with_multiple_boards_is_validated_and_atomic(self):
        self.client.force_authenticate(self.user)
        invalid = self.client.post("/api/workspaces/", {"name": "Video", "board_names": ["Production", "production"]}, format="json")
        blank = self.client.post("/api/workspaces/", {"name": "Video", "board_names": ["Production", " "]}, format="json")
        missing = self.client.post("/api/workspaces/", {"name": "Video", "board_names": []}, format="json")
        self.assertEqual([invalid.status_code, blank.status_code, missing.status_code], [400, 400, 400])
        self.assertFalse(Workspace.objects.filter(slug="video").exists())

        response = self.client.post("/api/workspaces/", {"name": "Video", "board_names": ["Production", "Editing"]}, format="json")
        self.assertEqual(response.status_code, 201)
        self.assertEqual(list(Workspace.objects.get(slug="video").groups.values_list("name", flat=True)), ["Production", "Editing"])

    def test_admin_board_management_and_order(self):
        self.client.force_authenticate(self.user)
        url = "/api/workspaces/creative-design/boards/"
        created = self.client.post(url, {"name": "New delivery"}, format="json")
        self.assertEqual(created.status_code, 201)
        board_id = created.data[-1]["id"]
        duplicate = self.client.post(url, {"name": "new DELIVERY"}, format="json")
        self.assertEqual(duplicate.status_code, 400)
        renamed = self.client.patch(f"{url}{board_id}/", {"name": "Delivery"}, format="json")
        self.assertEqual(renamed.status_code, 200)
        ids = [board["id"] for board in renamed.data]
        rejected = self.client.post(f"{url}reorder/", {"board_ids": ids[:-1]}, format="json")
        self.assertEqual(rejected.status_code, 400)
        ordered = self.client.post(f"{url}reorder/", {"board_ids": list(reversed(ids))}, format="json")
        self.assertEqual([board["id"] for board in ordered.data], list(reversed(ids)))
        self.assertEqual(self.client.delete(f"{url}{board_id}/").status_code, 200)

    def test_board_delete_blocks_items_and_routed_requests(self):
        from intake.models import WorkRequest
        self.client.force_authenticate(self.user)
        url = f"/api/workspaces/creative-design/boards/{self.group.pk}/"
        item = WorkItem.objects.create(group=self.group, title="Keep", created_by=self.user)
        blocked = self.client.delete(url)
        self.assertEqual(blocked.status_code, 400)
        self.assertIn("work items", blocked.data["detail"])
        listed = self.client.get("/api/workspaces/creative-design/boards/")
        self.assertEqual(next(board for board in listed.data if board["id"] == self.group.pk)["work_item_count"], 1)
        self.assertTrue(WorkItem.objects.filter(pk=item.pk).exists())
        item.delete()
        WorkRequest.objects.create(title="Route", submitted_by=self.assignee, destination_group=self.group)
        routed = self.client.delete(url)
        self.assertEqual(routed.status_code, 400)
        self.assertTrue(WorkGroup.objects.filter(pk=self.group.pk).exists())

    def test_last_board_and_archived_workspace_cannot_be_modified(self):
        workspace = Workspace.objects.create(name="Solo", slug="solo")
        board = WorkGroup.objects.create(workspace=workspace, name="Only")
        self.client.force_authenticate(self.user)
        self.assertEqual(self.client.delete(f"/api/workspaces/solo/boards/{board.pk}/").status_code, 400)
        workspace.archived = True
        workspace.save()
        self.assertEqual(self.client.post("/api/workspaces/solo/boards/", {"name": "New"}, format="json").status_code, 404)
        self.assertEqual(self.client.patch(f"/api/workspaces/solo/boards/{board.pk}/", {"name": "Other"}, format="json").status_code, 404)
        self.assertEqual(self.client.post("/api/workspaces/solo/boards/reorder/", {"board_ids": [board.pk]}, format="json").status_code, 404)

    def test_non_admin_cannot_manage_boards(self):
        self.client.force_authenticate(self.assignee)
        url = "/api/workspaces/creative-design/boards/"
        responses = [
            self.client.get(url), self.client.post(url, {"name": "No"}, format="json"),
            self.client.patch(f"{url}{self.group.pk}/", {"name": "No"}, format="json"),
            self.client.delete(f"{url}{self.group.pk}/"),
            self.client.post(f"{url}reorder/", {"board_ids": []}, format="json"),
        ]
        self.assertTrue(all(response.status_code == 403 for response in responses))

    def test_non_admin_cannot_manage_workspaces(self):
        self.client.force_authenticate(self.assignee)

        create = self.client.post(
            "/api/workspaces/",
            {"name": "Video", "initial_group_name": "Production"},
            format="json",
        )
        rename = self.client.patch(
            "/api/workspaces/creative-design/",
            {"name": "Renamed"},
            format="json",
        )
        archive = self.client.post("/api/workspaces/creative-design/archive/", {}, format="json")
        reorder = self.client.post(
            "/api/workspaces/reorder/",
            {"workspace_ids": [self.workspace.pk]},
            format="json",
        )

        self.assertEqual(create.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(rename.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(archive.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(reorder.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_can_rename_archive_and_restore_workspace_without_changing_slug(self):
        self.client.force_authenticate(self.user)

        renamed = self.client.patch(
            "/api/workspaces/creative-design/",
            {"name": "Creative Studio", "slug": "changed-slug"},
            format="json",
        )
        archived = self.client.post("/api/workspaces/creative-design/archive/", {}, format="json")
        self.client.force_authenticate(self.assignee)
        hidden = self.client.get("/api/workspaces/creative-design/")
        self.client.force_authenticate(self.user)
        restored = self.client.post("/api/workspaces/creative-design/restore/", {}, format="json")

        self.workspace.refresh_from_db()
        self.assertEqual(renamed.status_code, status.HTTP_200_OK)
        self.assertEqual(self.workspace.name, "Creative Studio")
        self.assertEqual(self.workspace.slug, "creative-design")
        self.assertEqual(archived.status_code, status.HTTP_200_OK)
        self.assertEqual(hidden.status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(restored.status_code, status.HTTP_200_OK)
        self.assertFalse(restored.data["archived"])

    def test_admin_can_persist_active_workspace_order(self):
        video = Workspace.objects.create(name="Video", slug="video", display_order=2)
        self.client.force_authenticate(self.user)

        response = self.client.post(
            "/api/workspaces/reorder/",
            {"workspace_ids": [video.pk, self.workspace.pk]},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual([workspace["id"] for workspace in response.data], [video.pk, self.workspace.pk])
        self.assertEqual(
            list(Workspace.objects.filter(archived=False).values_list("pk", flat=True)),
            [video.pk, self.workspace.pk],
        )

    def test_workspace_list_respects_order_and_excludes_archived_for_everyone(self):
        video = Workspace.objects.create(name="Video", slug="video", display_order=2)
        archived = Workspace.objects.create(name="Archive", slug="archive", display_order=3, archived=True)
        self.client.force_authenticate(self.assignee)

        regular = self.client.get("/api/workspaces/", {"include_archived": "true"})
        self.client.force_authenticate(self.user)
        admin = self.client.get("/api/workspaces/", {"include_archived": "true"})

        self.assertEqual(regular.status_code, status.HTTP_200_OK)
        self.assertEqual([workspace["id"] for workspace in regular.data], [self.workspace.pk, video.pk])
        self.assertEqual(
            [workspace["id"] for workspace in admin.data],
            [self.workspace.pk, video.pk],
        )
        self.assertEqual([row["id"] for row in self.client.get("/api/archive/").data["workspaces"]], [archived.pk])

    def test_workspace_reorder_rejects_incomplete_list_without_changes(self):
        video = Workspace.objects.create(name="Video", slug="video", display_order=2)
        before = list(Workspace.objects.filter(archived=False).values_list("pk", "display_order"))
        self.client.force_authenticate(self.user)

        response = self.client.post(
            "/api/workspaces/reorder/",
            {"workspace_ids": [video.pk]},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(
            list(Workspace.objects.filter(archived=False).values_list("pk", "display_order")),
            before,
        )

    def test_workspace_delete_is_not_exposed(self):
        self.client.force_authenticate(self.user)

        response = self.client.delete("/api/workspaces/creative-design/")

        self.assertEqual(response.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)

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
