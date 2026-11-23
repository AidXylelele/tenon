import { currentCompletions, startCompletion } from "@codemirror/autocomplete";
import { language } from "@codemirror/language";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { describe, expect, it, vi } from "vitest";
import type { ScriptLanguage } from "./interfaces";
import { scriptEditing } from "./script-editing";

describe("the extensions that edit a script", () => {
  it.each<[ScriptLanguage, string]>([
    ["javascript", "javascript"],
    ["python", "python"],
  ])("a_%s_script_is_read_as_%s", (name, expected) => {
    const extensions = scriptEditing(name);
    const state = EditorState.create({ extensions });

    const read = state.facet(language)?.name;

    expect(read).toBe(expected);
  });

  it("the_names_a_script_declares_are_completed", async () => {
    const extensions = scriptEditing("python");
    const doc = "total = 1\nto";
    const selection = { anchor: doc.length };
    const view = new EditorView({ doc, selection, extensions });

    startCompletion(view);

    await vi.waitFor(() => {
      const labels = currentCompletions(view.state).map(({ label }) => label);
      expect(labels).toContain("total");
    });
    view.destroy();
  });

  it("a_script_has_a_gutter_for_its_problems", () => {
    const extensions = scriptEditing("javascript");
    const view = new EditorView({ doc: "let a = 1;", extensions });

    const gutter = view.dom.querySelector(".cm-gutter-lint");

    expect(gutter).not.toBeNull();
    view.destroy();
  });
});
