import { undo } from "@codemirror/commands";
import { EditorView } from "@codemirror/view";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { baseSetup } from "@/libs/codemirror/base-setup";
import type { DraftRevision } from "@/libs/data-access/types";
import { DraftStore } from "./draft-store";

const {
  saveDraftAction,
  readDraftAction,
  checkDraftAction,
  publishDraftAction,
  testRunAction,
} = vi.hoisted(() => ({
  saveDraftAction: vi.fn(),
  readDraftAction: vi.fn(),
  checkDraftAction: vi.fn(),
  publishDraftAction: vi.fn(),
  testRunAction: vi.fn(),
}));

vi.mock("./actions", () => ({
  saveDraftAction,
  readDraftAction,
  checkDraftAction,
  publishDraftAction,
  testRunAction,
}));

const WORKFLOW = { namespace: "sales", name: "leads" };
const ADA = { id: "u1", name: "Ada Lovelace" };
const GRACE = { id: "u2", name: "Grace Hopper" };
const BASE = "document:\n  name: leads\ndo:\n  - fetch:\n      call: http\n";

function revisionOf(source: string, etag: string, by = ADA): DraftRevision {
  const savedAt = "2026-11-22T10:00:00Z";
  return { draft: { source, layout: {}, savedBy: by, savedAt }, etag };
}

function keeperOn(text: string, opened: DraftRevision | null) {
  const view = new EditorView({ doc: text });
  const keeper = new DraftStore(WORKFLOW, opened, () => view);
  return { view, keeper };
}

function typeInto(view: EditorView, from: string, to: string) {
  const text = view.state.doc.toString();
  const at = text.indexOf(from);
  view.dispatch({ changes: { from: at, to: at + from.length, insert: to } });
}

