from unittest.mock import patch
from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from rest_framework.test import APIClient
from work.models import Workspace, WorkItem, WorkComment, SubWork


@override_settings(SECURE_SSL_REDIRECT=False)
class CollaborationTests(TestCase):
    def setUp(self):
        User = get_user_model()
        self.admin = User.objects.create_user(email='admin@discussion.test', is_staff=True)
        self.owner = User.objects.create_user(email='owner@discussion.test')
        self.reviewer = User.objects.create_user(email='reviewer@discussion.test')
        self.outsider = User.objects.create_user(email='other@discussion.test')
        self.item = WorkItem.objects.create(group=Workspace.objects.first().groups.first(),
            title='Discussion', owner=self.owner, reviewer=self.reviewer, created_by=self.admin)
        self.url = f'/api/work-items/{self.item.pk}/comments/'
        self.client = APIClient()
        self.client.force_authenticate(self.owner)

    def create(self, **values):
        return self.client.post(self.url, {'body': 'Hello', **values}, format='json')

    def test_reply_rules_and_attribution(self):
        parent = self.create(author=self.admin.pk).data
        reply = self.create(parent=parent['id'])
        self.assertEqual(reply.status_code, 201)
        self.assertEqual(reply.data['author_detail']['id'], self.owner.pk)
        self.assertEqual(self.create(parent=reply.data['id']).status_code, 400)
        other = WorkItem.objects.create(group=self.item.group, title='Other', created_by=self.admin)
        foreign = WorkComment.objects.create(work_item=other, author=self.admin, body='Foreign')
        self.assertEqual(self.create(parent=foreign.pk).status_code, 400)
        self.assertEqual(self.item.activity.filter(event='reply_added').count(), 1)

    def test_author_edit_preserves_identity_and_noop_is_not_audited(self):
        comment = self.create().data
        url = self.url + f"{comment['id']}/"
        payload = {'body': 'Updated', 'author': self.admin.pk, 'created_at': '2000-01-01'}
        edited = self.client.patch(url, payload, format='json')
        self.assertEqual(edited.status_code, 200)
        self.assertEqual(edited.data['created_at'], comment['created_at'])
        self.assertEqual(edited.data['author_detail'], comment['author_detail'])
        self.assertTrue(edited.data['edited_at'])
        self.client.patch(url, {'body': 'Updated'}, format='json')
        self.assertEqual(self.item.activity.filter(event='comment_edited').count(), 1)
        self.assertEqual(self.client.patch(url, {'body': '   '}).status_code, 400)

    def test_only_author_or_admin_can_manage_and_visibility_is_required(self):
        comment = self.create().data
        url = self.url + f"{comment['id']}/"
        self.client.force_authenticate(self.reviewer)
        self.assertEqual(self.client.patch(url, {'body': 'No'}).status_code, 403)
        self.assertEqual(self.client.delete(url).status_code, 403)
        self.client.force_authenticate(self.outsider)
        self.assertEqual(self.client.patch(url, {'body': 'No'}).status_code, 404)
        self.assertEqual(self.client.get(self.url).status_code, 404)
        self.client.force_authenticate(self.admin)
        self.assertEqual(self.client.patch(url, {'body': 'Moderated'}).status_code, 200)
        self.assertEqual(self.client.delete(url).status_code, 204)
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get(self.url).status_code, 401)

    def test_soft_delete_preserves_replies_and_is_idempotent(self):
        parent = self.create(mentions=[self.reviewer.pk]).data
        reply = self.create(parent=parent['id']).data
        url = self.url + f"{parent['id']}/"
        self.assertEqual(self.client.delete(url).status_code, 204)
        self.assertEqual(self.client.delete(url).status_code, 204)
        data = self.client.get(self.url).data
        self.assertEqual(len(data), 2)
        self.assertEqual(data[0]['body'], '')
        self.assertEqual(data[0]['mentions'], [])
        self.assertTrue(data[0]['deleted_at'])
        self.assertEqual(data[1]['parent'], parent['id'])
        self.assertEqual(self.create(parent=parent['id']).status_code, 400)
        self.assertEqual(self.client.patch(url, {'body': 'Restore'}).status_code, 409)
        self.assertEqual(self.item.activity.filter(event='comment_deleted').count(), 1)
        self.assertEqual(self.client.delete(self.url + f"{reply['id']}/").status_code, 204)

    def test_mentions_are_persisted_validated_and_do_not_grant_access(self):
        comment = self.create(mentions=[self.outsider.pk]).data
        self.assertEqual(comment['mentions'], [self.outsider.pk])
        self.assertEqual(WorkComment.objects.get(pk=comment['id']).mentions.get(), self.outsider)
        self.outsider.is_active = False
        self.outsider.save()
        self.assertEqual(self.create(mentions=[self.outsider.pk]).status_code, 400)
        self.assertEqual(self.create(mentions=[999999]).status_code, 400)
        self.client.force_authenticate(self.outsider)
        self.assertEqual(self.client.get(self.url).status_code, 404)

    def test_reply_parent_is_immutable_and_cross_item_mutation_rejected(self):
        parent = self.create().data
        second = self.create().data
        reply = self.create(parent=parent['id']).data
        self.assertEqual(self.client.patch(self.url + f"{reply['id']}/", {'parent': second['id']}).status_code, 400)
        other = WorkItem.objects.create(group=self.item.group, title='Other', owner=self.owner, created_by=self.admin)
        self.assertEqual(self.client.delete(f"/api/work-items/{other.pk}/comments/{reply['id']}/").status_code, 404)

    def test_assigned_subwork_user_can_participate(self):
        SubWork.objects.create(work_item=self.item, title='Step', assignee=self.outsider, created_by=self.admin)
        self.client.force_authenticate(self.outsider)
        self.assertEqual(self.create().status_code, 201)

    def test_activity_failure_rolls_back_mutations(self):
        comment = self.create().data
        url = self.url + f"{comment['id']}/"
        with patch('work.views.record_activity', side_effect=RuntimeError('audit failed')):
            for operation in (
                lambda: self.create(),
                lambda: self.client.patch(url, {'body': 'Changed'}),
                lambda: self.client.delete(url),
            ):
                with self.assertRaises(RuntimeError):
                    operation()
        stored = WorkComment.objects.get(pk=comment['id'])
        self.assertEqual(stored.body, 'Hello')
        self.assertIsNone(stored.deleted_at)
        self.assertIsNone(stored.edited_at)
        self.assertEqual(self.item.comments.count(), 1)
