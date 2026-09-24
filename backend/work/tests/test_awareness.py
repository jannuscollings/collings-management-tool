from datetime import datetime, timedelta, timezone as dt_timezone
from unittest.mock import patch
from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient
from work.models import Workspace, WorkItem, Notification, WorkActivity, SubWork
from work.notifications import notify
from intake.models import WorkRequest


@override_settings(SECURE_SSL_REDIRECT=False)
class AwarenessTests(TestCase):
    def setUp(self):
        User = get_user_model()
        self.admin = User.objects.create_user(email='admin@awareness.test', is_staff=True)
        self.owner = User.objects.create_user(email='owner@awareness.test')
        self.reviewer = User.objects.create_user(email='reviewer@awareness.test')
        self.other = User.objects.create_user(email='other@awareness.test')
        self.group = Workspace.objects.get(slug='creative-design').groups.first()
        self.item = WorkItem.objects.create(group=self.group, title='Attention', owner=self.owner,
            reviewer=self.reviewer, created_by=self.admin, due_date=timezone.localdate()-timedelta(days=1))
        self.request = WorkRequest.objects.create(title='Request', submitted_by=self.owner)
        self.client = APIClient()
        self.client.force_authenticate(self.admin)

    def test_home_visibility_and_admin_triage(self):
        hidden = WorkItem.objects.create(group=self.group, title='Hidden', created_by=self.admin)
        self.client.force_authenticate(self.owner)
        response = self.client.get('/api/home/')
        self.assertEqual(response.status_code, 200)
        self.assertNotIn('triage', response.data)
        self.assertEqual(response.data['my_open']['count'], 1)
        self.assertEqual(response.data['overdue']['count'], 1)
        self.assertNotIn(hidden.pk, [x['id'] for x in response.data['recent']['items']])
        self.client.force_authenticate(self.admin)
        self.assertEqual(self.client.get('/api/home/').data['triage']['count'], 1)
        self.group.archived = True
        self.group.save()
        self.client.force_authenticate(self.owner)
        self.assertEqual(self.client.get('/api/home/').data['my_open']['count'], 0)

    def test_calendar_boundaries_review_and_subwork(self):
        fixed = datetime(2026, 9, 24, 16, 30, tzinfo=dt_timezone.utc)
        self.item.due_date = '2026-09-25'
        self.item.status = 'review'
        self.item.save()
        SubWork.objects.create(work_item=self.item, title='Sub', assignee=self.other, created_by=self.admin)
        self.client.force_authenticate(self.reviewer)
        with patch('work.awareness.timezone.now', return_value=fixed):
            data = self.client.get('/api/home/?timezone=Asia/Manila').data
        self.assertEqual(data['today'], '2026-09-25')
        self.assertEqual(data['overdue']['count'], 0)
        self.assertEqual(data['due_soon']['count'], 1)
        self.assertEqual(data['review']['count'], 1)
        self.client.force_authenticate(self.other)
        self.assertEqual(self.client.get('/api/home/').data['my_open']['count'], 1)
        self.assertEqual(self.client.get('/api/home/?timezone=invalid').status_code, 400)

    def test_assignment_review_and_self_suppression(self):
        url = f'/api/work-items/{self.item.pk}/'
        self.assertEqual(self.client.patch(url, {'owner': self.other.pk}, format='json').status_code, 200)
        self.assertEqual(Notification.objects.get(event='assigned').recipient, self.other)
        self.client.patch(url, {'owner': self.other.pk}, format='json')
        self.assertEqual(Notification.objects.filter(event='assigned').count(), 1)
        self.client.patch(url, {'owner': self.admin.pk}, format='json')
        self.assertFalse(Notification.objects.filter(recipient=self.admin).exists())
        self.client.patch(url, {'status': 'review'}, format='json')
        self.assertEqual(Notification.objects.get(event='review_ready').recipient, self.reviewer)
        self.client.force_authenticate(self.reviewer)
        self.assertEqual(self.client.post(url+'review/', {'decision':'request_changes','note':'Fix copy'}).status_code, 200)
        self.assertTrue(Notification.objects.filter(event='changes_requested', recipient=self.admin).exists())

    def test_admin_assigns_and_mentions_standard_user_visible_in_my_work_and_notifications(self):
        User = get_user_model()
        demo = User.objects.create_user(email='demo@collings.com.au', is_staff=True)
        staff = User.objects.create_user(email='staff@example.com')
        self.client.force_authenticate(demo)
        directory = self.client.get('/api/work-users/').data
        self.assertEqual(next(user['id'] for user in directory if user['email'] == staff.email), staff.pk)

        item_url = f'/api/work-items/{self.item.pk}/'
        response = self.client.patch(item_url, {'owner': staff.pk}, format='json')
        self.assertEqual(response.status_code, 200)
        self.item.refresh_from_db()
        self.assertEqual(self.item.owner_id, staff.pk)
        comment = self.client.post(item_url + 'comments/', {
            'body': '@staff@example.com Please review this.', 'mentions': [staff.pk],
        }, format='json')
        self.assertEqual(comment.status_code, 201)
        self.assertEqual(set(Notification.objects.filter(recipient=staff).values_list('event', flat=True)),
                         {'assigned', 'mentioned'})
        self.assertFalse(Notification.objects.filter(recipient=demo).exists())

        self.client.force_authenticate(staff)
        self.assertEqual(self.client.get(item_url).status_code, 200)
        mine = self.client.get('/api/work-items/?relevance=mine')
        self.assertEqual(mine.status_code, 200)
        self.assertIn(self.item.pk, [item['id'] for item in mine.data])
        inbox = self.client.get('/api/notifications/')
        self.assertEqual(inbox.status_code, 200)
        self.assertEqual(inbox.data['unread_count'], 2)
        self.assertEqual({entry['event'] for entry in inbox.data['items']}, {'assigned', 'mentioned'})
        self.assertEqual({entry['target']['id'] for entry in inbox.data['items']}, {self.item.pk})

        self.client.force_authenticate(self.other)
        self.assertNotIn(self.item.pk, [item['id'] for item in self.client.get('/api/work-items/?relevance=mine').data])
        self.assertEqual(self.client.get('/api/notifications/').data['unread_count'], 0)

    def test_mentions_replies_edits_and_inaccessible_recipients(self):
        url = f'/api/work-items/{self.item.pk}/comments/'
        self.client.force_authenticate(self.owner)
        comment = self.client.post(url, {'body':'Hello', 'mentions':[self.owner.pk,self.reviewer.pk,self.other.pk]}, format='json')
        self.assertEqual(comment.status_code, 201)
        self.assertEqual(Notification.objects.count(), 1)
        self.assertEqual(Notification.objects.get().recipient, self.reviewer)
        self.client.patch(url+str(comment.data['id'])+'/', {'body':'Hello again'}, format='json')
        self.assertEqual(Notification.objects.count(), 1)
        self.client.force_authenticate(self.reviewer)
        self.client.post(url, {'body':'Reply', 'parent':comment.data['id'], 'mentions':[self.owner.pk]}, format='json')
        self.assertEqual(Notification.objects.filter(recipient=self.owner).count(), 1)
        self.client.post(url, {'body':'Second reply', 'parent':comment.data['id']}, format='json')
        self.assertTrue(Notification.objects.filter(recipient=self.owner, event='reply').exists())

    def test_subwork_assignment_notification(self):
        url = f'/api/work-items/{self.item.pk}/sub-work/'
        response = self.client.post(url, {'title':'Subtask','assignee':self.other.pk}, format='json')
        self.assertEqual(response.status_code, 201)
        self.assertTrue(Notification.objects.filter(recipient=self.other, event='sub_work_assigned').exists())
        self.client.patch(url+str(response.data['id'])+'/', {'assignee':self.owner.pk}, format='json')
        self.assertTrue(Notification.objects.filter(recipient=self.owner, event='sub_work_assigned').exists())

    def test_read_permissions_targets_and_revoked_access(self):
        notify(self.admin, self.owner.pk, 'assigned', item=self.item)
        notification = Notification.objects.get()
        self.client.force_authenticate(self.other)
        self.assertEqual(self.client.get('/api/notifications/').data['unread_count'], 0)
        self.assertEqual(self.client.post(f'/api/notifications/{notification.pk}/read/').status_code, 404)
        self.client.force_authenticate(self.owner)
        data = self.client.get('/api/notifications/').data
        self.assertEqual(data['items'][0]['target'], {'kind':'item','id':self.item.pk})
        self.assertEqual(data['unread_count'], 1)
        self.client.post(f'/api/notifications/{notification.pk}/read/')
        notification.refresh_from_db()
        read_at = notification.read_at
        self.client.post(f'/api/notifications/{notification.pk}/read/')
        notification.refresh_from_db()
        self.assertEqual(notification.read_at, read_at)
        self.assertEqual(self.client.get('/api/notifications/').data['unread_count'], 0)
        self.item.owner = self.other
        self.item.save()
        self.assertEqual(self.client.get('/api/notifications/').data['items'], [])
        self.assertEqual(self.client.post(f'/api/notifications/{notification.pk}/read/').status_code, 404)

    def test_request_outcomes_and_bulk_read_are_recipient_scoped(self):
        url = f'/api/requests/{self.request.pk}/'
        response = self.client.post(url+'reject/')
        self.assertEqual(response.status_code, 200)
        notification = Notification.objects.get(event='request_rejected')
        self.client.force_authenticate(self.owner)
        self.assertEqual(self.client.get('/api/notifications/').data['items'][0]['target'], {'kind':'request','id':self.request.pk})
        notify(self.admin, self.reviewer.pk, 'review_ready', item=self.item)
        self.assertEqual(self.client.post('/api/notifications/read-all/').data['updated'], 1)
        self.assertTrue(Notification.objects.filter(recipient=self.reviewer, read_at__isnull=True).exists())
        notification.refresh_from_db()
        self.assertIsNotNone(notification.read_at)

    def test_acceptance_emits_once_and_does_not_grant_item_access(self):
        self.request.status = 'triaging'
        self.request.destination_group = self.group
        self.request.owner = self.other
        self.request.save()
        from intake.services import accept_work_request
        accepted, created = accept_work_request(self.request.pk, self.admin)
        self.assertTrue(created)
        accept_work_request(self.request.pk, self.admin)
        self.assertEqual(Notification.objects.filter(event='request_accepted').count(), 1)
        self.client.force_authenticate(self.owner)
        self.assertEqual(self.client.get(f'/api/work-items/{accepted.resulting_work_item_id}/').status_code, 404)
        self.assertEqual(self.client.get('/api/notifications/').data['items'][0]['target']['kind'], 'request')

    def test_authentication_is_required(self):
        self.client.force_authenticate(None)
        for url in ['/api/home/', '/api/notifications/']:
            self.assertIn(self.client.get(url).status_code, (401,403))

    def test_approval_notifies_owner(self):
        self.item.status = 'review'
        self.item.save()
        self.client.force_authenticate(self.reviewer)
        self.assertEqual(self.client.post(f'/api/work-items/{self.item.pk}/review/', {'decision':'approve'}).status_code, 200)
        self.assertEqual(Notification.objects.get(event='approved').recipient, self.owner)

    def test_notifications_pagination_archive_and_queries(self):
        Notification.objects.bulk_create([Notification(recipient=self.owner, event='assigned', work_item=self.item) for _ in range(55)])
        self.client.force_authenticate(self.owner)
        with self.assertNumQueries(2):
            data = self.client.get('/api/notifications/').data
        self.assertEqual(len(data['items']), 50)
        self.assertEqual(data['unread_count'], 55)
        next_page = self.client.get('/api/notifications/', {'before': data['next_before']}).data
        self.assertEqual(len(next_page['items']), 5)
        self.assertFalse(set(n['id'] for n in data['items']) & set(n['id'] for n in next_page['items']))
        self.group.archived = True
        self.group.save()
        self.assertEqual(self.client.get('/api/notifications/').data['unread_count'], 0)

    def test_recent_activity_is_real_and_scoped(self):
        WorkItem.objects.filter(pk=self.item.pk).update(updated_at=timezone.now()-timedelta(days=10))
        self.client.force_authenticate(self.owner)
        self.assertEqual(self.client.get('/api/home/').data['recent']['count'], 0)
        WorkActivity.objects.create(work_item=self.item, actor=self.admin, event='comment_added')
        self.assertEqual(self.client.get('/api/home/').data['recent']['count'], 1)
        self.client.force_authenticate(self.other)
        self.assertEqual(self.client.get('/api/home/').data['recent']['count'], 0)

    def test_new_mentions_on_edit_and_self_request_suppression(self):
        self.client.force_authenticate(self.owner)
        url = f'/api/work-items/{self.item.pk}/comments/'
        comment = self.client.post(url, {'body':'Hello'}, format='json').data
        self.client.patch(url+str(comment['id'])+'/', {'mentions':[self.reviewer.pk]}, format='json')
        self.assertEqual(Notification.objects.filter(event='mentioned').count(), 1)
        own_request = WorkRequest.objects.create(title='Own', submitted_by=self.admin)
        self.client.force_authenticate(self.admin)
        self.client.post(f'/api/requests/{own_request.pk}/reject/')
        self.assertFalse(Notification.objects.filter(recipient=self.admin).exists())
