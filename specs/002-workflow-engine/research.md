# Research: Workflow Engine

These are the decisions in force at HEAD of `002-workflow-builder`, each with its reason and its source. Earlier designs and their reviews are in git history (`research.md` before 2a75b67).

Sources cited by short name:

- **DSL**: the Open Workflow Specification 1.0.3 (`dsl.md`, `dsl-reference.md`, the JSON Schema) and its Conformance Test Kit (CTK).
- **CloudEvents**: CloudEvents 1.0.2 and its HTTP protocol binding.
- **RFC 9457** (problem details), **RFC 9110** (HTTP semantics).
- **PostgreSQL**: the PostgreSQL 18 documentation.
- **Package docs**: the README and typings of each package, at the installed version.
- **MS Learn**: the .NET Microservices Architecture guide, DDD chapters.
- **Khorikov**: enterprisecraftsmanship.com.
- **Martin**: "The Clean Architecture" (2012).
- **k6**: the load scenarios in `apps/api/test/load` (commit 1b1d8d8).

## R1. Where the DSL lives

**Decision.** The DSL is checked and executed by a runtime in `frameworks/runtime`. That runtime implements contracts the adapters declare: `RuntimeChecks`, `TimingClient`, `TriggerClient` and `FilterClient`. It reports to the platform through `RunObserver`. The domain keeps what the platform decides:

- publishing and archiving;
- the instance lifecycle: phases, suspend, resume, cancel, restart and delete;
- webhooks, secrets and subscriptions.

Adapters only map. Library instances, clients, presets and error handling live in frameworks.

