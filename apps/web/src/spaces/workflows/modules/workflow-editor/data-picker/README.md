# data-picker

The data picker and the field that takes data (the token field): what reaches a step, offered in words, so that a person never has to type the expression language for the common case. A part of the workflow editor module over its logic in `data-choices/`; it receives the language server's `workflow/dataAt` answer as a prop and reports what was chosen.

Owner: web — editor. Sources: research D9 and D16 of the console redesign (005); design system §6 ("Data picker": Popover + Command; no earlier step; no sample yet) and §7 ("Token field": chips announced by name, opened to change, removed; "Insert data" opens the picker with focus on its search; Escape closes only the picker; secrets as masked chips); the approved mockups `dataPicker`, `tokenField`, `chipBtn`.

## API

`DataPicker` (`DataPickerProps`): the "Insert data" button and its popover (Radix Popover with cmdk's Command, through libs/ui).

- `data`: `workflow/dataAt` for the field, or `null` while it is read ("Reading the data that reaches this step…").
- `onSearch(typed)`: the trimmed search text, so the module asks `workflow/dataAt` again with `typed` (and, always, the last test run's outputs as `samples`).
- `onlyPaths`: offers only paths (no times), for a condition's values. `label`: the button's words, "Insert data" by default; `describedBy`: the field it inserts into.
- The search says how many choices it shows through libs/ui's `useAnnounce` (an `Announcer` must be above it), and the groups' notes and the warnings sit under the list, read as the search's description.
- `open`, `onOpenChange`: optional control of the popover; `onOpenChange` also tells when to ask for `data`.
- `onPick(pick)`: `{ label, value, expression, export, secret }`; the popover closes and focus returns to the button.
- `onWriteExpression`: shows "Write an expression"; the popover closes and the caller takes focus.

`DataField` (`DataFieldProps`): the step form's `DataSlot` (`pointer`, `value`, `inputId`, `labelId`, `describedBy`, `invalid`, `placeholder`, `onText`, `onUse`, `onClear`) plus `data` and `onOpenChange`. A value that holds offered data is a chip named by the field's label and its words ("Fetch the digest › slideshow › slides"; a secret as "•••• NAME", announced as kept out of run records): pressing it reopens the picker, its × clears the field and keeps focus on "Insert data". Any other value is text; an expression is written in a mono text area, kept as typed (line breaks, spaces) and sent only when it changed; "Write an expression" turns a chip into its text and focuses it. The module renders it into the step form's `renderData` slot and asks `workflow/dataAt` for each such field when the form opens, so chips are named at once.

Consumers: the editor's step form (its `renderData` slot) and condition builder (its picker slot), wired by the editor in M5.

`DataChip` (`choice`, and for a field's chip `id`, `labelId`, `describedBy`, `onChange`, `onRemove`) is the one chip of the editor, the data field's and the condition builder's: its words truncate in the middle, keeping the field's name; picker rows truncate the same way and the selected row takes the accent. `choiceOfExpression(expression, data)` (the choice a condition's path names) is shared with the condition builder.

## Playground

`data-picker.stories.tsx`: before a test, fields after a test, no step before, secrets for an address, filtered by typing, a typed field name, reading. `data-field.stories.tsx`: typed text, a data reference, a secret reference, an expression.
