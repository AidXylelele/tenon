import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Problem } from '@/libs/data-access/problem';
import { ProblemMessage } from './problem-message';

const PROBLEM: Problem = {
  type: 'urn:problem:definition.invalid',
  title: 'The workflow definition is invalid',
  status: 422,
  detail: 'must have required property endpoint',
  errors: [
    {
      pointer: '/do/0/fetch/with',
      detail: 'must have required property endpoint',
    },
    { pointer: '/schedule/cron', detail: 'Invalid cron expression' },
  ],
};

describe('a refusal of the API on the page', () => {
  it('shows_its_title_detail_and_each_other_location', () => {
    render(<ProblemMessage problem={PROBLEM} />);

    expect(screen.getByRole('alert')).toHaveTextContent(
      'The workflow definition is invalid',
    );
    expect(
      screen.getByText('must have required property endpoint'),
    ).toBeInTheDocument();
    expect(screen.getByText('/schedule/cron')).toBeInTheDocument();
    expect(screen.queryByText('/do/0/fetch/with')).toBeNull();
  });

  it('without_a_refusal_it_shows_nothing', () => {
    const { container } = render(<ProblemMessage problem={null} />);

    expect(container).toBeEmptyDOMElement();
  });
});
