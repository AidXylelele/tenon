# Research: Workflow Engine

These are the decisions in force, each with its rationale and the alternatives rejected. Sources:

- the standard: `dsl.md`, `dsl-reference.md` and the schema, all v1.0.3;
- Synapse at ba3fbfd;
- the package docs and typings;
- Khorikov's posts;
- Martin (2012).

## R1. How the DSL is processed

**Decision:** The domain owns the standard's semantics. That is what Synapse's `TaskExecutor` base, its subclasses and `GetTaskAfter` do:

- stages and skipping;
- flow;
- composites;
- catch and retry;
- timeouts;
- phases;
- correlation.

It hands out four kinds of work, which are the four things Synapse's executors call out to:

| Work                            | Synapse                | Port                  |
| ------------------------------- | ---------------------- | --------------------- |
| Expressions and pattern matches | `IExpressionEvaluator` | `ExpressionEvaluator` |
| Schemas                         | `ISchemaHandler`       | `SchemaValidator`     |
| HTTP and OpenAPI                | its HTTP clients       | `ServiceCaller`       |
| Scripts and shell               | its process executors  | `ProcessRunner`       |

`AdvanceInstance` runs one round (architecture.md §3).

**Rationale:**

- **Martin:** entities hold the critical business rules, and for this product those rules are the standard.
- **Khorikov:** the four code quadrants, the trilemma (purity), and "Immutable architecture" ("as dumb as possible") all point the same way.
- **Durability:** a recorded result is never computed again.

**Alternatives rejected:**

- executing SDK objects directly (Synapse);
- an interpreter in application services or in adapters;
- per-kind instructions with a dispatching executor.

## R2. Durable engine (`@nestjs/workflows` 0.0.4)

**Decision:**

- One run per instance (`@Workflow('instance')`, id = instance id), with the loop `advance-N` / `park-N`.
- State stays in our tables; the journal holds only Progress.
- Default journal limits (about 5,000 parks), accepted.
- `leaseDuration` 120 s, renewed by the worker heartbeat.
- Retries for transient errors only; then the `fault` step.

**Rationale:** The engine's documented rules (deterministic names, no `ctx` inside steps), and our tables as the business record.

**Alternative rejected:** control flow in `run()` with one step per leaf task.

## R3. Rounds and transactions

**Decision:**

1. Load the definition's declared secret values.
2. Begin the round and save.
3. Compute, with no transaction.
4. In `TransactionHost.withTransaction`: reload, record, save, and add the produced Events.

`InstanceRuns.start` and `wake` run inside the caller's transaction. S0 tests the nestjs-cls `tx`, the lease renewal, and that a signal sent during a step survives.

**Rationale:**

- A 30-second call must not hold a pooled connection.
- Producing Events in the same transaction removes an outbox hop and keeps lifecycle order. This was the DDD critic's point 6: the Event rows live in the same database.

## R4. Domain events and the outbox (`@nestjs/outbox` 0.1.3)

**Decision:** Repositories write an aggregate's `#events` to the outbox in the save transaction. The topic is the domain event's name and the payload is its props. Each event below exists because its reaction either leaves the database or belongs to an aggregate that advances separately, under its own concurrency:

