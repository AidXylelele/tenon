import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Role, User } from '@/libs/data-access/types';
import type { FoundWorkflow } from './actions';
import { CommandPalette } from './command-palette';

const push = vi.fn<(href: string) => void>();
const searchable = vi.fn<() => Promise<FoundWorkflow[]>>();

vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
vi.mock('./actions', () => ({
  searchableWorkflowsAction: () => searchable(),
}));

const lead: FoundWorkflow = {
  namespace: 'sales',
  name: 'route-lead',
  on: true,
};

// A person of a role.
function userOf(role: Role): User {
  return { id: 'user-1', email: 'ada@example.com', name: 'Ada', role };
}

// The palette for a person.
function renderFor(user: User | null) {
  return render(<CommandPalette user={user} />);
}

// The workflow the search found, once its answer has come.
function foundLead() {
  return screen.findByRole('option', { name: /route-lead/ });
}

// The ⌘K or Ctrl+K a person presses anywhere on the page.
function pressK(modifier: 'metaKey' | 'ctrlKey') {
  fireEvent.keyDown(window, { key: 'k', [modifier]: true });
}

// The names of the palette's options, in order.
function optionNames(): string[] {
  return screen
    .getAllByRole('option')
    .map((option) => option.textContent ?? '');
}

describe('the search of the console', () => {
  beforeEach(() => {
    push.mockReset();
    searchable.mockReset();
    // The workflows are still being read, unless a test answers.
    searchable.mockReturnValue(new Promise(() => undefined));
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
    Element.prototype.scrollIntoView = vi.fn();
  });

  it('is_closed_until_asked_for_and_reads_nothing_meanwhile', () => {
    renderFor(userOf('viewer'));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(searchable).not.toHaveBeenCalled();
  });

  it.each([
    ['Command', 'metaKey' as const],
    ['Ctrl', 'ctrlKey' as const],
  ])('%s_K_opens_it_and_reads_the_workflows', (_, modifier) => {
    renderFor(userOf('viewer'));

    pressK(modifier);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(searchable).toHaveBeenCalledTimes(1);
  });

  it('K_without_a_modifier_is_typing_and_opens_nothing', () => {
    renderFor(userOf('viewer'));

    fireEvent.keyDown(window, { key: 'k' });

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('command_K_again_closes_it_without_reading_again', () => {
    renderFor(userOf('viewer'));

    pressK('metaKey');
    pressK('metaKey');

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(searchable).toHaveBeenCalledTimes(1);
  });

  it('the_button_opens_it_and_each_opening_reads_again', () => {
    renderFor(userOf('viewer'));
    const button = screen.getByRole('button', {
      name: /Search workflows and pages/,
    });

    fireEvent.click(button);
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    fireEvent.click(button);

    expect(searchable).toHaveBeenCalledTimes(2);
  });

  it('a_workflow_found_closes_the_search_and_opens_its_page', async () => {
    searchable.mockResolvedValue([lead]);
    renderFor(userOf('viewer'));
    pressK('metaKey');

    fireEvent.click(await foundLead());

    expect(push).toHaveBeenCalledWith('/workflows/sales/route-lead');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('a_viewer_finds_the_workflows_the_pages_for_everyone_and_no_actions', async () => {
    searchable.mockResolvedValue([lead]);
    renderFor(userOf('viewer'));
    pressK('metaKey');
    await foundLead();

    expect(optionNames()).toEqual([
      'route-leadsalesOn',
      'Home',
      'Workflows',
      'Runs',
      'Runs that faulted',
      'Account and password',
      'Supported standard',
    ]);
  });

  it('an_editor_finds_the_actions_and_the_pages_that_connect_automations', () => {
    renderFor(userOf('editor'));
    pressK('metaKey');
    const names = optionNames();

    expect(names.slice(0, 3)).toEqual([
      'New workflow',
      'New webhook',
      'Send a test event',
    ]);
    expect(names).toContain('Webhooks');
    expect(names).toContain('Credentials');
    expect(names).not.toContain('Team and invitations');
  });

  it('an_administrator_also_finds_the_team', () => {
    renderFor(userOf('admin'));
    pressK('metaKey');

    expect(optionNames()).toContain('Team and invitations');
  });

  it('the_arrow_keys_move_through_the_options_and_enter_opens_one', () => {
    renderFor(userOf('viewer'));
    pressK('metaKey');
    const input = screen.getByRole('combobox');

    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(push).toHaveBeenCalledWith('/workflows');
  });

  it('what_is_typed_narrows_the_options', () => {
    renderFor(userOf('viewer'));
    pressK('metaKey');

    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: 'faulted' },
    });

    expect(optionNames()).toEqual(['Runs that faulted']);
  });
});
