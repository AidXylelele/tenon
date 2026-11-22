# script-field

The code of a "Run JavaScript" or "Run Python" step: a CodeMirror editor with line numbers, highlighting on the `--code-*` tokens and completion, a bar that names the language and holds Format and Expand, and the code status line that names the first problem and says what Format did. Formatting runs off the page's thread through `libs/code-formatting` (Prettier for JavaScript, Ruff for Python). It lives in the editor module because only the workflow editor uses it (the owner's RFC: a feature repeats across domains; one page's logic stays in its module).

Owner: web — editor. Decisions: research D3 (scripts in a real code editor, formatted by ready formatters) and D14 (a script's result is the JSON it prints) of the console redesign (005); design system §6 "Code editor" and "Script field" and §7 "Code editor, JSON viewer"; the approved mockup's `formScript` and its screens `editor-js` and `editor-py`.

## API

`ScriptField` with:

- `language`: the step's `run.script.language`, `"js"` or `"python"`; the field reads `js` as `libs/codemirror`'s `javascript`.
- `label`: the accessible name of the code, the visible label of the form's field ("Code").
- `value` and `onChange(code)`: the field is controlled. Typing and Format report the new code; a new `value` from the owner replaces the text without being reported back.
- `problems`: the language server's diagnostics for the script, positioned in the script's own text (line 0 is its first line). Each is marked in the gutter and underlined on its range; the status line names the first ("Line 3: “(” was never closed"), or says "No problems".
- `expanded` and `onExpandedChange(expanded)`: Expand is the owner's, as it also widens the editor's panel; an expanded field gives the code 420 px instead of 140 px.

## Behaviour

- Format (the button, or ⇧⌥F anywhere in the field) sends the code to the formatter and says the outcome politely in the status line: "Formatted with Prettier"; a refusal with the formatter's words and line ("Fix line 3 first: unexpected EOF while parsing. Ruff formats only code that parses."), the code kept; "Ruff could not run: …" when the formatter fails; and, when the person typed meanwhile, the typed code is kept and the person is asked to press Format again. Format is undone as one change. The button is busy while the formatter works and shows a spinner only after a second.
- Expand is a toggle button (`aria-pressed`) whose name stays "Expand" (APG Button pattern).
- The code is `libs/codemirror`'s `CodeMirrorView` on its token theme, with completion and the lint gutter first; the status line is `libs/codemirror`'s `CodeStatusLine` with the formatter's name as its note; the language server's diagnostics become marks and line problems through `libs/language-client`'s `lintDiagnosticsOf` and `codeProblemsOf`.

## Playground

`script-field.stories.tsx`: JavaScript formatted by Prettier, Python with a problem at line 3 and Ruff's refusal, and an expanded field.

## Tests

`script-field.test.tsx` runs the field in jsdom with the formatting worker scripted at its port. `e2e/script-field.spec.ts` formats both languages through the real worker on the built Playground, and `e2e/accessibility.spec.ts` checks every story with axe in both themes. Formatting on the production build under the page's real policy is proven on the editor's page (M5).