| Event                                                   | Reaction                                              | Key            | Why it is outside the transaction                                              |
| ------------------------------------------------------- | ----------------------------------------------------- | -------------- | ------------------------------------------------------------------------------ |
| EventAccepted                                           | RouteEvent                                            | —              | unbounded fan-out; webhook answers must not wait                               |
| (EventOffers) correlation, trigger, delivery offers     | OfferEvent, OfferTrigger, OfferDelivery               | candidate      | one message per candidate, so one slow filter delays no other                  |
| CorrelationStarted                                      | CatchUpCorrelation                                    | correlation    | catch-up must see events committed after the start                             |
| ListenStarted, ListenEnded                              | StartCorrelation, EndCorrelation                      | instance       | correlations advance under their own concurrency, per event                    |
| EventConsumed, CorrelationCompleted                     | ConsumeListenEvent, CompleteListen                    | instance       | the instance advances in its own engine run                                    |
| TriggerSatisfied                                        | StartTriggeredInstance                                | workflow       | a new instance and its run                                                     |
| SubWorkflowRequested, SubWorkflowEnded, CancelRequested | StartSubWorkflow, CompleteSubWorkflow, CancelInstance | parent / child | a separate instance in a separate run; `latest` and the input check need reads |
| ProcessDetached                                         | RunDetachedProcess                                    | instance       | a sandbox process outside the database                                         |
| NextStartDue (`delay`)                                  | StartScheduledInstance                                | workflow       | delayed by definition                                                          |
| RecurringScheduleSet, RecurringScheduleCleared          | RegisterRecurringStarts, RemoveRecurringStarts        | workflow       | `WorkflowSchedules.upsert` takes no transaction                                |
| DeliveryScheduled                                       | DeliverEvent                                          | —              | it leaves the system                                                           |

**Rationale:** Khorikov, "Domain events: simple and reliable solution". 0.1.2 fixed store writes of error texts containing U+0000.

## R5. Events, filters and correlation

**Decision:**

- **One event log.** `Event.accept` (intake, webhooks) and `Event.produced` (lifecycle, emit) feed it.
- **Filtering.**
  - Candidates come from GIN indexes on `filter_types` / `trigger_types`, where `*` marks a filter with no exact type.
  - `EventFilter` is the only owner of matching. A `${}` attribute is evaluated with the CloudEvent as `.`. A plain value is an anchored regular expression (`PatternMatch` work) or an exact value. `correlate.from` and `expect` are evaluations, and `until` is supported.
- **Listen window.** Events accepted after the listen started, plus catch-up after the correlation commits.

**Rationale:** Synapse's regex branch falls through to equality, and it lacks `until`. The CA critic found the catch-up race.

## R6. Schedules

**Decision:**

- **Owner.** `Workflow` owns the schedule and the epoch. Replacing a schedule is `previous.deactivate()` + `next.activate(epoch)`, and `NoSchedule` is the null object.
- **`cron` / `every`:** engine schedules with `missed: 'once'`, `overlap: 'allow'`, UTC and occurrence ids.
- **`after`:** `NextStartDue(0)` on activation. Then `AfterOrigin` raises `NextStartDue(delay)` when the instance **completed**.
- **`on`:** `trigger_types`.
- **Stale starts.** Scheduled and triggered starts read the workflow `FOR SHARE` and call `assertStartable(epoch)`. Trigger contexts of an old epoch are never offered again; retention removes them later.
- **Cron syntax** is checked at publish with `parseSchedule` from `@nestjs/workflows/core`.

**Rationale:** The standard says "after it completes". Synapse keeps its schedules in in-memory timers.

## R7. Delivery

**Decision:**

- **Owner.** `Delivery` owns delivered, pending, failed after 24 hours, and the masked `lastError`.
- **Planning.** `OfferDelivery` plans one delivery per matching subscription.
- **Sending.** `CloudEventSubscriberGateway` sends structured mode (`application/cloudevents+json`) with a 10-second timeout and a breaker per subscription.
- **Retries.** The handler throws while the delivery is pending. The outbox backoff is capped at 60 s, and `attempts` covers 24 hours.

**Rationale:** The 24-hour rule is visible to users, and structured mode is the standard's recommendation.

## R8. Reading documents

**Decision:**

- **Parsing.** `SdkDocumentReader` parses with the official SDK `@openworkflowspec/sdk` 1.0.3-alpha8, pinned exactly because `latest` points to 0.0.1. It validates dsl 1.0.0–1.0.3 against the standard's schema, compiled with Ajv `allErrors` (`DslSchema`), and maps the result to a ParsedDocument: a plain tree in the standard's shape, with no SDK types.
- **Domain checks.** `Definition.build` reports, with JSON Pointers, everything the domain owns:
  - the subset;
  - names and scopes;
  - structural limits;
  - script `source`, which is outside the subset.
