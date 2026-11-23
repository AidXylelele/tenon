import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SUBSCRIPTIONS } from "../../__shared_context/connections.test-support";
import { RUN_EVENTS } from "../../__shared_context/run-events.test-support";
import { NotificationListPage } from "./notification-list-page";

describe("the notification list", () => {
  it("a_run_event_reads_in_words_and_another_by_its_attributes", () => {
    render(
      <NotificationListPage
        subscriptions={SUBSCRIPTIONS}
        runEvents={RUN_EVENTS}
      />,
    );

    expect(screen.getByText("A run fails")).toBeVisible();
    expect(
      screen.getByText(/An event where type is com.example.invoice.sent.v1/),
    ).toBeVisible();
    expect(
      screen.getByRole("link", { name: "Failed runs to the on-call channel" }),
    ).toHaveAttribute(
      "href",
      "/notifications/ae769898-1c2d-4e5f-8a9b-0c1d2e3f4a5b",
    );
  });

  it("with_none_the_empty_state_holds_the_one_create_action", () => {
    render(<NotificationListPage subscriptions={[]} runEvents={RUN_EVENTS} />);

    const creates = screen.getAllByRole("link", { name: "New notification" });
    expect(creates).toHaveLength(1);
  });
});
