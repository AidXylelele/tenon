import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PasswordReset } from "./password-reset";

vi.mock("./actions", () => ({ resetPasswordAction: vi.fn() }));

describe("resetting a password", () => {
  it("a_link_with_its_token_asks_for_the_new_password", () => {
    render(<PasswordReset query={{ token: "t" }} />);

    expect(screen.getByLabelText("New password")).toHaveFocus();
    expect(screen.getByRole("button", { name: "Set password" })).toBeVisible();
  });

  it("a_link_without_a_token_offers_a_new_link", () => {
    render(<PasswordReset query={{}} />);

    expect(screen.getByText("This link is incomplete")).toBeVisible();
    expect(
      screen.getByRole("link", { name: "Ask for a new link" }),
    ).toHaveAttribute("href", "/forgot-password");
  });
});