- **Other checks.** `ExpressionEvaluator.check` validates expression syntax. `DocumentReferences.check(facts)` validates the references, with the facts coming from `SecretQueries.namesOwnedBy` and `WorkflowQueries.publishedTargets`.
- **Durations.** `Duration` (`language`) takes the standard's three forms and turns them into a deadline with the built-in `Temporal`, relative to the start time it is given. A fraction in years, months, weeks or days (`P1.5Y`) is refused at publish, because the standard does not define it.

**Rationale:**

- Validation before a run is the thesis contribution, and Synapse has none.
- A domain factory that returns every problem satisfies FR-002 and the Always-Valid post.

## R9. Expressions

**Decision:**

- **Engine.** jq-wasm (jq 1.8.2) in a Piscina pool (`JqPool`). The worker script and the prelude live in `expressions/`.
- **Templates.** A template is evaluated recursively: a `${ }` leaf is an expression.
- **Bare expressions.** Fields typed as expressions are evaluated without `${ }` (CTK).
- **Arguments.** Passed with `--argjson`. `$secrets` is available only in `input.from`.
- **Expected type `duration`.** The result must be an ISO 8601 string or an inline duration; `Duration` converts it.
- **Pattern matches** run as jq `test()`, written by the adapter.
- **Timeout:** 1 s, after which the worker is terminated.

**Rejected:** `node-jq`, `jq-web`, `jq-ts`.

## R10. Schemas

**Decision:** Ajv 8 with `ajv-formats` (`JsonSchemaCompilers`, one per draft). A schema's own `$schema` decides; the default is 2020-12. It checks input, output and export schemas at workflow and task level.

## R11. Service calls

**Decision:**

- **Scope.** `HttpServiceCaller` (in `endpoints/`) performs `call: http`:
  - URI templates, `query`;
  - the output modes `content`, `response` and `raw`;
  - `redirect`;
  - basic, bearer and oauth2/oidc client-credentials authentication, including credentials taken from secrets.
- **Authorization descriptor.** It returns the `$authorization` descriptor, masked.
- **`call: openapi`.** It fetches the document through `EndpointDispatcher` and dereferences it with `@apidevtools/json-schema-ref-parser` (external resolution off), without caching or retries. It then resolves the `operationId`.
- **Limits.** The `service-calls` preset caps the deadline at 30 s and adds a bulkhead.

## R12. Scripts and shell commands (go-judge)

**Decision:**

- **Running.** `GoJudgeProcessRunner` (in `sandbox/`) maps a `ProcessRun` to one `POST /run` command:
  - the interpreter (`/usr/local/bin/node`, `/usr/bin/python3` or `/bin/sh -c`), then the file and the arguments;
  - `env`: only the task's environment;
  - stdin, plus stdout and stderr capped at 1 MiB;
  - `clockLimit` and `cpuLimit` from the deadline;
  - `memoryLimit` 256 MiB, `procLimit` 50;
  - `copyIn` with the code.
- **Results.** `Accepted` or `Nonzero Exit Status` → `ProcessExited` (stdout and stderr as strings). `Time Limit Exceeded` → `ProcessTimedOut`. Anything else → `SandboxFailed`.
- **`await: false`.** The task completes with its transformed input and raises `ProcessDetached`. The process then runs from the outbox, and its result is ignored.
- **Deployment.** go-judge runs privileged with cgroup v2 and the network off. It uses a custom image, pinned by digest, with Node.js and Python 3 in its rootfs. It is reached through `SandboxPool`, which is separate from `EndpointDispatcher`.

**Rationale:**

- The user's decision.
- `run` is required by the standard.
- go-judge's isolation meets constitution VII.
- Synapse runs scripts on its runner, unisolated.

**Rejected:**

- `node:vm` / `isolated-vm`: in-process, JavaScript only.
- Containers: that is the later `run: container`.

