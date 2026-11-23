# condition-builder

The condition builder for "Choose a path" (each branch's condition) and "Run only if": rows of value · comparison · value joined by all or any, and "Write an expression" for anything else. A part of the workflow editor module over its logic in `condition-rows/`; the language server reads a condition into rows and writes them as jq.

Owner: web — editor. Sources: research D9 of the console redesign (005); design system §6 ("Condition builder": an expression it cannot show opens in expression mode, unchanged) and §7 (focus stays on the control whose view changes); the approved mockups `condCard` and `formSwitch`; the language server's `lsp-extensions.md` ("Read a condition", "Edit").

## API

`ConditionBuilder` (`ConditionBuilderProps`): the step form's `ConditionSlot` (`pointer`, `text`, `required`, `labelledBy`, `describedBy`, `invalid`) plus:

- `reading`: `workflow/readCondition` of `text`, or `null` while it is read; "Reading the condition…" shows only before the first reading, and the last one stays on screen while the text is read again. A `condition` opens as rows (no row yet: one row to fill); an `expression` opens as the expression, as written, with no way back to rows until it reads as one.
- `data`, `samples`: `workflow/dataAt` for the field and the last test run's outputs, to name each value in words ("Fetch the digest › slideshow › slides"); a path not offered is shown as written.
- `renderPicker(slot)`: the module renders the data picker with `onlyPaths` (`PickerSlot`: `label`, "Choose data" or "Choose data to compare with", and `onPick({ value, expression, export })`).
- `onEdit(actions)`: once every row is complete, `useData` for each step to export, then `setCondition`; an expression (a mono text area, kept as typed) is `setField` when it changed, or `clearField` when an optional condition is emptied.

A row: its value (the data chosen), its comparison ("is not empty", "is empty", "is", "is not", "contains", "does not contain", "is greater than", "is less than") and, where the comparison takes one, what it is compared with (a value typed, data from the workflow, Now, Today or Yesterday). Rows are added and removed; with two or more, "All must hold" or "Any may hold". A reading that comes back as the builder's own condition keeps the rows being edited; one from elsewhere (the Code view) replaces them.

Consumer: the editor's step form, through its `renderCondition` slot, wired by the editor in M5.

## Playground

`condition-builder.stories.tsx` (inside a branch card, with a stand-in for the picker slot): two rows that all must hold, two rows any may hold, no condition yet, a time and data compared, a non-canonical expression opening as an expression, written as an expression by choice, reading.
