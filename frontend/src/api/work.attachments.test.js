import { workApi } from './work';
import api from './index';

jest.mock('./index', () => ({ post: jest.fn(), get: jest.fn() }));

beforeEach(() => jest.clearAllMocks());

test('text comments keep the JSON request', () => {
  const payload = { body: 'Hello', mentions: [2] };
  workApi.createComment(3, payload);
  expect(api.post).toHaveBeenCalledWith('/api/work-items/3/comments/', payload);
});

test('attachments use multipart with repeated files, mentions and reply parent', () => {
  const first = new File(['image'], 'shot.png', { type: 'image/png' });
  const second = new File(['%PDF-file'], 'brief.pdf', { type: 'application/pdf' });
  workApi.createComment(3, { body: '', mentions: [2, 4], parent: 9, attachments: [first, second] });
  const [path, data, config] = api.post.mock.calls[0];
  expect(path).toBe('/api/work-items/3/comments/');
  expect(data).toBeInstanceOf(FormData);
  expect(data.get('body')).toBe('');
  expect(data.getAll('mentions')).toEqual(['2', '4']);
  expect(data.get('parent')).toBe('9');
  expect(data.getAll('attachments')).toEqual([first, second]);
  expect(config.headers['Content-Type']).toBeUndefined();
});

test('attachment retrieval uses the authenticated API client as a blob', () => {
  workApi.getCommentAttachment(3, 9, 12);
  expect(api.get).toHaveBeenCalledWith('/api/work-items/3/comments/9/attachments/12/', { responseType: 'blob' });
});