## R13. Secrets

**Decision:**

- **Storage.** `Secret.value` is a `SecretValue`. Only the repository mapper reads it, with `reveal()`, and encrypts it with AES-256-GCM (`node:crypto`, `SECRETS_KEY`).
- **Use.** `SecretQueries.valuesFor(owner, definition.secretNames)` builds `SecretValues`. Every round and every delivery decrypts only the declared names.
- **Missing secrets.** A missing name faults the task with an authorization error in `beginRound`, before its work is issued.
- **Masking.** Values are masked in instance and task records, fault errors, `Delivery.lastError`, and the texts that handlers throw. Adapters log work ids only.

**Rationale:**

- Encryption at rest is a persistence concern.
- Missing secrets and masking are domain rules, which the DDD critic found unowned.

## R14. Idempotency (`@nestjs/idempotency` 0.0.3)

**Decision:**

- `@Idempotent()` on starting an instance (FR-009) and `@Idempotent({ scope: false })` on webhook calls (FR-024). Nothing else; non-HTTP starts are idempotent by derived ids.
- A Drizzle store from the docs recipe, tested with `idempotencyStoreContract`.

## R15. Resilience (`@nestjs/resilience` 0.0.3)

**Decision:** Presets declared in `frameworks/di/resilience.module`:

| Preset                | Timeout                        | Bulkhead (rejects when full) | Retries |
| --------------------- | ------------------------------ | ---------------------------- | ------- |
| `service-calls`       | deadline, ≤ 30 s               | yes                          | none    |
| `subscriber-delivery` | 10 s, breaker per subscription | —                            | none    |
| `processes`           | deadline + 5 s                 | yes                          | none    |
| `jq`                  | 1 s                            | —                            | —       |

**Rationale:**

- Retries belong to the DSL author or the outbox.
- Breakers on DSL calls would invent results.

## R16. Interpretation of the standard and the CTK

| Point                                                 | Decision                                                                                                                       |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `$secrets`                                            | Only in `input.from`                                                                                                           |
| `$authorization`                                      | From the call's ServiceResult, for `output.as` and `export.as`                                                                 |
| `$runtime`                                            | `{ name, version }` of the platform                                                                                            |
| `$task.definition`, `$workflow.definition`            | The parsed JSON kept in the Definition                                                                                         |
| `set`                                                 | Replaces the data                                                                                                              |
| `emit`                                                | The runtime generates `id`, `time` and `specversion`; the output is the event                                                  |
| Task reference                                        | `/do/<index>/<name>[…]` (CTK)                                                                                                  |
| Communication error                                   | Type `…/spec/1.0.0/errors/communication`; the HTTP status, or 500; a title                                                     |
| Missing workflow input                                | `{}`                                                                                                                           |
| `status-changed` events                               | Not produced                                                                                                                   |
| Lifecycle `output`                                    | Left out above 64 KiB (the LifecycleEvent VO)                                                                                  |
| Lifecycle `source`                                    | `/workflows/{namespace}/{name}/instances/{id}`                                                                                 |
| `run.workflow.version`                                | `latest` by default, resolved when the task starts                                                                             |
| Fork                                                  | Output is an array, or the winner's output with `compete`; exports apply in declaration order                                  |
| `after`                                               | Next start only after **completion**                                                                                           |
| Script language                                       | `js` / `javascript` → Node.js; `python` → Python 3; `source` is outside the subset                                             |
| Process output                                        | stdout and stderr as strings; a non-zero exit is not an error; time-out → timeout error; other sandbox failure → runtime error |
| `await: false`                                        | Transformed input; the process is detached                                                                                     |
| Fractional years, months, weeks or days in a duration | Refused at publish; listed in the conformance statement                                                                        |

**Recorded contradiction.** In CTK `try.feature`, "Try Handle Caught Error" filters on `…/dsl/errors/types/communication`, but the specification requires `…/spec/1.0.0/errors/communication`. We follow the specification, and the scenario is recorded in FR-032 and SC-001.

