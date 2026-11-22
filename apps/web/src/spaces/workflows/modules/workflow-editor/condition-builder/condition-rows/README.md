# condition-rows

The rows of the editor's condition builder: a condition read by the language server (`workflow/readCondition`) as rows a person edits, the comparisons in the design's words, the second value typed as text, and the `workflow/edit` actions that write it. Logic without JSX; the language server writes and reads the jq (`setCondition`), never this code.

Owner: web — editor. Decisions: research D9 of the console redesign (005) — value · comparison · value, joined by all or any, "Write an expression" for anything else, never lost or rewritten; design system §6 ("Condition builder"); the approved mockup's `condCard`; the language server's `lsp-extensions.md` ("Read a condition", "Edit").

## API

- `COMPARISONS`: "is not empty", "is empty", "is", "is not", "contains", "does not contain", "is greater than", "is less than", each with the second value it takes (`none`, a typed `value`, or an `operand`: a value, data or a time). `secondOf(comparison)`. `TIMES`: Now, Today, Yesterday.
- `literalOf(text, comparison)`: a typed second value — a number, `true`, `false`, `null`, a quoted text, else the text; refused when empty ("Enter a value.") or not a number for "is greater than" and "is less than" ("Enter a number."). `literalText(value)`: the text that reads back as the same value (`"200"` for the text 200).
- A `Draft`: the join, the rows (each with a local id, the value's path or none yet, the comparison and the second value) and the steps to export. `draftOf(condition)` (one empty row when there is none), `withRowAdded`, `withRowRemoved` (the last leaves one to fill), `withLeft`, `withComparison` (the second value follows: none for emptiness, a typed value for contains), `withRight`, `withJoin`; `rowProblemOf(row)`.
- `conditionOf(draft)`: the condition to write, `null` while a row is not complete. `editsOf(pointer, draft)`: `useData` for each step to export first, then `setCondition`; nothing while incomplete. `settledOf(draft)` drops the exports once sent. `writtenPartOf(draft)` and `holdsReading(draft, reading)`: whether a new reading is what the builder already holds, so a reading from elsewhere replaces the rows and its own does not.

## Playground

`condition-rows.stories.tsx`: one row and no row yet, with the comparison and the typed value, the condition written and the edits sent.
