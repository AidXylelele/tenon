import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { InstanceSummary } from '@/libs/data-access/types';
import { RunTable } from './run-table';

// Next's link, reduced to the anchor it renders.
vi.mock('next/link', () => ({
  default: ({
    prefetch,
    href,
    children,
    ...props
  }: React.ComponentProps<'a'> & { readonly prefetch: boolean | null }) => (
    <a href={href} data-prefetch={String(prefetch)} {...props}>
      {children}
    </a>
  ),
}));

const finished: InstanceSummary = {
  id: 'run-1',
  namespace: 'sales',
  name: 'route-lead',
  version: '1.2.0',
  phase: 'completed',
  trigger: 'schedule',
  createdAt: '2026-11-03T09:00:00Z',
  startedAt: '2026-11-03T09:00:01Z',
  endedAt: '2026-11-03T09:01:31Z',
};

const pending: InstanceSummary = {
  id: 'run-2',
  namespace: 'billing',
  name: 'charge-card',
  version: '0.1.0',
  phase: 'pending',
  trigger: 'manual',
  createdAt: '2026-11-03T10:00:00Z',
  startedAt: null,
  endedAt: null,
};

const nothing = <p>No runs yet</p>;

// The table's body rows, without its heading row.
function rows(): HTMLElement[] {
  const [, ...body] = screen.getAllByRole('row');
  return body;
}

// The table's first body row.
function firstRow(): HTMLElement {
  const [row] = rows();

  if (row === undefined) throw new Error('The table has no row');

  return row;
}

describe('runs as a table', () => {
  it('each_run_is_a_row_that_opens_its_run', () => {
    render(<RunTable runs={[finished, pending]} empty={nothing} />);
    const first = screen.getByRole('link', { name: 'Run run-1' });
    const second = screen.getByRole('link', { name: 'Run run-2' });

    expect(rows()).toHaveLength(2);
    expect(first).toHaveAttribute('href', '/instances/run-1');
    expect(second).toHaveAttribute('href', '/instances/run-2');
  });

  it('a_row_shows_the_phase_the_workflow_the_version_and_what_started_it', () => {
    render(<RunTable runs={[finished]} empty={nothing} />);
    const row = firstRow();
    const cells = within(row);

    expect(cells.getByText('Completed')).toBeInTheDocument();
    expect(cells.getByText('route-lead')).toBeInTheDocument();
    expect(cells.getByText('in sales')).toBeInTheDocument();
    expect(cells.getByText('1.2.0')).toBeInTheDocument();
    expect(cells.getByText('Schedule')).toBeInTheDocument();
  });

  it('a_run_is_dated_by_its_start_and_lasts_from_start_to_end', () => {
    render(<RunTable runs={[finished]} empty={nothing} />);
    const row = firstRow();
    const time = row.querySelector('time');

    expect(time).toHaveAttribute('dateTime', finished.startedAt);
    expect(within(row).getByText('1 min 30 s')).toBeInTheDocument();
  });

  it('a_run_not_yet_started_is_dated_by_its_creation_and_has_no_duration', () => {
    render(<RunTable runs={[pending]} empty={nothing} />);
    const row = firstRow();
    const cells = within(row);
    const time = row.querySelector('time');

    expect(time).toHaveAttribute('dateTime', pending.createdAt);
    expect(cells.getByText('—')).toBeInTheDocument();
    expect(cells.getByText('By hand')).toBeInTheDocument();
  });

  it('each_row_names_the_phase_of_its_run', () => {
    render(<RunTable runs={[finished, pending]} empty={nothing} />);
    const [, first, second] = screen.getAllByRole('row');

    expect(first).toHaveTextContent('Completed');
    expect(second).toHaveTextContent('Pending');
  });

  it('a_workflow_page_leaves_the_workflow_column_out', () => {
    render(<RunTable runs={[finished]} showWorkflow={false} empty={nothing} />);

    expect(
      screen.queryByRole('columnheader', { name: 'Workflow' }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText('in sales')).not.toBeInTheDocument();
  });

  it('the_workflow_column_shows_by_default', () => {
    render(<RunTable runs={[finished]} empty={nothing} />);

    expect(
      screen.getByRole('columnheader', { name: 'Workflow' }),
    ).toBeInTheDocument();
  });

  it('without_runs_the_page_shows_what_it_gave_instead_of_a_table', () => {
    render(<RunTable runs={[]} empty={nothing} />);

    expect(screen.getByText('No runs yet')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });
});
