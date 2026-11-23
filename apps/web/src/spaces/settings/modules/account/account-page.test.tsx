import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AccountPage } from "./account-page";

vi.mock("./actions", () => ({ changePasswordAction: vi.fn() }));

describe("the account page", () => {
  it("names_the_person_their_email_and_what_their_role_does", () => {
    render(
      <AccountPage
        user={{
          id: "user-2",
          email: "grace@example.com",
          name: "Grace Hopper",
          role: "viewer",
        }}
      />,
    );

    expect(screen.getByText("Grace Hopper")).toBeVisible();
    expect(screen.getByText("grace@example.com")).toBeVisible();
    expect(screen.getByText("Viewer: reads workflows and runs")).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Change password" }),
    ).toBeVisible();
  });
});
