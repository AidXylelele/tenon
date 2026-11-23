import { describe, expect, it } from "vitest";
import {
  editorHref,
  runHref,
  runsHref,
  notificationHref,
  signInHref,
  versionHref,
  workflowHref,
  workflowsHref,
} from "./routes";

describe("the addresses of the console", () => {
  it("a_workflow_its_version_and_its_editor_escape_their_names", () => {
    expect(workflowHref("sales team", "route/lead")).toBe(
      "/workflows/sales%20team/route%2Flead",
    );
    expect(versionHref("sales", "route-lead", "1.0.0+build")).toBe(
      "/workflows/sales/route-lead/versions/1.0.0%2Bbuild",
    );
    expect(editorHref("sales", "route-lead")).toBe(
      "/workflows/sales/route-lead/edit",
    );
  });

  it("a_workflow_opens_on_a_tab_or_with_a_run_being_started", () => {
    expect(workflowHref("sales", "route-lead", { tab: "versions" })).toBe(
      "/workflows/sales/route-lead?tab=versions",
    );
    expect(workflowHref("sales", "route-lead", { start: true })).toBe(
      "/workflows/sales/route-lead?start=1",
    );
    expect(workflowHref("sales", "route-lead", { start: false })).toBe(
      "/workflows/sales/route-lead",
    );
  });

  it("the_editor_opens_at_a_task_when_one_is_given", () => {
    expect(editorHref("sales", "route-lead", "/do/0/fetch")).toBe(
      "/workflows/sales/route-lead/edit?task=%2Fdo%2F0%2Ffetch",
    );
  });

  it("a_run_and_a_notification_escape_their_ids", () => {
    expect(runHref("a/b")).toBe("/runs/a%2Fb");
    expect(notificationHref("n 1")).toBe("/connections/notifications/n%201");
  });

  it("the_workflows_list_keeps_its_tab_and_its_page", () => {
    expect(workflowsHref({})).toBe("/workflows");
    expect(workflowsHref({ status: "archived" })).toBe(
      "/workflows?status=archived",
    );
    expect(workflowsHref({ status: "active", cursor: "abc=" })).toBe(
      "/workflows?status=active&cursor=abc%3D",
    );
  });

  it("the_runs_list_keeps_only_the_filters_given", () => {
    expect(runsHref({})).toBe("/runs");
    expect(
      runsHref({
        namespace: "sales",
        name: "",
        status: "in-progress,failed",
        started: "24h",
        page: 2,
        size: undefined,
        sort: "duration",
      }),
    ).toBe(
      "/runs?namespace=sales&status=in-progress%2Cfailed&started=24h&page=2&sort=duration",
    );
  });

  it("sign_in_says_why_and_where_to_return", () => {
    expect(signInHref({})).toBe("/sign-in");
    expect(signInHref({ reason: "ended", next: "/runs?phase=running" })).toBe(
      "/sign-in?reason=ended&next=%2Fruns%3Fphase%3Drunning",
    );
  });
});
