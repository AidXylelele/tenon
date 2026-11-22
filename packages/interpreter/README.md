# interpreter

The interpreter of the [Open Workflow DSL 1.1.0](spec/1.1.0/dsl.md). It compiles a workflow document into a
program and runs it one step at a time. It performs no input or output: a step names the effects the run waits
for as data, and the embedder performs them and answers by their ids. The state of a run is JSON.

## Entries

`interpreter` — `createInterpreter()` gives an `Interpreter`:

- `compile(source, { profile, imports })` gives `{ kind: 'compiled', program, analysis }` or
  `{ kind: 'refused', diagnostics, analysis }`, the analysis holding the document as read;
- `filter(filter)` compiles an event filter that accepts or refuses a CloudEvent with no run.

The profile's `triggers: 'one'` refuses a schedule of more than one trigger, and an MCP transport option outside
its `mcpTransportOptions` is refused. `createSecretPolicies()` decodes an
authentication policy a secret holds; `endingOf(end)` gives the standard's events and error for a run the host
ends itself; `lifecycleEventCatalogue` gives each event name's types and the data field of its moment.

A `Program` holds its `manifest` (identity, effects, secrets, schedules, routing filters) and its `fingerprint`;
`start`, `correlate`, `respond`, `suspend`, `resume` and `cancel` each give the next `Step`: its `status`, the
`state` to keep, the effects `requested` and `withdrawn`, the standard's lifecycle `events`, and beside them
`taskInputs` and `taskOutputs`: each task's input once its `input.from` has run and its output once it completes,
under the `execution` of its events, for a host that keeps them (the claim check of `task.completed`'s `outputUri`).

`interpreter/front-end` — for editors: `createAnalyzer(engine)` gives an `Analyzer`, whose `analyze` gives the
semantic model and its diagnostics and whose `schemasAt` reads the grammar at a place; `resolutionsOf(model,
pointer)` gives what the names of the expression at a pointer resolve to; and the standard's catalogues.

## Test

```sh
pnpm --filter interpreter test
```

`tests/conformance` plays the standard's conformance features, `tests/diagnostics` the analysis's refusals,
`tests/scenarios` whole runs step by step; `tests/program.test.ts` and `tests/interpreter.test.ts` hold the rules
of a run and the public API, `tests/front-end.test.ts` the editor's reads.
