import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Page, Workflow, WorkflowStatus } from '@/libs/data-access/types';
import { searchableWorkflowsAction, signOutAction } from './actions';

const workflows = vi.fn<(status: WorkflowStatus) => Promise<Page<Workflow>>>();
const signOut = vi.fn<() => Promise<void>>();
const redirect = vi.fn<(href: string) => never>();

vi.mock('@/libs/data-access/automation', () => ({
  workflows: (status: WorkflowStatus) => workflows(status),
}));
vi.mock('@/libs/data-access/identity', () => ({
  signOut: () => signOut(),
}));
vi.mock('next/navigation', () => ({
  redirect: (href: string) => redirect(href),
}));

describe('signing out', () => {
  beforeEach(() => {
    signOut.mockReset();
    redirect.mockReset();
  });

  it('ends_the_session_and_opens_sign_in_saying_so', async () => {
    signOut.mockResolvedValue(undefined);

    await signOutAction();

    expect(signOut).toHaveBeenCalledTimes(1);
    expect(redirect).toHaveBeenCalledWith('/sign-in?reason=signed-out');
  });
});

describe('the workflows the search reads', () => {
  beforeEach(() => {
    workflows.mockReset();
  });

  it('are_the_active_ones_with_what_the_search_shows_of_each', async () => {
    workflows.mockResolvedValue({
      items: [
        {
          namespace: 'sales',
          name: 'route-lead',
          status: 'active',
          on: true,
          currentVersion: '1.2.0',
        },
      ],
      next: null,
    });

    const found = await searchableWorkflowsAction();

    expect(workflows).toHaveBeenCalledWith('active');
    expect(found).toEqual([
      { namespace: 'sales', name: 'route-lead', on: true },
    ]);
  });

  it('none_active_is_nothing_found', async () => {
    workflows.mockResolvedValue({ items: [], next: null });

    const found = await searchableWorkflowsAction();

    expect(found).toEqual([]);
  });
});