**Why.** The DSL's rules belong to the standard, not to the platform. The standard's schema and its kit define them (owner's decision, 2026-11-02: the SDK owns the language, the engine sits in frameworks, the domain stays thin). Martin: entities hold the enterprise's own critical rules, and frameworks are details at the edge.

**Rejected.** A domain interpreter, meaning a pure state machine with persisted rounds (about 9.8k lines). Commit 2a75b67 replaced it.

## R2. The durable engine (`@nestjs/workflows` 0.0.4)

**Decision.**

- **One run per instance.** The `instance` workflow, version 2, runs under the instance id. Each leaf task is one durable step; composites run their children between steps.
- **Children.** Sub-workflows are engine children, started with `executeChild` when awaited and with `startChild` and `parentClose: 'abandon'` when not. A detached process is a `process` child.
- **Worker settings.**
  - 10 concurrent runs per worker.
  - A 120 s lease, which the heartbeat renews.
  - A 90 s shutdown.
- **A 100 ms poll.** A start in the caller's transaction wakes the worker before the commit. The worker then finds nothing due and sleeps until the next poll, so a short poll bounds that wait (a4ae5dd, found under k6).
- **Outage retries.** A step's transient failure is retried 10 times, from 1 s doubling to 1 min, on top of a retry policy's own attempts. A PostgreSQL failover then delays an instance instead of faulting it.
- **Payload encryption.** Payloads are encrypted by `AesGcmPayloadCodec` with `SECRETS_KEY`, because step results may hold values a secret produced (R11).
- **Journal limit.** The engine's per-instance journal limit is accepted (spec, Clarifications 2026-10-28).

**Source.** The package docs: deterministic step names, no `ctx` inside a step, children, signals, schedules and codecs.

## R3. Publishing

**Decision.**

- **Like a compiler.** Publishing checks a document the way a compiler checks code, and the first problem refuses it, located by a JSON Pointer (FR-002). The order of checks is:
  1. the standard's JSON Schema;
  2. the DSL version;
  3. the subset;
  4. unique task names;
  5. references (`then` targets and names declared in `use`);
  6. durations;
  7. cron syntax, read by the engine's own parser;
  8. expression syntax;
  9. author schemas;
  10. `use.secrets` against the publisher's secret names.
- **Checks before the transaction.** The checks and reads run with no transaction; only the writes take one (`TransactionHost.withTransaction`). Under k6 load, publishing had held a pooled connection while it compiled a large document (a4ae5dd).
- **Bare expressions.** A bare text in a field that takes only an expression is compiled at publish too, because the runtime evaluates it as an expression even without `${}`. The fields are `if`, `input.from`, `output.as`, `export.as`, `for.in`, `while`, a switch case's `when`, the catch and retry conditions, and listen's `until` (c6bda66). Text in data stays data.
- **Root properties.** A property beyond the 1.0.3 root is refused. `evaluate` is a DSL 1.0.4 property, so expressions are jq in strict mode.
- **Stored form.** A version stores the document as JSON and a SHA-256 fingerprint of its canonical JSON. The same fingerprint under the same identity is the same version (200), and other content is a conflict (409).

**Why.** FR-002 and FR-003. AWS Step Functions validates a definition's syntax in the same spirit. Other workflows are resolved at run time, as Step Functions (`StateMachineDoesNotExist`) and Camunda (an incident) do.

## R4. Expressions (jq)

**Decision.** jq-wasm (jq 1.8.2) runs in Piscina workers behind `PiscinaJqClient`.

- **Pool size.** One worker per engine slot plus one for the compilations of a publish.
- **A 5 s timeout** (the `jq` preset). The timeout counts the wait for a worker and the main thread's event-loop delay. Under k6 load, the earlier 1 s faulted trivial expressions, while 5 s still stops a runaway (a4ae5dd).
- **A 128 MB worker heap.** A program that builds a huge value (`[range(1e9)]`) ends its worker, not the process (30c817b).
- **A sandbox prelude.**
  - `env`, `input`, `inputs`, `input_filename`, `halt`, `halt_error`, `localtime` and `strflocaltime` raise errors, and `$ENV` is `null`.
  - `debug` and `stderr` pass their input through.
- **Outputs.** No output gives `null`, one output gives that value, and several outputs are an expression error.

**Why.** The DSL: "All runtimes **must** support the default runtime expression language, which is jq". jq-wasm computes synchronously, and only terminating a worker thread stops a runaway; its README recommends Piscina for that.

## R5. JSON Schema (Ajv)

**Decision.**

- **The standard's schema.** The SDK exports it (`workflowSchema`), and Ajv 2020 compiles it once. A defective task is validated again against its own kind, so the pointer names the real defect.
- **Author schemas.** `input`, `output` and `export` schemas are compiled at publish and validated in Piscina workers behind `AjvJsonSchemaClient`. Each worker holds one Ajv per draft with a bounded cache. The `schemas` preset gives 5 s, for the same reason as R4: Ajv trusts its schemas, and a `pattern` can backtrack without end.

**Why.** zod cannot read `unevaluatedProperties`, `if`/`then` or `dependentSchemas`, which the DSL schema uses. The SDK validates only the standard's own types, not an author's schemas.

## R6. Service calls

**Decision.** `call: http` and `call: openapi` go through `UndiciEndpointClient` on the `EndpointDispatcher`.

- **Limits.** The `service-calls` preset gives 30 s and a bulkhead of 64 that rejects when full. A response may hold 1 MiB.
- **Authentication.** Basic, bearer, and OAuth2 or OIDC client credentials.
- **OpenAPI.** The document is dereferenced with `@apidevtools/json-schema-ref-parser`, external resolution off.
- **Content.** JSON media types are parsed; `text/*`, XML and YAML are text; anything else is base64.

**Why.** FR-021 and FR-022. Node exposes neither undici's `Agent` nor `MockAgent`.

## R7. Scripts and shell commands (go-judge)

**Decision.**

- **Awaited processes.** An awaited `run: script` (`js`, `javascript`, `python`) or `run: shell` is one engine step in go-judge. Each process gets 30 s, 256 MiB, 50 processes and 1 MiB per output stream, with no network.
- **Outages.** A full bulkhead, an unreachable sandbox, or an answer that is not go-judge's is an outage of the platform. The step is repeated later, and the author's task does not fault.
- **Refusals.** go-judge's own refusal (400 or 404) is an answer, and the task faults with a runtime error.
- **Detached processes.** `await: false` starts a `process` child that nobody awaits.
- **Sandbox capacity.** `ES_PARALLELISM` is at least the `processes` bulkhead (8) times the API processes that run scripts.

**Why.** The owner's decision (Clarifications 2026-10-28) and constitution VII. `node:vm` and `isolated-vm` run in process and support JavaScript only.

## R8. Events and listening

**Decision.**

- **One event store.** An event is accepted once per (source, id), with `ON CONFLICT DO NOTHING`. The same transaction adds one outbox message `event.accepted` under the key `events`, so consumers see events in acceptance order. This follows CloudEvents: "consumers MAY assume that Events with identical source and id are duplicates".
- **Dispatch through outbox consumers after the commit.**
  - `dispatch` signals every listening run.
  - `schedule-on` starts instances (R10).
  - `subscriptions` schedules deliveries (R12).
- **Listening.** A `listen` task stores a listener (instance, key, types, `since`) and waits for engine signals named `event` with the listener's key. The signal id is `{sequence}:{key}`, because the engine keeps one signal per id under a signal name. A repeated dispatch therefore reaches each listener once.
  - Only events accepted after the listen began reach it.
  - Its output is the consumed events in its read mode (`data`, `envelope` or `raw`).
  - `one`, `any`, `all` and an `until` expression are supported.
  - `listen.foreach` and an `until` of events are refused at publish.
- **Filters.** Each attribute in `with` is one of three things:
  - a regular expression the attribute's value matches whole;
  - a runtime expression evaluated on the attribute's value, which must hold or give that value (the DSL reference's example `data: ${ .temperature > 38 }`);
  - for `data`, an object the data must contain.

  `correlate` keys must agree. One class (`EventFilters`) matches for listens, `schedule.on` and subscriptions alike.

