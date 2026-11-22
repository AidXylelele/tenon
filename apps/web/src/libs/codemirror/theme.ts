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
  ".cm-activeLine": { backgroundColor: "var(--muted)" },
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
  { tag: tags.propertyName, color: "var(--accent-foreground)" },
  { tag: [tags.string, tags.special(tags.string)], color: "var(--success)" },
  { tag: [tags.number, tags.integer, tags.float], color: "var(--info)" },
  { tag: [tags.bool, tags.null, tags.atom], color: "var(--warning)" },
  { tag: [tags.comment, tags.lineComment], color: "var(--muted-foreground)" },
  { tag: [tags.keyword, tags.operator], color: "var(--primary)" },
  { tag: tags.invalid, color: "var(--destructive)" },
]);

export function tokenTheme(): Extension {
  return [surface, syntaxHighlighting(highlights)];
}
