import { describe, expect, it } from "vitest";
import {
  editorHref,
  homeHref,
  isEditorPath,
  runHref,
  runsHref,
  notificationHref,
  signInHref,
  versionHref,
  versionSourceHref,
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

  it("home_and_a_workflow_keep_their_period_and_a_run_its_view", () => {
    expect(homeHref({})).toBe("/");
    expect(homeHref({ period: "7d" })).toBe("/?period=7d");
    expect(workflowHref("sales", "route-lead", { period: "30d" })).toBe(
      "/workflows/sales/route-lead?period=30d",
    );
    expect(runHref("r 1", { view: "events" })).toBe("/runs/r%201?view=events");
  });

  it("a_run_and_a_notification_escape_their_ids", () => {
    expect(runHref("a/b")).toBe("/runs/a%2Fb");
    expect(notificationHref("n 1")).toBe("/notifications/n%201");
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

  it.each([
    ["/workflows/new", true],
    ["/workflows/sales/route-lead/edit", true],
    ["/workflows/sales/route-lead", false],
    ["/workflows/sales/route-lead/edit/more", false],
    ["/runs/7c41e2d0", false],
  ])("the_address_%s_is_the_editor_%s", (pathname, editing) => {
    const editor = isEditorPath(pathname);

    expect(editor).toBe(editing);
  });
});

describe("the addresses of a version", () => {
  it("a_version_keeps_its_view_in_the_query", () => {
    expect(versionHref("sales", "route-lead", "1.0.0", { view: "code" })).toBe(
      "/workflows/sales/route-lead/versions/1.0.0?view=code",
    );
  });

  it("a_version_source_is_its_own_address", () => {
    expect(versionSourceHref("sales", "route-lead", "1.0.0")).toBe(
      "/workflows/sales/route-lead/versions/1.0.0/source",
    );
  });
});