- **Lifecycle events.** CloudEvents typed `io.serverlessworkflow.{workflow|task}.{change}.v1`, with the source `/workflows/{namespace}/{name}/instances/{id}`. They are written in the same transaction as the change: by the instance repository's `save`, and by the task progress store. An `emit` may not use a `/workflows/` source.

## R9. Webhooks

**Decision.**

- **The token.** 32 random bytes in base64url, shown once and kept as its SHA-256 fingerprint. A webhook has no owner; editors manage them all.
- **The event.** A call becomes one CloudEvent of the webhook's type, with the source `/webhooks/{webhook id}` and the data `{ body, query, headers }`. A body that is not JSON is text. The API mapper lower-cases header names and leaves out `Authorization` and `Cookie`.
- **Deduplication.** The caller's `Idempotency-Key` is the CloudEvent id, so repeated calls are one event under R8's uniqueness. This is stricter than "once within 24 hours", because it holds forever. The route therefore carries no `@Idempotent`.
- **Not found.** Unknown and deleted tokens give the same 404.

**Why.** FR-024 and CloudEvents' (source, id) rule.

## R10. Schedules

**Decision.**

- **Which version.** `Workflow` decides the version its schedule starts: the current one while the workflow is on, none when it is off. A schedule change (publish while on, archive, turn on or off) leaves through the outbox. `SyncSchedule` then applies the timing that the runtime reads from the document (`TimingClient`); the engine's schedule client gets only that timing (2e13a75).
- **`cron` and `every`.** Both are engine schedules with `missed: 'once'` and `overlap: 'allow'`. A cron is in UTC. `every` takes no time zone, because it repeats from the epoch whatever the zone.
- **`after`.** A chain of delayed links, each a `schedule` run. The first is named `after-{workflow id}-{revision}`, and each next one `after-{previous instance id}`, started in the transaction that completes the previous instance. A faulted or cancelled instance ends the chain. `Workflow` refuses a link while an instance the schedule started still runs, so one chain goes on at a time.
- **`schedule.on`.** `StartOnEvent` runs in one transaction with its outbox consumer's inbox (`processInTransaction`), so each event starts an instance exactly once. The input is `[event]`. Publishing refuses `schedule.on.all` and an `until`, which would keep state between events outside any instance.

**Why.** The DSL: `after` starts the next run after the previous one completes. The package docs on engine schedules.

## R11. Secrets

**Decision.**

- **At rest.** Values are sealed with AES-256-GCM (`node:crypto`, `AesGcmCipher`, `SECRETS_KEY`, a random 96-bit IV per value). The engine's payload codec uses the same key (R2).
- **At run time.** A run reads the values its version's `use.secrets` names once per execution, never journaled. A replaced value counts from the next execution, and a deleted secret is an authorization error.
- **Masking.** Values are masked in task records, outputs, errors and emitted events.
- **Publishing.** A `use.secrets` name its publisher does not own is refused, and so is a secret-based authentication policy naming an undeclared secret.
- **`$secrets`.** Bound only in the workflow's `input.from`, a recorded contradiction (R16).