## R17. Errors at non-HTTP inbound adapters

**Decision:**

- One `ErrorClassifier` at the root of `interface-adapters` tells transient errors (stale writes, full bulkheads, PostgreSQL SQLSTATE classes 08, 40, 53 and 57, socket errors, through `cause`) from settled ones (not found, stale start, invalid control). Outbox handlers acknowledge settled errors, rethrow transient ones and turn the rest into `NonRetryableMessageError`; the module-level `retryIf` is not used, so the mail handler keeps its retries. Engine steps retry only transient errors. The table is architecture.md §8.
- Duplicate creations stop at a guard because their ids are derived.
- Use cases never catch.

## R18. Conformance harness

**Decision:**

- `quickpickle` 1.11.2 (dev), with a trial in S0. The fallback is `@cucumber/cucumber` 13.3.
- undici `MockAgent` for the public hosts.
- The database is cleaned per scenario.

## R19. Layout and constitution

**Decision:**

- The layout is in architecture.md §1.
- Amendment 3.1.0 (MINOR) goes in its own PR in S0. It records:
  - framework-aware use cases;
  - context sub-folders;
  - `ports.ts` / `queries.ts`;
  - zod schemas;
  - boundaries checked in review;
  - engine rounds, which are not one transaction at the controller.

  It also adds the R21 modules to the stack.

## R20. Removed as not necessary for the core

