import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Workflow, WorkflowStatus } from "@/libs/data-access/types";
import { workflowSearch } from "./workflow-search";

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  cookies: () => Promise.resolve({ get: () => undefined }),
  headers: () => Promise.resolve(new Headers()),
}));

function workflowOf(status: WorkflowStatus, name: string): Workflow {
  const on = status === "active";
  return {
    namespace: "sales",
    name,
    status,
    on,
    currentVersion: "1.2.0",
    schedule: null,
    starts: 0,
    lastRun: null,
  };
}

function apiAnswer(url: URL): Response {
  const status =
    url.searchParams.get("status") === "archived" ? "archived" : "active";
  const name = status === "archived" ? "old-lead" : "route-lead";
  const workflow = workflowOf(status, name);
  return Response.json({ items: [workflow], next: null });
}

describe("the workflows the search finds", () => {
  beforeEach(() => {
    vi.stubEnv("API_URL", "http://api.test");
  });

  it("are_the_active_and_the_archived_ones_with_what_the_search_shows_of_each", async () => {
    vi.stubGlobal("fetch", (url: URL) => Promise.resolve(apiAnswer(url)));

    const response = await workflowSearch();
    const found: unknown = await response.json();

    expect(found).toEqual([
      { namespace: "sales", name: "route-lead", on: true, archived: false },
      { namespace: "sales", name: "old-lead", on: false, archived: true },
    ]);
  });

  it("a_platform_that_does_not_answer_finds_nothing_and_says_so", async () => {
    vi.stubGlobal("fetch", () => Promise.reject(new TypeError("refused")));

    const response = await workflowSearch();
    const found: unknown = await response.json();

    expect(response.status).toBe(503);
    expect(found).toEqual([]);
  });
});