describe("the draft kept beside the editor", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    saveDraftAction.mockReset();
    readDraftAction.mockReset();
    checkDraftAction.mockReset();
    publishDraftAction.mockReset();
    testRunAction.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("a_change_is_saved_after_a_pause_and_creates_the_draft", async () => {
    const { view, keeper } = keeperOn(BASE, null);
    const saved = revisionOf(BASE.replace("leads", "lead-intake"), '"1"');
    saveDraftAction.mockResolvedValue({ kind: "saved", revision: saved });

    typeInto(view, "leads", "lead-intake");
    keeper.changed();
    const waiting = keeper.read().status;
    await vi.runAllTimersAsync();

    expect(waiting).toBe("unsaved");
    expect(saveDraftAction).toHaveBeenCalledWith({
      ...WORKFLOW,
      source: saved.draft.source,
      layout: {},
      etag: null,
    });
    expect(keeper.read()).toMatchObject({
      status: "clean",
      saved: { by: ADA },
    });
  });

  it("a_newer_draft_holds_the_save_with_theirs_and_the_shared_base", async () => {
    const { view, keeper } = keeperOn(BASE, revisionOf(BASE, '"1"'));
    const theirs = revisionOf(
      BASE.replace("call: http", "call: grpc"),
      '"2"',
      GRACE,
    );
    saveDraftAction.mockResolvedValue({ kind: "conflict", current: theirs });

    typeInto(view, "leads", "lead-intake");
    await keeper.flush();
    const conflict = keeper.read().conflict;

    expect(conflict).toEqual({ theirs, base: BASE });
    expect(keeper.read().status).toBe("unsaved");
  });

  it("a_resolution_writes_its_text_over_their_revision", async () => {
    const { view, keeper } = keeperOn(BASE, revisionOf(BASE, '"1"'));
    const theirs = revisionOf(
      BASE.replace("call: http", "call: grpc"),
      '"2"',
      GRACE,
    );
    const merged =
      "document:\n  name: lead-intake\ndo:\n  - fetch:\n      call: grpc\n";
    saveDraftAction
      .mockResolvedValueOnce({ kind: "conflict", current: theirs })
      .mockResolvedValueOnce({
        kind: "saved",
        revision: revisionOf(merged, '"3"'),
      });

    typeInto(view, "leads", "lead-intake");
    await keeper.flush();
    keeper.resolve(merged);
    await keeper.flush();

    expect(view.state.doc.toString()).toBe(merged);
    expect(saveDraftAction).toHaveBeenLastCalledWith({
      ...WORKFLOW,
      source: merged,
      layout: {},
      etag: '"2"',
    });
    expect(keeper.read().conflict).toBeNull();
  });

  it("publishing_saves_first_and_publishes_that_revision", async () => {
    const { view, keeper } = keeperOn(BASE, revisionOf(BASE, '"1"'));
    const saved = revisionOf(BASE.replace("leads", "lead-intake"), '"2"');
    const version = { version: "1.0.1" };
    saveDraftAction.mockResolvedValue({ kind: "saved", revision: saved });
    publishDraftAction.mockResolvedValue({ kind: "published", version });

    typeInto(view, "leads", "lead-intake");
    const publication = await keeper.publish();

    expect(publishDraftAction).toHaveBeenCalledWith({
      ...WORKFLOW,
      etag: '"2"',
    });
    expect(publication).toEqual({ kind: "published", version });
  });

  it("a_test_run_tests_the_saved_revision_with_the_key_of_its_attempt", async () => {
    const opened = revisionOf(BASE, '"1"');
    const { keeper } = keeperOn(BASE, opened);
    const run = { id: "run-1", phase: "pending" };
    testRunAction.mockResolvedValue({ kind: "started", run });

    const started = await keeper.test({ id: 7 }, "key-1");

    expect(testRunAction).toHaveBeenCalledWith({
      ...WORKFLOW,
      etag: '"1"',
      input: { id: 7 },
      key: "key-1",
    });
    expect(started).toEqual({ kind: "started", run });
  });

  it("a_test_run_refused_by_a_newer_draft_holds_with_that_revision", async () => {
    const opened = revisionOf(BASE, '"1"');
    const { keeper } = keeperOn(BASE, opened);
    const theirs = revisionOf(BASE.replace("leads", "theirs"), '"2"', GRACE);
    testRunAction.mockResolvedValue({ kind: "conflict", current: theirs });

    const started = await keeper.test({}, "key-2");

    expect(started).toEqual({ kind: "held" });
    expect(readDraftAction).not.toHaveBeenCalled();
    expect(keeper.read().conflict).toEqual({ theirs, base: BASE });
  });

  it("an_untouched_editor_takes_a_newer_draft_saved_elsewhere", async () => {
    const { view, keeper } = keeperOn(BASE, revisionOf(BASE, '"1"'));
    const theirs = revisionOf(
      BASE.replace("call: http", "call: grpc"),
      '"2"',
      GRACE,
    );
    checkDraftAction.mockResolvedValue({ kind: "changed", revision: theirs });

    await keeper.recheck();
    keeper.changed();
    await keeper.flush();

    expect(checkDraftAction).toHaveBeenCalledWith({ ...WORKFLOW, etag: '"1"' });
    expect(view.state.doc.toString()).toBe(theirs.draft.source);
    expect(keeper.read()).toMatchObject({
      status: "clean",
      saved: { by: GRACE },
    });
    expect(saveDraftAction).not.toHaveBeenCalled();
  });

  it("undo_never_takes_back_a_draft_saved_elsewhere", async () => {
    const view = new EditorView({ doc: BASE, extensions: baseSetup() });
    const keeper = new DraftStore(
      WORKFLOW,
      revisionOf(BASE, '"1"'),
      () => view,
    );
    const theirs = revisionOf(
      BASE.replace("call: http", "call: grpc"),
      '"2"',
      GRACE,
    );
    checkDraftAction.mockResolvedValue({ kind: "changed", revision: theirs });

    await keeper.recheck();
    undo(view);

    expect(view.state.doc.toString()).toBe(theirs.draft.source);
  });

  it("closing_the_editor_sends_the_change_still_waiting", async () => {
    const { view, keeper } = keeperOn(BASE, revisionOf(BASE, '"1"'));
    const saved = revisionOf(BASE.replace("leads", "lead-intake"), '"2"');
    saveDraftAction.mockResolvedValue({ kind: "saved", revision: saved });

    typeInto(view, "leads", "lead-intake");
    keeper.changed();
    keeper.dispose();

    await vi.waitFor(() => {
      expect(saveDraftAction).toHaveBeenCalledWith({
        ...WORKFLOW,
        source: saved.draft.source,
        layout: {},
        etag: '"1"',
      });
    });
  });

  it("undo_never_takes_back_a_resolution", async () => {
    const view = new EditorView({ doc: BASE, extensions: baseSetup() });
    const keeper = new DraftStore(
      WORKFLOW,
      revisionOf(BASE, '"1"'),
      () => view,
    );
    const theirs = revisionOf(
      BASE.replace("call: http", "call: grpc"),
      '"2"',
      GRACE,
    );
    saveDraftAction.mockResolvedValueOnce({
      kind: "conflict",
      current: theirs,
    });

    typeInto(view, "leads", "lead-intake");
    await keeper.flush();
    keeper.resolve(theirs.draft.source);
    undo(view);

    expect(view.state.doc.toString()).toBe(theirs.draft.source);
  });

  it("a_refusal_that_will_not_change_is_not_tried_again", async () => {
    const { view, keeper } = keeperOn(BASE, revisionOf(BASE, '"1"'));
    const problem = {
      type: "about:blank",
      title: "Too large",
      status: 413,
      detail: "The draft is too large.",
      errors: [],
    };
    saveDraftAction.mockResolvedValue({ kind: "refused", problem });

    typeInto(view, "leads", "lead-intake");
    await keeper.flush();
    await vi.runAllTimersAsync();

    expect(keeper.read()).toMatchObject({ status: "failed", retrying: false });
    expect(saveDraftAction).toHaveBeenCalledOnce();
  });

  it("too_many_requests_is_tried_again_when_retry_after_says", async () => {
    const { view, keeper } = keeperOn(BASE, revisionOf(BASE, '"1"'));
    const problem = {
      type: "about:blank",
      title: "Too many requests",
      status: 429,
      detail: "Slow down",
      errors: [],
      retryAfter: 30,
    };
    saveDraftAction.mockResolvedValue({ kind: "refused", problem });

    typeInto(view, "leads", "lead-intake");
    await keeper.flush();
    await vi.advanceTimersByTimeAsync(29_000);
    const early = saveDraftAction.mock.calls.length;
    await vi.advanceTimersByTimeAsync(1000);

    expect(keeper.read()).toMatchObject({ status: "failed", retrying: true });
    expect(early).toBe(1);
    expect(saveDraftAction).toHaveBeenCalledTimes(2);
  });
});
