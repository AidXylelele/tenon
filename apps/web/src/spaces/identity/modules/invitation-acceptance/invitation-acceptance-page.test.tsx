import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { InvitationAcceptancePage } from "./invitation-acceptance-page";

vi.mock("./actions", () => ({ acceptInvitationAction: vi.fn() }));

describe("accepting an invitation", () => {
  it("a_valid_invitation_names_the_role_and_keeps_the_email_readable", () => {
    render(
      <InvitationAcceptancePage
        check={{
          kind: "valid",
          token: "t",
          invitation: { email: "grace@example.com", role: "editor" },
        }}
      />,
    );

    expect(screen.getByText(/You are invited as an editor/)).toBeVisible();
    const email = screen.getByLabelText("Email");
    expect(email).toHaveValue("grace@example.com");
    expect(email).toHaveAttribute("readonly");
    expect(email).toBeEnabled();
  });

  it("a_refused_invitation_says_why_and_what_to_do", () => {
    render(
      <InvitationAcceptancePage
        check={{ kind: "refused", reason: "This invitation has expired." }}
      />,
    );

    expect(screen.getByText("This invitation has expired.")).toBeVisible();
    expect(
      screen.getByRole("link", { name: "Already have an account? Sign in" }),
    ).toHaveAttribute("href", "/sign-in");
  });
});
