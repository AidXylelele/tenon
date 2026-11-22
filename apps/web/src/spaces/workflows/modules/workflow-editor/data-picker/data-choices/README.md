# data-choices

The data a person can put in one field of a step, as the data picker lists it: grouped by where it comes from, named in words, filtered as the person types, and the value each choice writes. Logic of the editor's data picker, without JSX: the caller passes the language server's `workflow/dataAt` answer for the field, and the outputs of the last test run where it has them.

Owner: web — editor. Decisions: research D9 (data without the expression language: recognition, not recall) and D16 (secrets only where credentials go, masked) of the console redesign (005); design system §6 (the data picker's empty states) and §7 (the token field); the approved mockup's `dataPicker` and `chipBtn`; the language server's `lsp-extensions.md` ("Data at a step").

## API

- `choicesOf(data, samples, query, onlyPaths)`: the groups to show — "From ‹step›" for each step before, nearest first (its known fields, or the fields of its sample from the last test run, "· the last test run", then "‹step› › the whole answer"); "From earlier steps" with "No step runs before this one; the first step gets the workflow's input." when none is; "Workflow input"; "Variables"; "Dates and times" (Now, Today, Yesterday); "Secrets · kept out of run records" where the language server offers them. A step whose answer is not known yet notes "Run a test to see the fields of the answer, or type a field name."; one that may be skipped notes that it then holds nothing. Typing keeps the choices whose words hold it and drops the notes; a typed field name (`items`, `slideshow.title`) is offered on each answer not fully known as "Use as a field of the answer", unless it is already offered. `onlyPaths` keeps the choices that are paths (the condition builder's values). The result counts what it shows and says the language server's warnings in words.
- A choice (`DataChoice`): `label` ("Fetch the digest › slideshow › title"), `value` (the field holding only it, `${ .slideshow.title }`), `expression`, `export` (the step to export first, where the data is read through the context), `kind` (data, time, secret), `shape` in words ("list of 2", "text", "any") and `isPath`.
- `choiceOfValue(value, data, samples)`: the choice a field's value holds, to show it as a chip; `null` for typed text or any other expression.
- `sampleMembersOf(expression, sample)`, `shapeOf(sample)`: the fields of a sample, three levels deep. `memberPathOf(base, name)` (`.items`, `.["a name"]`, `$context.fetch.items`), `valueOf(expression)`, `isPath(expression)`, `typedNamesOf(query)`.

## Playground

`data-choices.stories.tsx`: the data after a step before and after a test, at the first step, at an address (with a secret), and in a loop with paths only, with the search box.
