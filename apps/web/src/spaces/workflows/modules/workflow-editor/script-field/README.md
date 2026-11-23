# script-field

The code of a "Run JavaScript" or "Run Python" step in the workflow editor: a CodeMirror editor with line numbers, highlighting on the `--code-*` tokens and completion, a bar that names the language and holds Format and Expand, and the code status line that names the first syntax problem and says what Format did. Formatting and checking run off the page's thread through `libs/code-formatting` (Prettier for JavaScript, Ruff for Python). It lives in the editor module because only the workflow editor uses it (the owner's RFC: a feature repeats across domains; one page's logic stays in its module).

Owner: web — editor. Decisions: research D3 (scripts in a real code editor, formatted by ready formatters) and D14 (a script's result is the JSON it prints) of the console redesign (005); the tech lead's rulings TL-31 (a script's syntax problems come from its formatter) and TL-32 (who holds the typed code); design system §6 "Code editor" and "Script field" and §7 "Code editor, JSON viewer"; the approved mockup's `formScript` and its screens `editor-js` and `editor-py`.

## API

`ScriptField` with:

- `language`: the step's `run.script.language`, `"js"` or `"python"`; the field reads `js` as `javascript` for the libs.
- `label`: the name of the field and of its code, the visible label of the form's field ("Code"); the field is a group of that name holding the code, Format, Expand and the status line.
- `value` and `onChange(code)`: the field is controlled. Typing and Format report every change at once through `onChange`. The owner holds the typed code synchronously and commits it to the workflow's document at its own pace; the field replaces its text only when `value` changes to a text it does not show, so a `value` that has not changed never overwrites newer typing, and a new `value` replaces the text without being reported back.
- `expanded` and `onExpandedChange(expanded)`: Expand is the owner's, as it also widens the editor's panel; an expanded field gives the code 420 px instead of 140 px.

## Behaviour

- The field checks its code with `checkScript` after CodeMirror's linting pause: each syntax problem marks its line (a dot in the first gutter and a wavy underline), and the status line names the first ("Line 3: unexpected EOF while parsing"), or says "No problems". The language server's problems about the field itself (an empty script) are the step form's, beside the field.
- Format (the button, or ⇧⌥F anywhere in the field) sends the code and its cursor to the formatter shows the outcome in the status line and says it through libs/ui's `useAnnounce` (an `Announcer` must be above the field): "Formatted with Prettier"; a refusal with the formatter's words and line ("Fix line 3 first: unexpected EOF while parsing. Ruff formats only code that parses."), the code kept; "Ruff could not run: …" when the formatter fails; and, when the person typed meanwhile, the typed code is kept and the person is asked to press Format again. The formatted code keeps the cursor where the formatter puts it and is undone as one step. The button is busy while the formatter works and shows a spinner only after a second.
- Expand is a toggle button (`aria-pressed`) whose name stays "Expand" (APG Button pattern).
- A line longer than the field scrolls inside the code; the bar and the status line stay in the field.
- Built from the libs: `libs/codemirror`'s `CodeMirrorView`, `scriptEditing`, `lineProblemLinter`, `CodeStatusLine`, `takeOwnersText` and `replaceTextAsOneStep`; `libs/code-formatting`'s `formatScript`, `checkScript` and `FORMATTER_NAMES`. The field holds the JavaScript and Python table (title and libs' language) and the wiring of Format, Expand and the owner's text.

## Playground

`script-field.stories.tsx`: JavaScript formatted by Prettier, Python with a problem at line 3 that Ruff finds and refuses to format, and an expanded field.

## Tests

`script-field.test.tsx` runs the field in jsdom with the formatting worker scripted at its port. `e2e/script-field.spec.ts` formats and checks both languages through the real worker on the built Playground and keeps a long line inside the field, and `e2e/accessibility.spec.ts` checks every story with axe in both themes. Formatting on the production build under the page's real policy is proven on the editor's page (M5). Coverage floor: 85 %.
