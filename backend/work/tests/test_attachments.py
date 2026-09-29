import os
import tempfile
from io import BytesIO
from unittest.mock import patch

from PIL import Image
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from work.models import WorkComment, WorkCommentAttachment, WorkItem, Workspace


@override_settings(SECURE_SSL_REDIRECT=False)
class AttachmentTests(TestCase):
    def setUp(self):
        self.media = tempfile.TemporaryDirectory()
        self.addCleanup(self.media.cleanup)
        media_setting = override_settings(MEDIA_ROOT=self.media.name)
        media_setting.enable()
        self.addCleanup(media_setting.disable)
        User = get_user_model()
        self.admin = User.objects.create_user(email='admin@files.test', is_staff=True)
        self.owner = User.objects.create_user(email='owner@files.test')
        self.outsider = User.objects.create_user(email='outsider@files.test')
        group = Workspace.objects.first().groups.first()
        self.item = WorkItem.objects.create(group=group, title='Files', owner=self.owner, created_by=self.admin)
        self.other = WorkItem.objects.create(group=group, title='Other', owner=self.owner, created_by=self.admin)
        self.url = f'/api/work-items/{self.item.pk}/comments/'
        self.client = APIClient()
        self.client.force_authenticate(self.owner)

    def file(self, name='note.pdf', size=20):
        return SimpleUploadedFile(name, b'%PDF-' + b'x' * (size - 5), content_type='application/pdf')

    def post(self, files=(), body='Text', parent=None):
        data = {'body': body, 'attachments': list(files)}
        if parent is not None:
            data['parent'] = str(parent)
        return self.client.post(self.url, data, format='multipart')

    def download(self, attachment, item=None, comment=None):
        return self.client.get(f'/api/work-items/{item or self.item.pk}/comments/'
                               f'{comment or attachment.comment_id}/attachments/{attachment.pk}/')

    def test_json_text_comment_and_reply_still_work(self):
        parent = self.client.post(self.url, {'body': 'Hello'}, format='json')
        reply = self.client.post(self.url, {'body': 'Reply', 'parent': parent.data['id']}, format='json')
        self.assertEqual((parent.status_code, reply.status_code), (201, 201))
        self.assertEqual(parent.data['attachments'], [])
        self.assertEqual(reply.data['parent'], parent.data['id'])

    def test_top_level_reply_multiple_and_attachment_only(self):
        parent = self.post([self.file('../safe.pdf'), self.file('second.pdf')], body='')
        self.assertEqual(parent.status_code, 201, parent.data)
        self.assertEqual(len(parent.data['attachments']), 2)
        self.assertEqual(parent.data['attachments'][0]['filename'], 'safe.pdf')
        self.assertNotIn('file', parent.data['attachments'][0])
        self.assertEqual(parent.data['body'], '')
        reply = self.post([self.file()], body='', parent=parent.data['id'])
        self.assertEqual(reply.status_code, 201, reply.data)
        self.assertEqual(reply.data['parent'], parent.data['id'])
        attachment = WorkCommentAttachment.objects.get(pk=reply.data['attachments'][0]['id'])
        self.assertEqual(self.download(attachment).status_code, 200)
        self.assertTrue(attachment.file.name.startswith('discussion/'))
        self.assertNotIn('note.pdf', attachment.file.name)

    def test_image_content_is_detected_and_mentions_survive_multipart(self):
        image = BytesIO()
        Image.new('RGB', (2, 2), 'blue').save(image, format='PNG')
        response = self.client.post(self.url, {'body': 'See image', 'mentions': [str(self.admin.pk)],
                                               'attachments': [SimpleUploadedFile('shot.png', image.getvalue(), content_type='text/plain')]},
                                    format='multipart')
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data['mentions'], [self.admin.pk])
        self.assertEqual(response.data['attachments'][0]['content_type'], 'image/png')
        attachment = WorkCommentAttachment.objects.get(pk=response.data['attachments'][0]['id'])
        downloaded = self.download(attachment)
        self.assertEqual(downloaded['Content-Type'], 'image/png')
        self.assertEqual(downloaded['X-Content-Type-Options'], 'nosniff')

    def test_empty_and_invalid_limits_are_rejected_without_records(self):
        for response in (
            self.client.post(self.url, {'body': '   '}, format='json'),
            self.post(body=''),
            self.post([self.file(f'{index}.pdf') for index in range(6)]),
            self.post([self.file(size=10 * 1024 * 1024 + 1)]),
            self.post([self.file(f'{index}.pdf', size=9 * 1024 * 1024) for index in range(3)]),
            self.post([SimpleUploadedFile('evil.exe', b'MZdanger')]),
            self.post([SimpleUploadedFile('fake.png', b'not an image')]),
        ):
            self.assertEqual(response.status_code, 400, response.data)
        self.assertFalse(WorkComment.objects.exists())
        self.assertFalse(WorkCommentAttachment.objects.exists())
        self.assertEqual(os.listdir(self.media.name), [])

    def test_download_inherits_item_visibility_and_comment_deletion(self):
        response = self.post([self.file()])
        attachment = WorkCommentAttachment.objects.get(pk=response.data['attachments'][0]['id'])
        self.assertEqual(self.download(attachment, item=self.other.pk).status_code, 404)
        self.client.force_authenticate(self.outsider)
        self.assertEqual(self.download(attachment).status_code, 404)
        self.client.force_authenticate(None)
        self.assertEqual(self.download(attachment).status_code, 401)
        self.client.force_authenticate(self.owner)
        self.assertEqual(self.client.delete(self.url + f'{attachment.comment_id}/').status_code, 204)
        self.assertEqual(self.download(attachment).status_code, 404)
        comments = self.client.get(self.url)
        self.assertEqual(comments.data[0]['attachments'], [])

    def test_edit_preserves_attachment(self):
        response = self.post([self.file()])
        comment_id = response.data['id']
        edited = self.client.patch(self.url + f'{comment_id}/', {'body': 'Edited'}, format='json')
        self.assertEqual(edited.status_code, 200)
        self.assertEqual(len(edited.data['attachments']), 1)
        self.assertEqual(WorkCommentAttachment.objects.filter(comment_id=comment_id).count(), 1)

    def test_failed_activity_rolls_back_and_deletes_stored_file(self):
        with patch('work.views.record_activity', side_effect=RuntimeError('audit failed')):
            with self.assertRaises(RuntimeError):
                self.post([self.file()])
        self.assertFalse(WorkComment.objects.exists())
        self.assertFalse(WorkCommentAttachment.objects.exists())
        self.assertEqual(os.listdir(os.path.join(self.media.name, 'discussion')), [])