**Why.** FR-007, constitution VII, and US8 AS4.

## R12. Subscriptions and deliveries

**Decision.**

- **Creating a subscription.** `Subscription.create` refuses a secret its owner does not keep. A filter whose pattern or expression does not compile is refused at its pointer under `/filter`.
- **Matching.** `MatchSubscriptions` runs in one transaction with its consumer's inbox. Each subscription that existed when the event was accepted, and whose filter takes the event, gets a pending delivery row and one `delivery` engine run named by the subscription and the event.
- **Retries.** A delivery is retried 36 times, from 1 s doubling to 1 h, about 24 hours in all, then marked failed. Every attempt sends the same event, so the same id.
- **Isolation.** At most 4 deliveries run at once overall and 1 per subscription. A slow destination therefore holds one slot and delays neither workflows nor other subscriptions (US6 AS4); this replaces circuit breakers.
- **Sending.** Events go in CloudEvents' HTTP structured mode (`application/cloudevents+json`) through the `EndpointDispatcher` (FR-022) with the `service-calls` preset. A 2xx answer is delivered. The secret's value becomes the `Authorization` header and is masked in any error.

**Why.** FR-025, FR-026 and CloudEvents' HTTP binding.

## R13. Idempotency (`@nestjs/idempotency` 0.0.3)

**Decision.** `@Idempotent` is applied only to starting an instance, scoped per user.

- **Defaults kept.** Keys are kept 24 hours, and `storeIf` stays at its default (status < 500): a key names one request, and its refusal is its answer, as Stripe stores the 4xx its endpoint answered.
- **The fingerprint.** It is the parsed start body with its defaults applied (`input: {}`, `version: 'latest'`), so an omitted input and `{}` are the same request.
- **Responses.** A request still in flight is a 409; the same key with another request is a 422.
- **Identity.** Instance ids are not derived from the key, so after 24 hours the same key starts a new instance.

**Sources.** The package docs; Stripe API reference, "Idempotent requests".

## R14. Errors

**Decision.**

- **Refusals as values.** The domain and the use cases return expected refusals as `Result` values with a code. An optimistic conflict is `StaleWriteError`.
- **Problem documents.** Every automation controller answers refusals through `ProblemFilter` as `application/problem+json`.
  - A named refusal has the type `urn:problem:<code>`, its title and its status.
  - A located refusal lists `errors[{ pointer, detail }]`.
  - Other refusals (validation, authorization, idempotency) are `about:blank` problems titled by their status, keeping a library's `code` as an extension member.
- **Database outages.** A transient PostgreSQL failure answers 503 with `Retry-After: 5`.
- **Engine and outbox.** `ErrorClassifier` tells settled, transient and permanent errors apart. `StepErrors` and `OutboxErrors` turn the result into retry, stop or dead-letter. Use cases never catch.

**Sources.** RFC 9457 §3.1, §3.2 and §4.2.1; RFC 9110 §15.6.4.

## R15. Persistence and reads

**Decision.**

- **Repositories.** An aggregate's repository has one `save`: an upsert fenced by the row's version, so a lost race is `StaleWriteError`. Write-once rows use `add`.
- **Instance lists.** The lists order by `created_at DESC, id DESC` on the ascending indexes `(created_at, id)` and `(workflow_id, created_at, id)`. A backward scan serves the `DESC` order. An index declared `DESC NULLS LAST` does not match the `NULLS FIRST` that `DESC` sorts by (PostgreSQL §11.4, "Indexes and ORDER BY"). Migration 0009 fixed this after k6.
- **Pages.** Pages are keyset pages: read `limit + 1` rows and keep `limit`.
- **Read models.** The stores write `task_progress`, `event`, `listener` and `delivery`, and the queries read them.

## R16. Conformance (ER-001)

**Decision.**

