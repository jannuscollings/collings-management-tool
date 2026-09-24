from unittest.mock import patch
from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from rest_framework.test import APIClient
from work.models import Workspace, WorkItem, WorkActivity, SubWork
from intake.models import WorkRequest


@override_settings(SECURE_SSL_REDIRECT=False)
class OperationsTests(TestCase):
    def setUp(self):
        User = get_user_model()
        self.admin = User.objects.create_user(email='admin@tests.test', is_staff=True)
        self.owner = User.objects.create_user(email='owner@tests.test')
        self.reviewer = User.objects.create_user(email='reviewer@tests.test')
        self.other = User.objects.create_user(email='other@tests.test')
        self.group = Workspace.objects.get(slug='creative-design').groups.first()
        self.item = WorkItem.objects.create(group=self.group, title='Design', owner=self.owner,
                                           reviewer=self.reviewer, created_by=self.admin)
        self.url = f'/api/work-items/{self.item.pk}/'
        self.client = APIClient()

    def as_user(self, user):
        self.client.force_authenticate(user)
        return self.client

    def test_visibility_including_nested_workspace_and_subwork(self):
        client = self.as_user(self.other)
        self.assertEqual(client.get(self.url).status_code, 404)
        self.assertEqual(client.get('/api/work-items/').data, [])
        data = client.get('/api/workspaces/creative-design/').data
        self.assertFalse(any(g['work_items'] for g in data['groups']))
        SubWork.objects.create(work_item=self.item, title='Copy', assignee=self.other, created_by=self.admin)
        self.assertEqual(client.get(self.url).status_code, 200)
        self.assertEqual(len(client.get('/api/work-items/').data), 1)
        # My Work retains its owner OR reviewer contract.
        self.assertEqual(client.get('/api/work-items/?relevance=mine').data, [])

    def test_admin_creation_and_user_field_restrictions(self):
        payload = {'group': self.group.pk, 'title': 'Created'}
        self.assertEqual(self.as_user(self.owner).post('/api/work-items/', payload).status_code, 403)
        response = self.as_user(self.admin).post('/api/work-items/', payload)
        self.assertEqual(response.status_code, 201)
        self.assertTrue(WorkActivity.objects.filter(work_item_id=response.data['id'], event='created', actor=self.admin).exists())
        client = self.as_user(self.owner)
        for field, value in [('owner', self.other.pk), ('priority', 'high'), ('group', self.group.pk), ('due_date', '2026-10-01')]:
            self.assertEqual(client.patch(self.url, {field: value}).status_code, 403)
        self.assertEqual(client.patch(self.url, {'brief': 'Updated'}).status_code, 200)
        self.assertEqual(self.as_user(self.reviewer).patch(self.url, {'title': 'No'}).status_code, 403)

    def test_review_cannot_be_bypassed_and_records_decisions(self):
        client = self.as_user(self.owner)
        self.assertEqual(client.patch(self.url, {'status': 'done'}).status_code, 400)
        self.assertEqual(client.patch(self.url, {'status': 'review'}).status_code, 200)
        self.assertEqual(client.patch(self.url, {'status': 'in_progress'}).status_code, 400)
        self.assertEqual(client.post(self.url+'review/', {'decision': 'approve'}).status_code, 403)
        self.assertEqual(self.as_user(self.admin).post(self.url+'review/', {'decision': 'approve'}).status_code, 403)
        client = self.as_user(self.reviewer)
        self.assertEqual(client.post(self.url+'review/', {'decision': 'request_changes'}).status_code, 400)
        response = client.post(self.url+'review/', {'decision': 'request_changes', 'note': 'Fix copy'})
        self.assertEqual(response.data['status'], 'in_progress')
        self.as_user(self.owner).patch(self.url, {'status': 'review'})
        self.assertEqual(self.as_user(self.reviewer).post(self.url+'review/', {'decision': 'approve'}).data['status'], 'done')
        self.assertEqual(self.client.post(self.url+'review/', {'decision': 'approve'}).status_code, 409)
        self.assertEqual(self.item.activity.filter(event='approved').count(), 1)
        self.assertEqual(self.item.activity.filter(event='review_submitted').count(), 2)

    def test_review_requires_active_reviewer(self):
        self.reviewer.is_active = False
        self.reviewer.save()
        self.assertEqual(self.as_user(self.owner).patch(self.url, {'status': 'review'}).status_code, 400)

    def test_status_and_activity_roll_back_together(self):
        with patch('work.views.record_changes', side_effect=RuntimeError('audit failure')):
            with self.assertRaises(RuntimeError):
                self.as_user(self.owner).patch(self.url, {'status': 'in_progress'})
        self.item.refresh_from_db()
        self.assertEqual(self.item.status, 'new')

    def test_comments_attribution_and_validation(self):
        client = self.as_user(self.owner)
        self.assertEqual(client.post(self.url+'comments/', {'body': '  '}).status_code, 400)
        response = client.post(self.url+'comments/', {'body': 'Draft ready', 'author': self.other.pk})
        self.assertEqual(response.status_code, 201)
        self.assertEqual(self.item.comments.get().author, self.owner)
        self.assertEqual(self.as_user(self.other).get(self.url+'comments/').status_code, 404)
        self.assertEqual(self.as_user(self.reviewer).get(self.url+'comments/').data[0]['body'], 'Draft ready')

    def test_subwork_admin_and_assignee_actions(self):
        payload = {'title': 'Prepare exports', 'assignee': self.other.pk}
        self.assertEqual(self.as_user(self.owner).post(self.url+'sub-work/', payload).status_code, 403)
        response = self.as_user(self.admin).post(self.url+'sub-work/', payload)
        self.assertEqual(response.status_code, 201)
        url = self.url+f"sub-work/{response.data['id']}/"
        self.assertEqual(self.as_user(self.owner).patch(url, {'completed': True}).status_code, 403)
        self.assertEqual(self.as_user(self.other).patch(url, {'title': 'Rename'}).status_code, 403)
        self.assertEqual(self.client.patch(url, {'completed': True}, format='json').status_code, 200)
        self.assertEqual(self.client.patch(url, {'completed': False}, format='json').status_code, 200)
        self.assertTrue(self.item.activity.filter(event='sub_work_reopened').exists())
        self.assertEqual(self.as_user(self.admin).patch(url, {'title': 'Revised exports'}).status_code, 200)

    def test_links_validate_scheme_and_access(self):
        client = self.as_user(self.owner)
        self.assertEqual(client.post(self.url+'links/', {'label': 'Bad', 'url': 'javascript:alert(1)'}).status_code, 400)
        response = client.post(self.url+'links/', {'label': 'Design', 'url': 'https://figma.com/design/test'})
        self.assertEqual(response.status_code, 201)
        url = self.url+f"links/{response.data['id']}/"
        self.assertEqual(self.as_user(self.reviewer).delete(url).status_code, 403)
        self.assertEqual(self.as_user(self.owner).delete(url).status_code, 204)

    def test_request_triage_admin_only_and_request_visibility(self):
        req = WorkRequest.objects.create(title='Brief', submitted_by=self.owner)
        url = f'/api/requests/{req.pk}/'
        client = self.as_user(self.owner)
        for action in ('triage', 'accept', 'reject'):
            self.assertEqual(client.post(url+action+'/').status_code, 403)
        self.assertEqual(self.as_user(self.other).get(url).status_code, 404)
        self.assertEqual(self.as_user(self.admin).get(url).status_code, 200)

    def test_authentication_and_no_public_audit_writes(self):
        for suffix in ('', 'comments/', 'activity/', 'sub-work/', 'links/', 'review/'):
            self.assertEqual(self.client.get(self.url+suffix).status_code, 401)
        self.assertEqual(self.as_user(self.admin).post(self.url+'activity/', {'event': 'approved'}).status_code, 405)

    def test_no_reviewer_work_can_complete_and_reopen(self):
        self.item.reviewer = None
        self.item.save()
        client = self.as_user(self.owner)
        self.assertEqual(client.patch(self.url, {'status': 'review'}).status_code, 400)
        self.assertEqual(client.patch(self.url, {'status': 'done'}).status_code, 200)
        self.assertEqual(client.patch(self.url, {'status': 'in_progress'}).status_code, 200)

    def test_subwork_and_links_cannot_be_changed_through_another_parent(self):
        other_item = WorkItem.objects.create(group=self.group, title='Other parent', created_by=self.admin)
        sub = SubWork.objects.create(work_item=other_item, title='Other step', created_by=self.admin)
        self.assertEqual(self.as_user(self.admin).patch(self.url+f'sub-work/{sub.pk}/', {'completed': True}).status_code, 404)
        created = self.client.post(f'/api/work-items/{other_item.pk}/links/', {'label': 'Resource', 'url': 'https://example.com'})
        self.assertEqual(self.client.delete(self.url+f"links/{created.data['id']}/").status_code, 404)

    def test_changed_fields_are_audited_once_with_actor_and_labels(self):
        response = self.as_user(self.admin).patch(self.url, {'owner': self.other.pk, 'priority': 'high'})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(self.item.activity.count(), 2)
        event = self.item.activity.get(event='owner_id_changed')
        self.assertEqual(event.actor, self.admin)
        self.assertEqual(event.details['after'], self.other.email)
        self.client.patch(self.url, {'owner': self.other.pk, 'priority': 'high'})
        self.assertEqual(self.item.activity.count(), 2)

    def test_admin_cannot_leave_review_via_generic_patch(self):
        self.item.status = 'review'
        self.item.save()
        response = self.as_user(self.admin).patch(self.url, {'status': 'done', 'reviewer': None}, format='json')
        self.assertEqual(response.status_code, 400)
        self.item.refresh_from_db()
        self.assertEqual(self.item.status, 'review')

    def test_subwork_assignment_must_be_active(self):
        self.other.is_active = False
        self.other.save()
        response = self.as_user(self.admin).post(self.url+'sub-work/', {'title': 'Step', 'assignee': self.other.pk})
        self.assertEqual(response.status_code, 400)
