import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import type { Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { tags } from "@lezer/highlight";

const surface = EditorView.theme({
  "&": {
    color: "var(--foreground)",
    backgroundColor: "var(--card)",
    fontSize: "13px",
    height: "100%",
  },
  ".cm-scroller": {
    fontFamily: "var(--font-mono)",
    lineHeight: "20px",
  },
  ".cm-content": { caretColor: "var(--foreground)" },
  ".cm-cursor, .cm-dropCursor": { borderLeftColor: "var(--foreground)" },
  "&.cm-focused": { outline: "none" },
  "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection":
    { backgroundColor: "var(--accent)" },
  ".cm-gutters": {
    backgroundColor: "var(--card)",
    color: "var(--muted-foreground)",
    borderRight: "1px solid var(--border)",
  },
  ".cm-activeLineGutter": {
    backgroundColor: "var(--muted)",
    color: "var(--foreground)",
  },
  ".cm-tooltip": {
    backgroundColor: "var(--popover)",
    color: "var(--popover-foreground)",
    border: "1px solid var(--border)",
    borderRadius: "8px",
  },
  ".cm-tooltip-autocomplete > ul > li[aria-selected]": {
    backgroundColor: "var(--accent)",
    color: "var(--accent-foreground)",
  },
  ".cm-lintRange-error, .cm-lintRange-warning, .cm-lintRange-info, .cm-lintRange-hint":
    {
      backgroundImage: "none",
      textDecorationLine: "underline",
      textDecorationStyle: "wavy",
      textUnderlineOffset: "4px",
    },
  ".cm-lintRange-error": { textDecorationColor: "var(--danger-text)" },
  ".cm-lintRange-warning": { textDecorationColor: "var(--warning-text)" },
  ".cm-lintRange-info, .cm-lintRange-hint": {
    textDecorationColor: "var(--info-text)",
  },
  ".cm-lint-marker": {
    content: "normal",
    width: "8px",
    height: "8px",
    borderRadius: "9999px",
    margin: "6px 4px",
  },
  ".cm-lint-marker-error": { backgroundColor: "var(--danger-text)" },
  ".cm-lint-marker-warning": { backgroundColor: "var(--warning-text)" },
  ".cm-lint-marker-info": { backgroundColor: "var(--info-text)" },
  ".cm-diagnostic-error": { borderLeftColor: "var(--destructive)" },
  ".cm-diagnostic-warning": { borderLeftColor: "var(--warning)" },
  ".cm-diagnostic-info": { borderLeftColor: "var(--info)" },
  ".cm-panels": {
    backgroundColor: "var(--popover)",
    color: "var(--popover-foreground)",
  },
  ".cm-textfield": {
    backgroundColor: "var(--background)",
    color: "var(--foreground)",
    border: "1px solid var(--input)",
    borderRadius: "6px",
    padding: "2px 6px",
  },
  ".cm-button": {
    backgroundImage: "none",
    backgroundColor: "var(--secondary)",
    color: "var(--secondary-foreground)",
    border: "1px solid var(--border)",
    borderRadius: "6px",
    padding: "2px 8px",
  },
});

const highlights = HighlightStyle.define([
  {
    tag: [tags.keyword, tags.operator, tags.definition(tags.propertyName)],
    color: "var(--code-keyword)",
  },
  {
    tag: [
      tags.propertyName,
      tags.function(tags.variableName),
      tags.function(tags.propertyName),
    ],
    color: "var(--code-property)",
  },
  {
    tag: [tags.string, tags.special(tags.string)],
    color: "var(--code-string)",
  },
  {
    tag: [
      tags.number,
      tags.integer,
      tags.float,
      tags.bool,
      tags.null,
      tags.atom,
    ],
    color: "var(--code-number)",
  },
  {
    tag: [tags.comment, tags.lineComment, tags.blockComment],
    color: "var(--code-comment)",
    fontStyle: "italic",
  },
  { tag: tags.invalid, color: "var(--danger-text)" },
]);

export function tokenTheme(): Extension {
  return [surface, syntaxHighlighting(highlights)];
}
