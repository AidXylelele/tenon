import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { TrashIcon } from 'lucide-react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Outcome } from '@/libs/data-access/problem';
import { ConfirmAction } from './confirm-action';

const toastSuccess = vi.fn();
const toastError = vi.fn();

vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccess(...args),
    error: (...args: unknown[]) => toastError(...args),
  },
}));

const REFUSED: Outcome<void> = {
  ok: false,
  problem: {
    type: 'urn:problem:secret.in-use',
    title: 'The secret is in use',
    status: 409,
    detail: 'A running workflow uses it',
    errors: [],
  },
};

// The composite as a delete of one secret, with the action given.
function renderDelete(action: () => Promise<Outcome<void>>) {
  return render(
    <ConfirmAction
      icon={<TrashIcon />}
      label="Delete stripe-key"
      size="icon-sm"
      title="Delete stripe-key?"
      description="Runs that need it fail."
      actionLabel="Delete"
      action={action}
      success="stripe-key deleted"
    />,
  );
}

describe('an action that asks first', () => {
  beforeEach(() => {
    toastSuccess.mockClear();
    toastError.mockClear();
  });

  it('asks_with_what_it_changes_and_keeping_it_does_nothing', () => {
    const action = vi.fn();
    renderDelete(action);

    fireEvent.click(screen.getByRole('button', { name: 'Delete stripe-key' }));
    const dialog = screen.getByRole('alertdialog', {
      name: 'Delete stripe-key?',
    });
    expect(dialog).toHaveAccessibleDescription('Runs that need it fail.');
    fireEvent.click(screen.getByRole('button', { name: 'Keep it' }));

    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(action).not.toHaveBeenCalled();
  });

  it('acts_once_confirmed_and_says_it_is_done', async () => {
    const action = vi.fn().mockResolvedValue({ ok: true, value: undefined });
    renderDelete(action);

    fireEvent.click(screen.getByRole('button', { name: 'Delete stripe-key' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() =>
      expect(toastSuccess).toHaveBeenCalledWith('stripe-key deleted'),
    );
    expect(action).toHaveBeenCalledTimes(1);
    expect(toastError).not.toHaveBeenCalled();
  });

  it('a_refusal_says_why', async () => {
    const action = vi.fn().mockResolvedValue(REFUSED);
    renderDelete(action);

    fireEvent.click(screen.getByRole('button', { name: 'Delete stripe-key' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith('A running workflow uses it'),
    );
    expect(toastSuccess).not.toHaveBeenCalled();
  });

  it('cannot_be_pressed_again_while_it_acts', async () => {
    let finish: (outcome: Outcome<void>) => void = () => undefined;
    const pending = new Promise<Outcome<void>>((resolve) => {
      finish = resolve;
    });
    renderDelete(() => pending);

    fireEvent.click(screen.getByRole('button', { name: 'Delete stripe-key' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    const trigger = await screen.findByRole('button', {
      name: 'Delete stripe-key',
    });
    await waitFor(() => expect(trigger).toBeDisabled());
    finish({ ok: true, value: undefined });

    await waitFor(() => expect(trigger).toBeEnabled());
  });

  it('a_button_with_a_size_of_its_own_shows_its_label', () => {
    render(
      <ConfirmAction
        icon={<TrashIcon />}
        label="Archive"
        title="Archive route-lead?"
        description="It starts no run."
        actionLabel="Archive"
        action={vi.fn()}
        success="route-lead archived"
      />,
    );

    expect(screen.getByRole('button', { name: 'Archive' })).toHaveTextContent(
      'Archive',
    );
  });
});
