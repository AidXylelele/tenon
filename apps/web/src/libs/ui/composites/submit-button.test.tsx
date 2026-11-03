import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SubmitButton } from './submit-button';

describe("a form's submit button", () => {
  it('shows_that_the_form_is_being_sent_and_cannot_be_pressed_twice', async () => {
    let finish: () => void = () => undefined;
    const sent = new Promise<void>((resolve) => {
      finish = resolve;
    });
    render(
      <form action={() => sent}>
        <SubmitButton pendingLabel="Signing in…">Sign in</SubmitButton>
      </form>,
    );

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    });
    const sending = screen.getByRole('button', { name: /Signing in…/ });
    const disabled = (sending as HTMLButtonElement).disabled;
    await act(async () => {
      finish();
      await sent;
    });

    expect(disabled).toBe(true);
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeEnabled();
  });

  it('stays_disabled_when_the_form_says_so', () => {
    render(
      <form>
        <SubmitButton disabled>Save</SubmitButton>
      </form>,
    );

    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });
});
