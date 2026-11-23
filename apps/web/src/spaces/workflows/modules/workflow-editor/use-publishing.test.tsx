import type { LSPClient } from "@codemirror/lsp-client";
import { EditorView } from "@codemirror/view";
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DraftStore } from "./draft-store";
import type { DraftState } from "./interfaces";
import { usePublishing } from "./use-publishing";

const { textFromJson } = vi.hoisted(() => ({
  textFromJson: vi.fn(() => Promise.resolve({ text: "from: json\n" })),
}));

vi.mock("@/operations/workflow-language", () => ({ textFromJson }));
vi.mock("./actions", () => ({ turnStartsAction: vi.fn() }));

const WORKFLOW = { namespace: "sales", name: "digest" };
const SAVED = { by: { id: "u1", name: "Ada" }, at: "2026-11-23T08:00:00Z" };
const CLIENT = {} as LSPClient;

function storeWith(saved: DraftState["saved"]): DraftStore {
  const state = {
    status: "clean",
    saved,
    failure: null,
    retrying: false,
    conflict: null,
  };
  const store = {
    subscribe: () => () => undefined,
    read: () => state,
    publish: vi.fn(),
    flush: vi.fn(),
  };
  return store as unknown as DraftStore;
}

function publishingOn(
  view: EditorView,
  saved: DraftState["saved"],
  currentVersion: string | null,
) {
  const edit = vi.fn(() => Promise.resolve(true));
  const props = {
    client: CLIENT,
    name: WORKFLOW,
    currentVersion,
    steps: null,
    store: storeWith(saved),
    edit,
    view: () => view,
  };
  const { result } = renderHook(() => usePublishing(props));
  return { result, edit };
}

describe("publishing and discarding the draft", () => {
  const fetching = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetching);
    fetching.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("there_is_nothing_to_discard_before_a_draft_is_saved", () => {
    const view = new EditorView({ doc: "do: []\n" });

    const { result } = publishingOn(view, null, "1.0.0");

    expect(result.current.discard).toBeNull();
  });

  it("there_is_nothing_to_discard_before_a_version_is_published", () => {
    const view = new EditorView({ doc: "do: []\n" });

    const { result } = publishingOn(view, SAVED, null);

    expect(result.current.discard).toBeNull();
  });

  it("discarding_takes_the_published_text", async () => {
    const view = new EditorView({ doc: "mine: true\n" });
    fetching.mockResolvedValue(new Response("published: true\n"));
    const { result } = publishingOn(view, SAVED, "1.0.0");

    const outcome = await act(() => result.current.discard?.());

    expect(outcome).toEqual({ ok: true, value: undefined });
    expect(view.state.doc.toString()).toBe("published: true\n");
    expect(fetching.mock.calls[0]?.[0]).toBe(
      "/workflows/sales/digest/versions/1.0.0/source",
    );
  });

  it("a_version_kept_only_as_json_is_discarded_to_its_text_as_on_opening", async () => {
    const view = new EditorView({ doc: "mine: true\n" });
    fetching.mockResolvedValue(Response.json({ document: { name: "x" } }));
    const { result } = publishingOn(view, SAVED, "1.0.0");

    await act(() => result.current.discard?.());

    expect(view.state.doc.toString()).toBe("from: json\n");
  });

  it("a_published_version_that_cannot_be_read_keeps_the_draft", async () => {
    const view = new EditorView({ doc: "mine: true\n" });
    fetching.mockResolvedValue(new Response(null, { status: 503 }));
    const { result } = publishingOn(view, SAVED, "1.0.0");

    const outcome = await act(() => result.current.discard?.());

    expect(outcome).toMatchObject({ ok: false });
    expect(view.state.doc.toString()).toBe("mine: true\n");
  });

  it("a_version_is_one_edit_of_the_document_version", async () => {
    const view = new EditorView({ doc: "do: []\n" });
    const { result, edit } = publishingOn(view, SAVED, "1.0.0");

    await act(() => result.current.setVersion("1.1.0"));

    expect(edit).toHaveBeenCalledWith([
      { kind: "setField", pointer: "/document/version", value: "1.1.0" },
    ]);
  });
});
