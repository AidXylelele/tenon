import { currentCompletions, startCompletion } from "@codemirror/autocomplete";
import { language, syntaxTree } from "@codemirror/language";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { classHighlighter, highlightTree } from "@lezer/highlight";
import { describe, expect, it, vi } from "vitest";
import type { ScriptLanguage } from "./interfaces";
import { scriptLanguage } from "./script-language";

type Highlight = readonly [text: string, classes: string];

function highlightsOf(name: ScriptLanguage, doc: string): Highlight[] {
  const extensions = scriptLanguage(name);
  const state = EditorState.create({ doc, extensions });
  const tree = syntaxTree(state);
  const highlights: Highlight[] = [];

  highlightTree(tree, classHighlighter, (from, to, classes) => {
    const text = doc.slice(from, to);
    highlights.push([text, classes]);
  });

  return highlights;
}

describe("the languages of scripts", () => {
  it.each<[ScriptLanguage, string]>([
    ["js", "javascript"],
    ["python", "python"],
  ])("a_%s_script_is_read_as_%s", (name, expected) => {
    const extensions = scriptLanguage(name);
    const state = EditorState.create({ extensions });

    const read = state.facet(language)?.name;

    expect(read).toBe(expected);
  });

  it("javascript_is_highlighted_by_its_grammar", () => {
    const highlights = highlightsOf("js", 'const greeting = "hi"; // hello');

    expect(highlights).toEqual([
      ["const", "tok-keyword"],
      ["greeting", "tok-variableName tok-definition"],
      ["=", "tok-operator"],
      ['"hi"', "tok-string"],
      [";", "tok-punctuation"],
      ["// hello", "tok-comment"],
    ]);
  });

  it("python_is_highlighted_by_its_grammar", () => {
    const highlights = highlightsOf("python", 'def greet():\n    return "hi"');

    expect(highlights).toEqual([
      ["def", "tok-keyword"],
      ["greet", "tok-variableName tok-definition"],
      ["(", "tok-punctuation"],
      [")", "tok-punctuation"],
      ["return", "tok-keyword"],
      ['"hi"', "tok-string"],
    ]);
  });

  it.each<[ScriptLanguage, string]>([
    ["js", "const total = 1;\nto"],
    ["python", "total = 1\nto"],
  ])(
    "completion_in_%s_offers_the_names_the_script_declares",
    async (name, doc) => {
      const extensions = scriptLanguage(name);
      const selection = { anchor: doc.length };
      const view = new EditorView({ doc, selection, extensions });

      startCompletion(view);

      await vi.waitFor(() => {
        const labels = currentCompletions(view.state).map(({ label }) => label);
        expect(labels).toContain("total");
      });
      view.destroy();
    },
  );
});
