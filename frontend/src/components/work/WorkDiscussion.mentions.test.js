import '@testing-library/jest-dom';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { act } from 'react-dom/test-utils';
import WorkDiscussion from './WorkDiscussion';

jest.mock('@radix-ui/react-dialog', () => ({}));

test('a newly added active user beyond the first six can be selected and posted as a mention', async () => {
  const users = [...Array.from({ length: 6 }, (_, index) => ({
    id: index + 1, display_name: `Staff ${index + 1}`, email: `staff${index + 1}@example.com`,
  })), { id: 7, display_name: 'New Person', email: 'new@example.com' }];
  const run = jest.fn(async (save) => { await save(); return true; });
  const createComment = jest.spyOn(require('../../api/work').workApi, 'createComment').mockResolvedValue({});

  render(<WorkDiscussion itemId={1} comments={[]} users={users} busy={false} run={run}
    onDraftDirty={() => {}} hasDirty={() => false} />);
  const input = screen.getByRole('textbox', { name: /^Post update/ });
  fireEvent.change(input, { target: { value: '@' } });
  const suggestions = screen.getByLabelText('Mention suggestions');
  fireEvent.click(within(suggestions).getByRole('button', { name: /New Person/ }));
  expect(input).toHaveValue('@new@example.com ');
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Post update' })); });
  expect(createComment).toHaveBeenCalledWith(1, { body: '@new@example.com', mentions: [7] });
  createComment.mockRestore();
});
