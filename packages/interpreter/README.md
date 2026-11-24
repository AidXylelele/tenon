# interpreter

The interpreter of the [Open Workflow DSL 1.1.0](spec/1.1.0/dsl.md). It compiles a workflow document into a
program and runs it one step at a time. It performs no input or output: a step names the effects the run waits
for as data, and the embedder performs them and answers by their ids. The state of a run is JSON.

## Entries

`interpreter` — `createInterpreter(options)` gives an `Interpreter`:

- `compile(source, { profile, imports })` gives `{ kind: 'compiled', program, analysis }` or
  `{ kind: 'refused', diagnostics, analysis }`, the analysis holding the document as read;
- `filter(filter)` compiles an event filter that accepts or refuses a CloudEvent with no run.

The profile's `triggers: 'one'` refuses a schedule of more than one trigger, and an MCP transport option outside
its `mcpTransportOptions` is refused. `createSecretPolicies()` decodes an
authentication policy a secret holds; `endingOf(end, options)` gives the standard's events and error for a run the
host ends itself; `lifecycleEventCatalogue` gives each event name's data field of its moment and whether it is
reported once or ends its workflow or task; `lifecycleEventTypesOf(options)` gives each event name's CloudEvent
types. A lifecycle event is typed `org.open-workflow-specification.<name>.v1`; the options' `legacyEventTypes: true`
types it `io.serverlessworkflow.<name>.v1` too, and is off when left out.

A `Program` holds its `manifest` (identity, effects, secrets, schedules, routing filters) and its `fingerprint`;
`start`, `correlate`, `respond`, `suspend`, `resume` and `cancel` each give the next `Step`: its `status`, the
`state` to keep, the effects `requested` and `withdrawn`, the standard's lifecycle `events`, and beside them
`taskInputs` and `taskOutputs`: each task's input once its `input.from` has run and its output once it completes,
under the `execution` of its events, for a host that keeps them (the claim check of `task.completed`'s `outputUri`).

`interpreter/front-end` — for editors: `createAnalyzer(engine)` gives an `Analyzer`, whose `analyze` gives the
semantic model and its diagnostics and whose `schemasAt` reads the grammar at a place; `resolutionsOf(model,
pointer)` gives what the names of the expression at a pointer resolve to; and the standard's catalogues. `analyze`
models every document whose structure the grammar admits: a value the grammar rejects (a pattern, a format, a length,
a bound, in the one form of a choice the value takes) and a name or an event attribute left empty are diagnostics of
that model. A document whose structure breaks, or that fits two forms of a choice at once, is refused. `compile`
refuses every document with a diagnostic.

## Telemetry

The interpreter speaks the OpenTelemetry API only (`@opentelemetry/api`, a peer dependency), with the scope
`interpreter`. With no SDK registered it records nothing. A host that wants its telemetry registers the SDK in the
same thread **before** `createInterpreter()`: the metrics API has no proxy, so instruments taken earlier stay
no-op. Spans are children of the host's active context. Nothing carries inputs, outputs, task values or secrets.

| Span                                                                       | Attributes                                                                                                                                                                                                                                  |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `interpreter.compile` → `interpreter.analyze`, `interpreter.translate`     | `interpreter.compile.subject` (`workflow`, `filter`), `interpreter.compile.outcome` (`compiled`, `refused`)                                                                                                                                 |
| `interpreter.start`, `correlate`, `respond`, `suspend`, `resume`, `cancel` | `interpreter.operation`, `interpreter.workflow.namespace`, `.name`, `.version`, `interpreter.instance.id`, `interpreter.run.status`, `interpreter.transitions`, `interpreter.fibers`, `interpreter.effects.requested`, `interpreter.events` |

| Histogram                      | Unit           | Attributes                                                                                                                                        |
| ------------------------------ | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `interpreter.compile.duration` | s              | subject, `interpreter.compile.phase` (`analyze`, `translate`), outcome or `error.type`                                                            |
| `interpreter.step.duration`    | s              | `interpreter.operation`, `interpreter.run.status` or `error.type`                                                                                 |
| `interpreter.step.transitions` | `{transition}` | `interpreter.operation`                                                                                                                           |
| `interpreter.run.duration`     | s              | `interpreter.run.status` (`completed`, `faulted`, `cancelled`), recorded by the call that ends the run, from the run's start to that call's `now` |

A thrown error marks its span as an error, records the exception and puts `error.type` on the duration; a run
that faults is an outcome, not an error.

## Scripts

`build` compiles `src` into `dist`, `dev` does it in watch mode; `lint`, `check-types` and `test` (Vitest) check it.

`tests/conformance` plays the standard's conformance features from `spec/1.1.0/ctk`, `tests/diagnostics` the
analysis's refusals, `tests/scenarios` whole runs step by step; `tests/program.test.ts` and
`tests/interpreter.test.ts` hold the rules of a run and the public API, `tests/front-end.test.ts` the editor's reads
and `tests/telemetry.test.ts` the spans and metrics. `spec/1.1.0` is the vendored standard; it is never edited.
