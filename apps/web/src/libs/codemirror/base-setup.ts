import { closeBrackets, closeBracketsKeymap } from "@codemirror/autocomplete";
import {
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab,
} from "@codemirror/commands";
import {
  bracketMatching,
  foldGutter,
  foldKeymap,
  indentOnInput,
} from "@codemirror/language";
import {
  highlightSelectionMatches,
  search,
  searchKeymap,
} from "@codemirror/search";
import {
  Compartment,
  EditorState,
  type Extension,
  Prec,
} from "@codemirror/state";
import {
  crosshairCursor,
  type EditorView,
  drawSelection,
  dropCursor,
  highlightActiveLineGutter,
  highlightSpecialChars,
  keymap,
  lineNumbers,
  rectangularSelection,
} from "@codemirror/view";

const remembered = new Compartment();

export function forgetHistory(view: EditorView): void {
  view.dispatch({ effects: remembered.reconfigure([]) });
  view.dispatch({ effects: remembered.reconfigure(history()) });
}

export function baseSetup(): Extension {
  const numbers = lineNumbers();
  const folds = foldGutter();
  const afterProblems = Prec.low([numbers, folds]);
  return [
    afterProblems,
    highlightActiveLineGutter(),
    highlightSpecialChars(),
    remembered.of(history()),
    drawSelection(),
    dropCursor(),
    EditorState.allowMultipleSelections.of(true),
    indentOnInput(),
    bracketMatching(),
    closeBrackets(),
    rectangularSelection(),
    crosshairCursor(),
    highlightSelectionMatches(),
    search(),
    keymap.of([
      ...closeBracketsKeymap,
      ...defaultKeymap,
      ...searchKeymap,
      ...historyKeymap,
      ...foldKeymap,
      indentWithTab,
    ]),
  ];
}
