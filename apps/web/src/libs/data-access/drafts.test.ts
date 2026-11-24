import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  checkDraft,
  discardDraft,
  publishDraft,
  testDraft,
  writeDraft,
} from "./drafts";

const fetchApi = vi.fn();

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  cookies: () => Promise.resolve({ get: () => ({ value: "sid=abc" }) }),
  headers: () => Promise.resolve(new Headers()),
}));

const SAVED = {
  source: "do: []\n",
  layout: {},
  savedBy: { id: "u2", name: "Grace Hopper" },
  savedAt: "2026-11-22T10:00:00Z",
};
const CONTENT = { source: "do: []\n", layout: {} };

function answer(status: number, body?: unknown, etag?: string) {
  const text = body === undefined ? null : JSON.stringify(body);
  const headers = etag === undefined ? undefined : { etag };
  return new Response(text, { status, headers });
}

function lastHeaders(): Headers {
  const [, init] = fetchApi.mock.lastCall as [URL, RequestInit];
  return new Headers(init.headers);
}

describe("a workflow's draft at the API", () => {
  beforeEach(() => {
    vi.stubEnv("API_URL", "http://api.test");
    vi.stubGlobal("fetch", fetchApi);
    fetchApi.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("is_created_only_where_none_exists", async () => {
    fetchApi.mockResolvedValue(answer(201, SAVED, '"1"'));

    const written = await writeDraft("sales", "leads", CONTENT, null);

    expect(lastHeaders().get("if-none-match")).toBe("*");
    expect(written).toEqual({
      kind: "saved",
      revision: { draft: SAVED, etag: '"1"' },
    });
  });

  it("is_saved_over_the_revision_it_was_read_at", async () => {
    fetchApi.mockResolvedValue(answer(200, SAVED, '"2"'));

    await writeDraft("sales", "leads", CONTENT, '"1"');

    expect(lastHeaders().get("if-match")).toBe('"1"');
  });

  it("a_newer_revision_comes_back_with_its_own_etag", async () => {
    const stale = { type: "urn:problem:draft.stale", current: SAVED };
    fetchApi.mockResolvedValue(answer(412, stale, '"7"'));

    const written = await writeDraft("sales", "leads", CONTENT, '"1"');

    expect(written).toEqual({
      kind: "conflict",
      current: { draft: SAVED, etag: '"7"' },
    });
  });

  it("a_lost_draft_is_a_conflict_without_a_current_one", async () => {
    const stale = { type: "urn:problem:draft.stale" };
    fetchApi.mockResolvedValue(answer(412, stale));

    const published = await publishDraft("sales", "leads", '"1"');
    const [, init] = fetchApi.mock.lastCall as [URL, RequestInit];

    expect(published).toEqual({ kind: "conflict", current: null });
    expect(init.body).toBeUndefined();
    expect(lastHeaders().get("if-match")).toBe('"1"');
  });

  it("an_unchanged_draft_answers_304_and_a_gone_one_404", async () => {
    fetchApi.mockResolvedValueOnce(answer(304, undefined, '"1"'));
    fetchApi.mockResolvedValueOnce(
      answer(404, { type: "urn:problem:draft.not-found" }),
    );

    const unchanged = await checkDraft("sales", "leads", '"1"');
    const asked = lastHeaders().get("if-none-match");
    const missing = await checkDraft("sales", "leads", '"1"');

    expect(unchanged).toEqual({ kind: "unchanged" });
    expect(asked).toBe('"1"');
    expect(missing).toEqual({ kind: "missing" });
  });

  it("a_test_run_starts_the_draft_at_its_revision_with_the_input_given", async () => {
    const started = { id: "run-1", test: true, phase: "pending" };
    fetchApi.mockResolvedValue(answer(201, started));

    const tested = await testDraft("sales", "leads", '"3"', { a: 1 }, "key-1");

    const [url, init] = fetchApi.mock.lastCall as [URL, RequestInit];
    expect(url.href).toBe(
      "http://api.test/api/v1/workflows/sales/leads/draft/test-runs",
    );
    expect(init.method).toBe("POST");
    expect(init.body).toBe('{"input":{"a":1}}');
    expect(lastHeaders().get("if-match")).toBe('"3"');
    expect(lastHeaders().get("idempotency-key")).toBe("key-1");
    expect(tested).toEqual({ kind: "started", run: started });
  });

  it("a_test_run_of_an_input_the_draft_refuses_answers_its_problems", async () => {
    const problem = {
      type: "urn:problem:instance.input-invalid",
      title: "Input refused",
      status: 422,
      detail: "The input does not match the workflow's input schema",
      errors: [{ pointer: "/input/customer", detail: "Customer is required." }],
    };
    fetchApi.mockResolvedValue(answer(422, problem));

    const tested = await testDraft("sales", "leads", '"3"', {}, "key-2");

    expect(tested).toMatchObject({
      kind: "refused",
      problem: { status: 422, detail: problem.detail },
    });
  });

  it("is_discarded_at_the_revision_it_was_read_at_and_a_newer_one_conflicts", async () => {
    const stale = { type: "urn:problem:draft.stale", current: SAVED };
    fetchApi.mockResolvedValueOnce(answer(204));
    fetchApi.mockResolvedValueOnce(answer(412, stale, '"7"'));

    const discarded = await discardDraft("sales", "leads", '"1"');
    const sent = lastHeaders().get("if-match");
    const [, init] = fetchApi.mock.lastCall as [URL, RequestInit];
    const conflicted = await discardDraft("sales", "leads", '"1"');

    expect(discarded).toEqual({ kind: "discarded" });
    expect(sent).toBe('"1"');
    expect(init.method).toBe("DELETE");
    expect(conflicted).toEqual({
      kind: "conflict",
      current: { draft: SAVED, etag: '"7"' },
    });
  });
});
