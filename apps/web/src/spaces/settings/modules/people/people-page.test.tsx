import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/libs/ui/components/tooltip";
import { PeoplePage, type PeoplePageProps } from "./people-page";

vi.mock("./actions", () => ({ revokeAction: vi.fn(), inviteAction: vi.fn() }));

const PEOPLE: PeoplePageProps = {
  people: [
    {
      id: "u-3",
      email: "alan@example.com",
      name: null,
      role: "viewer",
      status: "suspended",
      since: "2026-11-02T16:00:00.000Z",
    },
  ],
  list: [
    {
      id: "i-1",
      email: "katherine@example.com",
      role: "editor",
      status: "pending",
      expiresAt: "2099-11-30T09:00:00.000Z",
      createdAt: "2026-11-23T09:00:00.000Z",
    },
  ],
};

function show() {
  render(
    <TooltipProvider>
      <PeoplePage {...PEOPLE} />
    </TooltipProvider>,
  );
}

describe("people", () => {
  it("a_member_without_a_name_shows_the_email_once", () => {
    show();

    expect(screen.getAllByText("alan@example.com")).toHaveLength(1);
  });

  it("no_date_is_said_as_a_time_to_come", () => {
    show();

    expect(screen.queryByText(/^in \d/)).toBeNull();
  });

  it("an_invitation_is_revoked_from_its_more_actions_after_a_confirmation_and_focus_returns", async () => {
    show();

    const row = screen.getByText("katherine@example.com").closest("tr");

    if (row === null) throw new Error("No invitation row");

    const more = within(row).getByRole("button", {
      name: "More actions for katherine@example.com",
    });
    fireEvent.pointerDown(more, { button: 0, ctrlKey: false });
    fireEvent.click(
      screen.getByRole("menuitem", { name: "Revoke invitation…" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Keep it" }));

    await waitFor(() => {
      expect(more).toHaveFocus();
    });
  });
});
