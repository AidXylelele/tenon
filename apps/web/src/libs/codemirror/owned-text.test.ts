import { history, undo } from "@codemirror/commands";
import { EditorView, type ViewUpdate } from "@codemirror/view";
import { afterEach, describe, expect, it } from "vitest";
import { isChangedHere, takeOwnersText } from "./owned-text";

const views: EditorView[] = [];

function editorWith(doc: string, seen: ViewUpdate[]): EditorView {
  const listener = EditorView.updateListener.of((update) => {
    seen.push(update);
  });
  const view = new EditorView({ doc, extensions: [history(), listener] });
  views.push(view);
  return view;
}

describe("text an owner holds while the person edits it", () => {
  afterEach(() => {
    for (const view of views) view.destroy();
    views.length = 0;
  });

  it("the_owners_new_text_replaces_the_text", () => {
    const view = editorWith("a = 1", []);

    takeOwnersText(view, "b = 2");

    const text = view.state.doc.toString();
    expect(text).toBe("b = 2");
  });

  it("the_owners_new_text_is_not_a_change_made_here", () => {
    const seen: ViewUpdate[] = [];
    const view = editorWith("a = 1", seen);

    takeOwnersText(view, "b = 2");

    const changedHere = seen.some(isChangedHere);
    expect(changedHere).toBe(false);
  });

  it("the_text_the_editor_already_shows_dispatches_nothing", () => {
    const seen: ViewUpdate[] = [];
    const view = editorWith("a = 1", seen);

    takeOwnersText(view, "a = 1");

    expect(seen).toEqual([]);
  });

  it("typing_is_a_change_made_here", () => {
    const seen: ViewUpdate[] = [];
    const view = editorWith("a = 1", seen);

    view.dispatch({ changes: { from: 0, insert: "# x\n" } });

    const changedHere = seen.some(isChangedHere);
    expect(changedHere).toBe(true);
  });

  it("a_selection_alone_is_no_change", () => {
    const seen: ViewUpdate[] = [];
    const view = editorWith("a = 1", seen);

    view.dispatch({ selection: { anchor: 2 } });

    const changedHere = seen.some(isChangedHere);
    expect(changedHere).toBe(false);
  });

  it("undo_does_not_take_back_the_owners_text", () => {
    const view = editorWith("a = 1", []);
    takeOwnersText(view, "b = 2");

    undo(view);

    const text = view.state.doc.toString();
    expect(text).toBe("b = 2");
  });
});
