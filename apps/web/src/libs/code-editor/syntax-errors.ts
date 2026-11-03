import { ensureSyntaxTree, syntaxTree } from '@codemirror/language';
import { type Diagnostic, linter } from '@codemirror/lint';

const PARSE_BUDGET_MS = 200;
const MOST = 20;

// The language's own parse tree marks where the code stops making sense; each mark becomes a
// diagnostic at its line (research R17). No linter runs the code or knows its libraries. An
// empty field is left alone: it is not yet code, and optional fields start empty.
export const syntaxErrors = linter(
  (view) => {
    const state = view.state;
    const length = state.doc.length;
    const text = state.doc.toString();

    if (text.trim() === '') return [];

    const tree =
      ensureSyntaxTree(state, length, PARSE_BUDGET_MS) ?? syntaxTree(state);
    const found: Diagnostic[] = [];

    tree.iterate({
      enter: (node) => {
        if (!node.type.isError || found.length >= MOST) return;

        const from = node.from;
        const to = Math.max(node.to, Math.min(from + 1, length));
        const line = state.doc.lineAt(from).number;
        found.push({
          from,
          to,
          severity: 'error',
          message: `Line ${String(line)} does not read as code here`,
        });
      },
    });

    return found;
  },
  { delay: 400 },
);
