# codemirror

CodeMirror 6 hosted in React, on the design's tokens: one editor view per mount whose state holds the text, the base setup every code editor shares, the token theme, the script languages, a status line for problems and messages, and the few steps an owner of the text needs. Infrastructure: it knows nothing of workflows.

Owner: the web foundation. Decisions: research D3 of the console redesign (005); design system §6 "Code editor" and §7 "Code editor, JSON viewer"; the web rubric's editor rows ED-1 (the text lives in the editor's state) and ED-2 (run-time changes by compartments, never by recreating the view).

## API

- `CodeMirrorView` (`doc`, `extensions`, `readOnly`, `label`, `className`, `onView`, `onUpdate`): mounts one `EditorView` with `doc` as its first text and `baseSetup()`; new `extensions` and `readOnly` reconfigure the same view. The text is named by `label` and reached by Tab even when read-only; Esc, then Tab leaves it, as the hint under a focused editor says. The host draws the 2 px inset focus ring above the gutters and lets a long line scroll inside the editor; `className` sizes it (`h-full`, `min-h-35`).
- `baseSetup()`: line numbers and fold markers after any problem gutter (problems, numbers, folds, code), the active line marked in the gutter without a fill, history, bracket matching and closing, search and the default keymaps with Tab indenting. `forgetHistory(view)` empties the undo history.
- `tokenTheme()`: the editor on the `--code-*` tokens, code at `--text-code` (12/20); lint underlines and gutter dots on the danger, warning and info tokens.
- `scriptLanguage(language)`: `@codemirror/lang-javascript` or `@codemirror/lang-python` for a `ScriptLanguage` (`"javascript"` or `"python"`). `scriptEditing(language)`: the extensions that edit a script — its language, the token theme, completion and the problem gutter.
- `CodeStatusLine` (`problems`, `note`, `message`): the line under a code editor; the first `CodeProblem` as "Line 3: …" in its tone, or "No problems", the `note` at the right, and the `message` said politely.
- `takeOwnersText(view, text)`: the owner's text replaces the editor's as the owner's change, outside the undo history; nothing happens when the editor already shows it. `isChangedHere(update)`: whether an update holds a change the person made rather than the owner. `replaceTextAsOneStep(view, text, cursor)`: replaces the text as the person's change that undo takes back alone, with the cursor at `cursor`.
- `lineProblemLinter(check)`: CodeMirror's linter over `check(text)`, a function that resolves the text's `CodeProblem`s by line; each problem marks its whole line, after the linter's pause. `lineProblemsOf(state)`: the editor's marked problems by line. `isProblemsChange(update)`: whether an update set the marked problems.

## Playground

`codemirror.stories.tsx` (a workflow, JavaScript and Python, read-only) and `code-status-line.stories.tsx` (no problems, a problem, a warning with a message).

## Tests

Unit tests mount real views in jsdom: the view's life with React, the gutters' order, the languages and completion, the owner's text and undo, the linter by line and the status line. Coverage floor: 85 %.
