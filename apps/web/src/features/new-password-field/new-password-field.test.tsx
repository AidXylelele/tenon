import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { NewPasswordField } from './new-password-field';

describe('a password being chosen', () => {
  it('is_sent_under_its_name_and_saved_by_the_browser_as_new', () => {
    render(<NewPasswordField name="newPassword" label="New password" />);
    const field = screen.getByLabelText('New password');

    expect(field).toHaveAttribute('name', 'newPassword');
    expect(field).toHaveAttribute('type', 'password');
    expect(field).toHaveAttribute('autocomplete', 'new-password');
    expect(field).toBeRequired();
  });

  it('has_the_length_the_api_checks_and_says_so', () => {
    render(<NewPasswordField name="password" label="Password" />);
    const field = screen.getByLabelText('Password');

    expect(field).toHaveAttribute('minlength', '12');
    expect(field).toHaveAttribute('maxlength', '128');
    expect(screen.getByText('At least 12 characters.')).toBeInTheDocument();
  });

  it('a_page_adds_its_own_sentence_after_the_length', () => {
    render(
      <NewPasswordField
        name="password"
        label="Password"
        note="Every other session ends."
      />,
    );

    expect(
      screen.getByText('At least 12 characters. Every other session ends.'),
    ).toBeInTheDocument();
  });

  it('takes_the_focus_only_when_asked', () => {
    const { unmount } = render(
      <NewPasswordField name="password" label="Password" />,
    );
    const unfocused = document.activeElement;
    unmount();
    render(<NewPasswordField name="password" label="Password" autoFocus />);

    expect(unfocused).toBe(document.body);
    expect(screen.getByLabelText('Password')).toHaveFocus();
  });
});
