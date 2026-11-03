import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CheckStatus } from './check-status';

describe('what the check says', () => {
  it('says_when_the_draft_is_being_checked_and_when_it_is_ready', () => {
    const { rerender } = render(
      <CheckStatus
        state={{ kind: 'checking' }}
        textError={null}
        onShow={vi.fn()}
      />,
    );
    expect(screen.getByRole('status')).toHaveTextContent(
      'Checking with the platform…',
    );

    rerender(
      <CheckStatus
        state={{ kind: 'clean' }}
        textError={null}
        onShow={vi.fn()}
      />,
    );
    expect(screen.getByRole('status')).toHaveTextContent('Ready to publish');
  });

  it('a_problem_shows_its_located_reason_and_leads_to_it', () => {
    const onShow = vi.fn();
    const problem = {
      type: 'urn:problem:definition.invalid',
      title: 'The workflow definition is invalid',
      status: 422,
      detail: 'invalid',
      errors: [
        { pointer: '/schedule/cron', detail: 'Invalid cron expression' },
      ],
    };
    render(
      <CheckStatus
        state={{ kind: 'problem', problem }}
        textError={null}
        onShow={onShow}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Show' }));

    expect(screen.getByRole('status')).toHaveTextContent(
      'Invalid cron expression',
    );
    expect(onShow).toHaveBeenCalled();
  });

  it('text_that_does_not_parse_speaks_before_the_check', () => {
    render(
      <CheckStatus
        state={{ kind: 'clean' }}
        textError="Line 3: unexpected end"
        onShow={vi.fn()}
      />,
    );

    expect(screen.getByRole('status')).toHaveTextContent(
      'Line 3: unexpected end',
    );
  });
});
