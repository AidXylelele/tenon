import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  expectedStarts,
  failingWorkflows,
  instanceCounts,
  instances,
  publishEvent,
  startInstance,
  subscription,
  turnWorkflow,
  versionDocument,
  workflow,
  workflows,
} from "./automation";

const { read, command } = vi.hoisted(() => ({
  read: vi.fn(),
  command: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("./http", async () => {
  const actual = await vi.importActual<typeof import("./http")>("./http");
  return { ApiError: actual.ApiError, read, command };
});
vi.mock("next/headers", () => ({}));
vi.mock("next/navigation", () => ({}));

const NOW = Date.parse("2026-11-03T12:00:00Z");

describe("the automation routes", () => {
  beforeEach(() => {
    read.mockReset();
    command.mockReset();
    vi.useFakeTimers({ now: NOW });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("lists_a_numbered_page_of_runs_by_the_filter_the_api_offers_stamped_with_when_it_arrived", async () => {
    read.mockResolvedValue({ items: [], total: 120, exact: true });

    const page = await instances({
      phases: ["faulted", "cancelled"],
      from: "2026-11-02T12:00:00Z",
      to: "2026-11-03T12:00:00Z",
      sort: "duration",
      page: 3,
      limit: 25,
    });

    expect(read).toHaveBeenCalledWith("/instances", {
      query: {
        namespace: undefined,
        name: undefined,
        version: undefined,
        phase: ["faulted", "cancelled"],
        from: "2026-11-02T12:00:00Z",
        to: "2026-11-03T12:00:00Z",
        sort: "duration",
        page: 3,
        limit: 25,
      },
    });
    expect(page).toEqual({ items: [], total: 120, exact: true, readAt: NOW });
  });

  it("no_runs_is_an_empty_exact_page", async () => {
    read.mockResolvedValue(null);

    const page = await instances({});

    expect(page).toEqual({ items: [], total: 0, exact: true, readAt: NOW });
  });

  it("counts_runs_by_the_bucket_starts_given_with_the_previous_period", async () => {
    const counted = { to: "2026-11-03T12:00:00Z", buckets: [] };
    read.mockResolvedValue(counted);

    const counts = await instanceCounts({
      buckets: ["2026-11-03T10:00:00Z", "2026-11-03T11:00:00Z"],
      to: "2026-11-03T12:00:00Z",
      previousFrom: "2026-11-03T08:00:00Z",
      namespace: "sales",
      name: "route-lead",
    });

    expect(read).toHaveBeenCalledWith("/instance-counts", {
      query: {
        bucket: ["2026-11-03T10:00:00Z", "2026-11-03T11:00:00Z"],
        to: "2026-11-03T12:00:00Z",
        previousFrom: "2026-11-03T08:00:00Z",
        namespace: "sales",
        name: "route-lead",
      },
    });
    expect(counts).toEqual({ ...counted, readAt: NOW });
  });

  it("counts_the_platform_does_not_give_are_an_error", async () => {
    read.mockResolvedValue(null);

    const counting = instanceCounts({
      buckets: [],
      to: "2026-11-03T12:00:00Z",
    });

    await expect(counting).rejects.toThrow("did not count the runs");
  });

  it("reads_the_failing_workflows_of_a_window_and_the_expected_starts_since_a_moment", async () => {
    read
      .mockResolvedValueOnce({ items: [], workflows: 0, failed: 0 })
      .mockResolvedValueOnce(null);

    const failing = await failingWorkflows({
      from: "2026-11-02T12:00:00Z",
      to: "2026-11-03T12:00:00Z",
      limit: 5,
    });
    const expected = await expectedStarts("2026-11-02T12:00:00Z");

    expect(read).toHaveBeenNthCalledWith(1, "/failing-workflows", {
      query: {
        from: "2026-11-02T12:00:00Z",
        to: "2026-11-03T12:00:00Z",
        limit: 5,
      },
    });
    expect(read).toHaveBeenNthCalledWith(2, "/expected-starts", {
      query: { from: "2026-11-02T12:00:00Z" },
    });
    expect(failing).toEqual({ items: [], workflows: 0, failed: 0 });
    expect(expected).toEqual([]);
  });

  it("lists_workflows_by_status_fifty_at_a_time", async () => {
    read.mockResolvedValue(null);

    const page = await workflows("archived", "c1");

    expect(read).toHaveBeenCalledWith("/workflows", {
      query: { status: "archived", cursor: "c1", limit: 50 },
    });
    expect(page).toEqual({ items: [], next: null });
  });

  it("a_workflow_address_escapes_its_namespace_and_name", async () => {
    read.mockResolvedValue(null);

    await workflow("sales team", "route/lead");

    expect(read).toHaveBeenCalledWith("/workflows/sales%20team/route%2Flead");
  });

  it("a_published_document_is_read_once_and_kept", async () => {
    read.mockResolvedValue({});

    await versionDocument("sales", "route-lead", "1.0.0");

    expect(read).toHaveBeenCalledWith(
      "/workflows/sales/route-lead/versions/1.0.0",
      { immutable: true },
    );
  });

  it("a_start_carries_its_idempotency_key", async () => {
    command.mockResolvedValue({ ok: true, value: { id: "run-1" } });

    await startInstance("sales", "route-lead", "latest", { a: 1 }, "key-1");

    expect(command).toHaveBeenCalledWith(
      "/workflows/sales/route-lead/instances",
      {
        method: "POST",
        json: { version: "latest", input: { a: 1 } },
        headers: { "idempotency-key": "key-1" },
      },
    );
  });

  it.each([
    [true, "/workflows/sales/route-lead/turn-on"],
    [false, "/workflows/sales/route-lead/turn-off"],
  ])("turning_%s_posts_to_%s", async (on, path) => {
    command.mockResolvedValue({ ok: true, value: undefined });

    await turnWorkflow("sales", "route-lead", on);

    expect(command).toHaveBeenCalledWith(path, { method: "POST" });
  });

  it("an_event_is_sent_as_a_structured_cloudevent", async () => {
    command.mockResolvedValue({ ok: true, value: undefined });
    const event = {
      specversion: "1.0",
      id: "e-1",
      source: "/shop",
      type: "com.example.order.paid",
    };

    await publishEvent(event);

    expect(command).toHaveBeenCalledWith("/events", {
      method: "POST",
      text: JSON.stringify(event),
      contentType: "application/cloudevents+json",
    });
  });

  it("a_subscription_is_stamped_and_a_missing_one_is_null", async () => {
    read.mockResolvedValueOnce({ id: "s-1" }).mockResolvedValueOnce(null);

    const found = await subscription("s-1");
    const missing = await subscription("s-2");

    expect(found).toEqual({ id: "s-1", readAt: NOW });
    expect(missing).toBeNull();
  });
});