- **One declaration.** The supported subset is declared once, in `frameworks/runtime/conformance.ts`. The version and subset checks read it, and `GET /conformance` publishes it: DSL versions, tasks, calls, runs, script languages, authentications, exclusions and contradictions.
- **Recorded contradictions.**
  - CTK `try.feature`, "Try Handle Caught Error", filters on `…/dsl/errors/types/communication`, but the specification defines `…/spec/1.0.0/errors/communication`. The platform raises the latter (FR-032).
  - `$secrets`: the argument table lists it in every expression, and its description only in `input.from`. The platform follows the description.
- **The harness.** The CTK 1.0.3 feature files run unchanged through the HTTP API with `quickpickle`. undici `MockAgent` stands in for petstore and httpbin.

## R17. Readings of the standard in force

| Point                       | Reading                                                                                                                                                                                                                                                                                       |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `$runtime`                  | `{ name: 'workflow-platform', version }`, the version from `package.json`                                                                                                                                                                                                                     |
| `emit`                      | The runtime sets `specversion` and adds an `id` and a `time` the author left out. The task's output is the event. A source or type that is not text faults the task with a runtime error                                                                                                      |
| `run.workflow.version`      | `latest` is the target's current version when the task starts. A missing or archived target faults the task with a configuration error. A faulted child faults the task with the child's error                                                                                                |
| `fork`                      | The branches' outputs in branch order, and their contexts applied in branch order. With `compete`, the first branch to complete wins and the others stop at their next task                                                                                                                   |
| `try`                       | A single guarded task is retried by the engine's own step retries; several are run again after a durable sleep. Then `catch.do` runs if there is one. Without it, a caught error that was not to be retried completes the task with its input, and spent retries fault it with the last error |
| Backoff                     | `constant`: the delay; `linear`: the delay × the attempt; `exponential`: the delay × 2^(attempt − 1). Backoff parameters, `limit.attempt.duration` and expressions as delays are refused                                                                                                      |
| `catch.errors.with.details` | Matches the error's `detail`                                                                                                                                                                                                                                                                  |
| Process output              | `return` picks stdout (the default), stderr, the code, all three, or none. A non-zero exit is not an error                                                                                                                                                                                    |
| Communication error         | Type `https://serverlessworkflow.io/spec/1.0.0/errors/communication`                                                                                                                                                                                                                          |
| Status-changed events       | Not produced                                                                                                                                                                                                                                                                                  |

## R18. Dependencies added by this feature

Each one exists because nothing already in the stack covers it:

| Package                                      | Purpose                                                                          | Why nothing else suffices                                                                                      |
| -------------------------------------------- | -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `@nestjs/workflows` 0.0.4                    | Durable runs, steps, signals, children, schedules, leases                        | Owner's requirement; first-party (AR-004)                                                                      |
| `@nestjs/outbox` 0.1.3 (from 0.1.1)          | Reactions after the commit; consumer inboxes                                     | Owner's requirement; first-party. 0.1.2 fixed store writes of error texts holding U+0000                       |
| `@nestjs/idempotency` 0.0.3                  | Idempotent starts                                                                | Owner's requirement; first-party                                                                               |
| `@nestjs/resilience` 0.0.3                   | Timeouts and rejecting bulkheads (`service-calls`, `processes`, `jq`, `schemas`) | Owner's requirement; first-party                                                                               |
| `@openworkflowspec/sdk` 1.0.3-alpha8         | The standard's JSON Schema and its TypeScript types                              | The standard's own artefact, so no copy of the schema; `latest` is a 0.0.1 placeholder, so the alpha is pinned |
| `ajv` 8.20.0, `ajv-formats` 3.0.1            | The DSL schema (draft 2020-12) and author schemas                                | zod cannot read the DSL schema; the SDK validates no author schema                                             |
| `jq-wasm` 3.0.0-jq-1.8.2                     | jq, which the DSL mandates                                                       | Node has no jq; JavaScript reimplementations differ in semantics                                               |
| `piscina` 5.3.2                              | Worker pools for jq and Ajv                                                      | A runaway program cannot be interrupted on the main thread                                                     |
| `undici` 8.12.3                              | The SSRF-checking dispatcher, the go-judge pool, `MockAgent`                     | Node's built-in `fetch` exposes neither `Agent` nor `MockAgent`                                                |
| `@apidevtools/json-schema-ref-parser` 16.0.5 | Dereferencing the OpenAPI document of `call: openapi`                            | `@nestjs/swagger` writes our own document and reads none                                                       |
| `quickpickle` 1.11.2 (dev)                   | The CTK's Gherkin features in Vitest                                             | The kit is Gherkin                                                                                             |
| `testcontainers` 12.2.1 (dev)                | go-judge in integration tests                                                    | Already a dependency of `@testcontainers/postgresql`                                                           |

