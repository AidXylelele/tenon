import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { NewPasswordField } from "./new-password-field";

describe("a password being chosen", () => {
  it("is_sent_under_its_name_and_saved_by_the_browser_as_new", () => {
    render(<NewPasswordField name="newPassword" label="New password" />);
    const field = screen.getByLabelText("New password");

    expect(field).toHaveAttribute("name", "newPassword");
    expect(field).toHaveAttribute("type", "password");
    expect(field).toHaveAttribute("autocomplete", "new-password");
    expect(field).toBeRequired();
  });

  it("has_the_length_the_api_checks_and_says_so", () => {
    render(<NewPasswordField name="password" label="Password" />);
    const field = screen.getByLabelText("Password");

    expect(field).toHaveAttribute("minlength", "12");
    expect(field).toHaveAttribute("maxlength", "128");
    expect(field).toHaveAccessibleDescription("At least 12 characters.");
  });

  it("does_not_take_the_focus_unasked", () => {
    render(<NewPasswordField name="password" label="Password" />);

    expect(document.activeElement).toBe(document.body);
  });

  it("takes_the_focus_when_asked", () => {
    render(<NewPasswordField name="password" label="Password" autoFocus />);

    expect(screen.getByLabelText("Password")).toHaveFocus();
  });

  it("says_its_rule_under_the_label_before_the_field", () => {
    render(<NewPasswordField name="password" label="Password" />);
    const rule = screen.getByText("At least 12 characters.");
    const field = screen.getByLabelText("Password");

    const order = rule.compareDocumentPosition(field);
    expect(order & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("adds_its_note_after_the_length", () => {
    render(
      <NewPasswordField
        name="newPassword"
        label="New password"
        note="Every other session ends."
      />,
    );
    const field = screen.getByLabelText("New password");

    expect(field).toHaveAccessibleDescription(
      "At least 12 characters. Every other session ends.",
    );
  });
});