| Removed                                                          | Reason                                                                         |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| The default catalog (formerly US10)                              | Optional in the standard; `use.functions` and `run: workflow` cover reuse      |
| Housekeeping, `@nestjs/schedule`, `@nestjs/locks`                | Retention work, a later feature                                                |
| `@nestjs/cache-manager`, OpenAPI document retries                | Not needed for correctness                                                     |
| Breakers on DSL calls                                            | They change results according to process memory                                |
| `yaml`, `ipaddr.js`, line and column                             | JSON Pointers satisfy FR-002; `node:net` `BlockList` covers address ranges     |
| Cipher ports; the `security/`, `maintenance/` and `dsl/` folders | They were grouped by purpose, not by agency                                    |
| `LifecycleEventProduced` and `EventEmitted` outbox topics        | Events are added in the round's transaction (R3)                               |
| `AfterChainStarted`, `InstanceEnded` for every instance          | `NextStartDue(0)`; polymorphic origins                                         |
| Per-aggregate conflict errors, `ReferenceQueries`                | `StaleWriteError`; `SecretQueries` and `WorkflowQueries` already exist         |
| Separate `services/` and `subscribers/` folders                  | One agency: endpoints chosen by users                                          |
| Creation-time address checks; the Helm claim                     | Checks happen at connect time (US6 #8); Helm comes with the deployment feature |
| Idempotency on every command                                     | Required only for starts and webhooks                                          |

## R21. Dependencies

Each package exists because nothing built in covers it:

| Package                                      | Purpose                                                                                                          | Why nothing built in suffices                                                                                                                                                           |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@nestjs/workflows` 0.0.4                    | Runs, parks, signals, schedules, leases                                                                          | User requirement; first-party                                                                                                                                                           |
| `@nestjs/outbox` 0.1.3                       | Reactions after commit, deliveries                                                                               | User requirement; first-party                                                                                                                                                           |
| `@nestjs/idempotency` 0.0.3                  | Idempotent starts and webhook calls                                                                              | User requirement; first-party                                                                                                                                                           |
| `@nestjs/resilience` 0.0.3                   | Timeouts, bulkheads, delivery breakers                                                                           | User requirement; first-party                                                                                                                                                           |
| `@openworkflowspec/sdk` 1.0.3-alpha8         | YAML and JSON parsing, the official 1.0.3 schema (`workflowSchema`)                                              | The standard's own SDK; no vendored schema. `latest` is a 0.0.1 placeholder, so the alpha is pinned                                                                                     |
| `ajv` 8.20.0, `ajv-formats` 3.0.1            | The full document report (`allErrors`) and the data schemas of FR-010                                            | zod's `fromJSONSchema` refuses `unevaluatedProperties`, `if`/`then`, `dependentSchemas` and external `$ref`, which the DSL schema and user schemas use. The SDK depends on both already |
| `jq-wasm` 3.0.0-jq-1.8.2                     | jq, which the standard mandates                                                                                  | Node has no jq                                                                                                                                                                          |
| `piscina` 5.3.2                              | Worker pool; aborting a task terminates its worker                                                               | A runaway expression cannot be interrupted on the main thread. No dependencies                                                                                                          |
| `@apidevtools/json-schema-ref-parser` 16.0.5 | Dereferences the external OpenAPI document of `call: openapi`                                                    | `@nestjs/swagger` generates our own document and reads none. `swagger-parser` only adds validation of the document, which the call does not need                                        |
| `undici` 8.12.3                              | The SSRF-checking dispatcher (`connect` lookup on every connection and redirect), the go-judge pool, `MockAgent` | Node 26 runs `fetch` on an internal undici but exposes neither `Agent` nor `MockAgent`                                                                                                  |
| `quickpickle` 1.11.2 (dev)                   | Runs the CTK Gherkin features in Vitest                                                                          | —                                                                                                                                                                                       |
| `testcontainers` 12.2.1 (dev)                | go-judge in integration tests                                                                                    | Already a dependency of `@testcontainers/postgresql`                                                                                                                                    |

**Removed:**

- `temporal-polyfill`: Node 26 has `Temporal`.
- `cloudevents`: zod schemas at the boundary cover the HTTP binding, as for every other body. The SDK pulled `uuid` 8, which has an advisory, plus browser polyfills and a second `ajv-formats`.
- `@apidevtools/swagger-parser`: see above.

**Advisories.** NestJS 12.3.2 (`multer`) and zod 4.6.7. Overrides pin `@cucumber/messages>uuid` to 11.1.1 and `@esbuild-kit/core-utils>esbuild` to 0.25.12. `pnpm audit` reports no known vulnerabilities.

**Runtime.** Node.js 26.13.0 LTS. go-judge 1.13.3 with Node.js 26 and Python 3, from a custom image pinned by digest.

## R22. Critic verdicts

**Round 1** (2026-10-28): DDD and Clean Architecture both gave _approve with fixes_. The fixes are applied, and the design was then simplified (R20).

**Round 2** (2026-10-28, after go-judge): both gave _approve with fixes_ again, with no redesign. Applied:

- **Duplicate starts.** Derived ids with guards; a refused child starts faulted.
- **Catch-up.** It runs after commit.
- **Lease.** The bound is stated, with bulkheads that reject, and renewal and signal retention are proven in S0.
- **Missing secrets and masking.** Both have domain owners.
- **Fan-out.** One rule for all candidates, deliveries included.
- **Topics.** They are the domain event names.
- **Adapters.** `endpoints/` replaces the two HTTP-out folders.
- **Definitions.** `Definition.build` returns every problem; subset checks moved into the domain.
- **Events and schedules:**
  - produced Events are added in the round's transaction;
  - `abandon()` closes listens and children;
  - `deactivate` / `activate`;
  - `NextStartDue(0)`;
  - `after` only on completion;
  - `FOR SHARE` on stale-start checks.
- **Polymorphism.** ProcessResult is polymorphic; `ProcessDetached` handles `await: false`; `LeafProgress` runs processes and `SubWorkflowProgress` runs sub-workflows; origins are polymorphic.
- **Expressions.** `PatternMatch` work; `EventFilter` as the single owner; `$authorization` and `$runtime`; expected type `duration`; a stored DataLimits snapshot; jitter passed as a value.
- **Webhook headers.** `Webhook.receive` drops them.
- **Errors.** `StaleWriteError`.
- **Contract.** Fixes listed in the contract itself.
