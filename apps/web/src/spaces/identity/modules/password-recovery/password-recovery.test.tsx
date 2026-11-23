import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PasswordRecovery } from "./password-recovery";

vi.mock("./actions", () => ({ requestRecoveryAction: vi.fn() }));

describe("asking for a password link", () => {
  it("asks_for_the_email_with_one_primary_and_a_way_back", () => {
    render(<PasswordRecovery />);

    expect(screen.getByLabelText("Email")).toHaveFocus();
    expect(
      screen.getByRole("button", { name: "Email me a link" }),
    ).toBeVisible();
    expect(
      screen.getByRole("link", { name: "Back to sign in" }),
    ).toHaveAttribute("href", "/sign-in");
  });
});