AES-256-GCM uses `node:crypto` and needs no package. The health route's database check uses `@nestjs/terminus`, already in the stack from feature 001. The go-judge sandbox is a service built from `docker/go-judge`. Node.js is 26.13.0 LTS.

## R19. Rounds

**Rounds 1–18** (2026-10-28 to 2026-11-02) reviewed the domain interpreter that 2a75b67 replaced. Their decisions still in force are folded into R1–R18 above.

**Round 19** (2026-11-03): critics on the runtime slices US1–US9.

- **The critics.** A DDD critic (Khorikov, the MS Learn DDD guide, GRASP and SOLID) and a Clean Architecture critic (Martin, 2012).
- **Decisions taken** (2fd7d61, 2e13a75, a9f9990, 30c817b):
  - `Subscription.create` refuses a secret its owner does not keep.
  - `DeliverEvent` reports delivered or refused, and the delivery log writes only what it is told, at the use case's time.
  - The undici delivery client builds the header from the secret and masks it.
  - The runtime reads a schedule's timing, and the engine's schedule client gets only that timing. Cron reading is its own `EngineCronModule`. `Workflow` decides `scheduledVersionId` and refuses an `after` link while the schedule's instance runs.
  - `AcceptEvent` and `Listen` take the time from `Clock`. A start or an end carries the instance's own time.
  - `Webhook.receive` names the event's source, and the HTTP mapper drops the credentials.
  - Unused code was removed. `JsonPointer` alone escapes reference tokens. "Only events accepted once it exists reach it" is one query criterion. A jq worker has a 128 MB heap.
- **Argued against, with sources:**
  - (a) **The cancel cascade stays in one transaction.** US9 AS3 says the children end with the parent. MS Learn ("Domain events: design and implementation") allows either choice across aggregates: "both approaches (single atomic transaction and eventual consistency) can be right. It really depends on your domain or business requirements".
  - (b) **Lifecycle events are written with the aggregate in the repository's `save`.** eShop's ordering service dispatches domain events in `SaveEntitiesAsync`, inside the same transaction (MS Learn, same page: "the initial deferred approach … is the approach used in the ordering microservice in eShop").
  - (c) **No shared value object for event types.** "Starts on events" (`WorkflowVersion.eventTypes`: null for none, empty for any, or a list) and "takes events" (`Subscription.types`: null for any, or a list) are different concepts, one tri-state and one two-state.
  - (d) **The secret ownership check at publish** passes the publisher's names into the runtime's `use.secrets` check (`SecretCheck`). The policy (whose secrets) stays in the application; the symbol resolution stays in the runtime.
  - (e) **Policy classes stay one per resource,** as `@nestjs/authorization` is designed (`@Can(Policy, 'action')`).
  - (f) **`TransactionHost.withTransaction` in `PublishVersion`** is the documented imperative form of `@Transactional` (`@nestjs-cls/transactional`).
  - (g) **The DSL runtime stays in frameworks,** implementing the adapters' contracts, by the owner's decision of 2026-11-02 (R1).
- **Open tensions with the owner's rules,** raised by the critics, for the owner to decide:
  - **Domain services.** The model has none. A rule that spans aggregates sits in the use case that gathers them, for example the cancel cascade over awaited children. MS Learn names domain services as the home of rules that span entities or aggregates.
  - **Orchestration branches in use cases.** Some use cases loop and branch over what they gathered, for example `CancelInstance`, `StartOnEvent` and `DeliverEvent`, against the rule that use cases stay linear.
  - **Reads that need a domain decision may load aggregates.** `CheckDefinition` (a check that saves nothing) and `SyncSchedule` load a `Workflow` to let it decide, against the rule "reads never hydrate aggregates".
