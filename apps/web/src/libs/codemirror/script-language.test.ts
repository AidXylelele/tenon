import {
  autocompletion,
  currentCompletions,
  startCompletion,
} from "@codemirror/autocomplete";
import { ensureSyntaxTree, language } from "@codemirror/language";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { classHighlighter, highlightTree } from "@lezer/highlight";
import { describe, expect, it, vi } from "vitest";
import type { ScriptLanguage } from "./interfaces";
import { scriptLanguage } from "./script-language";

type Highlight = readonly [text: string, classes: string];

const PARSE_TIMEOUT_MS = 5_000;

function highlightsOf(name: ScriptLanguage, doc: string): Highlight[] {
  const extensions = scriptLanguage(name);
  const state = EditorState.create({ doc, extensions });
  const tree = ensureSyntaxTree(state, doc.length, PARSE_TIMEOUT_MS);
  const highlights: Highlight[] = [];

  if (tree === null) throw new Error("The script was not parsed in time.");

  highlightTree(tree, classHighlighter, (from, to, classes) => {
    const text = doc.slice(from, to);
    highlights.push([text, classes]);
  });

  return highlights;
}

describe("the languages of scripts", () => {
  it.each<[ScriptLanguage, string]>([
    ["javascript", "javascript"],
    ["python", "python"],
  ])("a_%s_script_is_read_as_%s", (name, expected) => {
    const extensions = scriptLanguage(name);
    const state = EditorState.create({ extensions });

    const read = state.facet(language)?.name;

    expect(read).toBe(expected);
  });

  it("javascript_is_highlighted_by_its_grammar", () => {
    const highlights = highlightsOf(
      "javascript",
      'const greeting = "hi"; // hello',
    );

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
    ["javascript", "const total = 1;\nto"],
    ["python", "total = 1\nto"],
  ])(
    "the_%s_language_completes_the_names_the_script_declares",
    async (name, doc) => {
      const support = scriptLanguage(name);
      const extensions = [support, autocompletion()];
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
