import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DraftStore } from "./draft-store";
import { useTestRun } from "./use-test-run";

const WORKFLOW = { namespace: "sales", name: "digest" };
const RUN = "9b2f6a4e-7c1d-4f3a-9e8b-2d5c6a7b8c9d";
const PROGRESS = `/workflows/sales/digest/edit/test-runs/${RUN}`;
const POLL_MS = 1000;

function storeTesting(answer: unknown) {
  const test = vi.fn().mockResolvedValue(answer);
  const store = { test } as unknown as DraftStore;
  return { store, test };
}

async function waitPolls(count: number) {
  for (let poll = 0; poll < count; poll += 1)
    await act(() => vi.advanceTimersByTimeAsync(POLL_MS));
}

function answered(body: unknown): Response {
  return Response.json(body);
}

describe("a test run of the draft", () => {
  const fetching = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", fetching);
    fetching.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("each_attempt_sends_its_own_idempotency_key", async () => {
    const run = { id: RUN, phase: "completed" };
    const { store, test } = storeTesting({ kind: "started", run });
    const { result } = renderHook(() => useTestRun(WORKFLOW, store));

    await act(() => result.current.run({}));
    await act(() => result.current.run({}));

    const [first, second] = test.mock.calls.map((call) => call[1]);
    expect(first).toMatch(/^[0-9a-f-]{36}$/);
    expect(second).not.toBe(first);
  });

  it("a_running_test_is_read_from_its_route_until_it_ends", async () => {
    const run = { id: RUN, phase: "running" };
    const ended = { run: { id: RUN, phase: "completed" }, records: [] };
    const { store } = storeTesting({ kind: "started", run });
    fetching.mockResolvedValue(answered(ended));
    const { result } = renderHook(() => useTestRun(WORKFLOW, store));

    await act(() => result.current.run({}));
    await waitPolls(4);

    expect(fetching).toHaveBeenCalledTimes(1);
    expect(fetching.mock.calls[0]?.[0]).toBe(PROGRESS);
    expect(result.current.state).toEqual({ kind: "ran", test: ended });
  });

  it("a_progress_that_cannot_be_read_is_tried_again_then_shown_as_lost", async () => {
    const run = { id: RUN, phase: "running" };
    const { store } = storeTesting({ kind: "started", run });
    fetching.mockResolvedValue(new Response(null, { status: 503 }));
    const { result } = renderHook(() => useTestRun(WORKFLOW, store));

    await act(() => result.current.run({}));
    await waitPolls(6);

    expect(fetching).toHaveBeenCalledTimes(3);
    expect(result.current.lost).toBe(true);
  });

  it("reading_again_after_a_loss_asks_the_route_once_more", async () => {
    const run = { id: RUN, phase: "running" };
    const ended = { run: { id: RUN, phase: "completed" }, records: [] };
    const { store } = storeTesting({ kind: "started", run });
    fetching.mockResolvedValue(new Response(null, { status: 503 }));
    const { result } = renderHook(() => useTestRun(WORKFLOW, store));
    await act(() => result.current.run({}));
    await waitPolls(6);

    fetching.mockResolvedValue(answered(ended));
    act(() => {
      result.current.readAgain();
    });
    await waitPolls(1);

    expect(result.current.lost).toBe(false);
    expect(result.current.state).toEqual({ kind: "ran", test: ended });
  });

  it("a_held_draft_is_not_tested", async () => {
    const { store } = storeTesting({ kind: "held" });
    const { result } = renderHook(() => useTestRun(WORKFLOW, store));

    await act(() => result.current.run({}));

    expect(result.current.state).toMatchObject({ kind: "refused" });
    expect(fetching).not.toHaveBeenCalled();
  });
});
