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

1. `BeginRound` (`@Transactional`): begin the round, save, and add the produced Events; the save is skipped when nothing changed.
2. Compute, with no transaction.
3. `RecordRound` (`@Transactional`): reload, record, save, and add the produced Events.

`AdvanceInstance` composes the two and returns the instance's progress. Secrets join with US8.

`InstanceRuns.start` and `wake` run inside the caller's transaction. S0 tests the nestjs-cls `tx`, the lease renewal, and that a signal sent during a step survives.

**Rationale:**

- A 30-second call must not hold a pooled connection.
- Producing Events in the same transaction removes an outbox hop and keeps lifecycle order. This was the DDD critic's point 6: the Event rows live in the same database.

## R4. Domain events and the outbox (`@nestjs/outbox` 0.1.3)

**Decision:** Repositories write an aggregate's `#events` to the outbox in the save transaction. The topic is the domain event's name and the payload is its props. Each event below exists because its reaction either leaves the database or belongs to an aggregate that advances separately, under its own concurrency:

| Event                                               | Reaction                                       | Key         | Why it is outside the transaction                                                                                                                                                                     |
| --------------------------------------------------- | ---------------------------------------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| EventAccepted                                       | RouteEvent                                     | —           | unbounded fan-out; webhook answers must not wait                                                                                                                                                      |
| (EventOffers) correlation, trigger, delivery offers | OfferEvent, OfferTrigger, OfferDelivery        | candidate   | one message per candidate, so one slow filter delays no other                                                                                                                                         |
| CorrelationStarted                                  | CatchUpCorrelation                             | correlation | catch-up must see events committed after the start                                                                                                                                                    |
| ListenStarted, ListenEnded                          | StartCorrelation, EndCorrelation               | instance    | correlations advance under their own concurrency, per event                                                                                                                                           |
| EventConsumed, CorrelationCompleted                 | ConsumeListenEvent, CompleteListen             | instance    | the instance advances in its own engine run                                                                                                                                                           |
| TriggerSatisfied                                    | StartTriggeredInstance                         | workflow    | a new instance and its run                                                                                                                                                                            |
| CancelRequested (US9)                               | CancelInstance                                 | child       | a separate instance in a separate run; sub-workflows themselves are engine steps (architecture §4)                                                                                                    |
| ProcessDetached                                     | RunDetachedProcess                             | instance    | a sandbox process outside the database; the payload holds only ids                                                                                                                                    |
| NextStartDue (`delay`)                              | StartScheduledInstance                         | —           | delayed by definition; it carries no key, because a delayed message heads its key's queue and would hold every later message of the workflow (a new cron, switching the workflow off) until it is due |
| RecurringScheduleSet, RecurringScheduleCleared      | RegisterRecurringStarts, RemoveRecurringStarts | workflow    | `WorkflowSchedules.upsert` takes no transaction                                                                                                                                                       |
| DeliveryScheduled                                   | DeliverEvent                                   | —           | it leaves the system                                                                                                                                                                                  |

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

- **Port.** `DefinitionReader.read(source)` returns the Definition or throws a `DefinitionRejectedError` kind.
- **Client (frameworks).** `SdkOpenWorkflowClient.parse(text)` calls `Classes.Workflow.deserialize` from `@openworkflowspec/sdk` 1.0.3-alpha8. The version is pinned, because `latest` is a 0.0.1 placeholder.
  - The SDK parses YAML or JSON. It checks the 1.0.3 schema, the DSL range (`>=1.0.0-0 <=1.0.3`) and duplicate task names, and stops at the first error. Its range admits pre-releases; the definition mapper takes only the released versions (`DslVersion`, FR-001), since a pre-release has its own schema.
  - The client returns simple data: `DslParsed` with the document as `Dsl.Workflow`, or `DslFailure` with `pointer` and `failure`.
  - A failure comes from one of three sources: the deepest Ajv error of a `SchemaValidationError` that does not only select a `oneOf` branch (`const`, `not`, `oneOf`, `anyOf`), the `path` and cause of a `DslValidationError`, or a YAML error at the root pointer.
  - The document comes back through `asPlainObject()`, so no SDK object crosses the boundary.
  - The SDK's TypeScript types cannot be narrowed. Every type has `[k: string]: unknown`, task keys are optional, `language`, `await` and `return` are missing, and hydration produces one generic `Task` class. So `documents/interfaces.ts` declares the validated shape (`Dsl.*`) with the standard's names, as strings. The client narrows the SDK result to it once.
- **Adapter.** `OpenWorkflowDefinitionReader` turns a failure into an `InvalidDocumentError` and maps a document with `DefinitionMapper`.
  - The mappers in `documents/mappers/` are pure static functions, `toDomain(node, at, components)`, one per value object, like the persistence mappers. They hold no state and collect nothing.
  - A name from `use` is translated into the declared value through the domain's `ReusableComponents` (the `Referenceable*` mappers). A function call keeps the function's name, and `Definition` confirms every call against `use.functions`; recursion between functions is a run-time matter.
  - A value that a domain enum cannot represent is refused (`Object.values(Enum).find`).
- **Domain.** It keeps the invariants and lists its own expressions (data-model §6).
- **Order.** The checks run in this order, and the first problem refuses the document:
  1. the schema;
  2. the mapping, in document order;
  3. expression syntax.
- **Durations.**
  - An inline duration or an ISO 8601 literal becomes a `FixedDuration` on the built-in `Temporal`.
  - A runtime expression becomes an `ExpressionDuration`.
  - The schema's pattern accepts fractions that Temporal cannot compute (`P1.5D`, `PT1.5H30M`); they are outside the subset.
  - A runtime expression as a retry delay, jitter or limit is outside the subset.
- **Storage.** A version stores its source. A run reads the Definition again through `DefinitionReader`, once per version id (US2).

**Rationale:**

- **Compiler-like checks.** Publishing checks what a compiler would, as AWS Step Functions validates a definition's syntax: the schema, the subset, the references inside the document, and the syntax of expressions. Other workflows, secrets and variable values are resolved at run time, as in AWS Step Functions (`StateMachineDoesNotExist`) and Camunda (incidents).
- **Khorikov.** Input validation happens at the boundary with the domain's knowledge, and invariants stay in the domain ("Always-Valid Domain Model", "Validation and DDD").
- **Martin.** Adapters convert, frameworks are glue, and simple data crosses the boundaries.

**Rejected:**

- **A report of every problem.** The standard requires none, and it would need Ajv with `allErrors`, js-yaml, and a domain that collects problems.
- **Checking at publish the workflows a document runs, and the secrets it uses.** Their state changes after publishing, and no competitor checks them at that point.
- **Mapping from the SDK's own types.** They cannot be narrowed.

## R9. Expressions

**Decision:**

- **Language.** jq, the standard's mandated language ("All runtimes **must** support the default runtime expression language, which is jq"), through jq-wasm (jq 1.8.2).
- **Publishing (US1).** `JqExpressionEvaluator.check` asks `JqClient.compile(program)` for every expression.
  - `InProcessJqClient` (`frameworks/jq`) compiles `empty | (program)`, with every `$name` the program mentions bound. Only syntax errors remain, and the program never runs.
  - The first failure refuses the document.
- **Evaluation (US2).**
  - `PiscinaJqClient` replaces the in-process client behind the same `JqClient`, adding `run`.
  - jq-wasm computes synchronously and has no time limit. Measured on Node 26, `reduce range(30000000) as $i (0; . + 1)` blocked the event loop for 9 s. Only terminating a worker thread stops it, and jq-wasm's README recommends Piscina for that mode. The `jq` resilience preset gives 1 s.
  - The evaluator adds the sandbox prelude:
    - `env`, `$ENV`, `input`, `inputs`, `input_filename`, `halt`, `halt_error`, `localtime` and `strflocaltime` become errors;
    - `debug` and `stderr` become identities.
    - Its reasons: the environment never depends on how a jq build emulates one; results do not depend on a worker's time zone; data never reaches stderr; and `halt` never yields silent emptiness.
  - Each Evaluation carries the runtime arguments that the standard's table allows at its place, chosen by the domain (data-model §7); the domain also splits templates into their expressions.
- **Templates.** A `${ }` leaf of a template is an expression. Fields typed as expressions are evaluated without `${ }` (CTK).
- **Pattern matches** run as jq `test()`, written by the adapter (US7).

**Rejected:**

- `node-jq` (a jq process per evaluation);
- `jq-web` and JavaScript reimplementations such as `jq-ts`, whose semantics differ;
- for evaluation, jq-wasm's asynchronous convenience API, which is asynchronous only while loading.

## R10. Schemas

**Decision:** Ajv 8 with `ajv-formats` (`JsonSchemaCompilers`, one per draft). A schema's own `$schema` decides; the default is 2020-12. It checks input, output and export schemas at workflow and task level.

## R11. Service calls

**Decision:**

- **Scope.** `HttpServiceCaller` (in `endpoints/`) performs `call: http`: URI templates, `query`, and basic, bearer and oauth2/oidc client-credentials authentication (credentials from secrets join with US8).
- **Results.** It returns what happened, as data: `ServiceResponded(status, headers, content, request, authorization)`, `ServiceTimedOut`, `AuthenticationFailed` (a token request refused) or `CommunicationFailed` (transport). The domain (`CallOutput`) decides the output format (`content`, `response`, `raw`), `redirect` and which statuses are errors. The adapter encodes the content as base64 when the evaluated arguments ask for `raw`.
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
- **`await: false`.** The task completes with its transformed input and raises `ProcessDetached` (ids only). `RunDetachedProcess` runs the process from the outbox, and its result is ignored.
- **Deployment.** go-judge runs privileged with cgroup v2 and the network off. It uses a custom image, pinned by digest, with Node.js and Python 3 in its rootfs. It is reached through `SandboxPool`, which is separate from `EndpointDispatcher`. It sits on its own Compose network (`sandbox`), which only the API shares, and requires a bearer token (`ES_AUTH_TOKEN` = `SANDBOX_TOKEN`), so a sandbox escape does not reach PostgreSQL and no other caller can run code.

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

| Preset                      | Timeout                                                                                                                            | Bulkhead (rejects when full) | Retries |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- | ------- |
| `service-calls`             | deadline, ≤ 30 s                                                                                                                   | yes                          | none    |
| `subscriber-delivery` (US6) | 10 s; no preset: a preset's breaker is shared under its name, so T096 creates one per subscription with `ResilienceService.create` | —                            | none    |
| `processes`                 | deadline + 5 s                                                                                                                     | yes                          | none    |
| `jq` (US2)                  | 1 s, applied by `PiscinaJqClient` in frameworks, because terminating the worker is pool mechanics                                  | —                            | —       |

The `jq` preset is applied by `PiscinaJqClient` in `frameworks/jq`, and the others by the adapters that call out.

**Rationale:**

- Retries belong to the DSL author or the outbox.
- Breakers on DSL calls would invent results.

## R16. Interpretation of the standard and the CTK

| Point                                                                                | Decision                                                                                                                                                                                                                                                     |
| ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `$secrets`                                                                           | Only in `input.from`, enforced at run time (US8). The standard's argument table marks it everywhere; its description limits it to `input.from`, and the platform follows the description (recorded contradiction)                                            |
| `$authorization`                                                                     | From the call's ServiceResult, for `output.as` and `export.as`; the availability of every argument follows the standard's table at run time (US2)                                                                                                            |
| `$runtime`                                                                           | `{ name, version }` of the platform                                                                                                                                                                                                                          |
| `$task.definition`, `$workflow.definition`                                           | The parsed JSON kept in the Definition                                                                                                                                                                                                                       |
| `set`                                                                                | Replaces the data                                                                                                                                                                                                                                            |
| `emit`                                                                               | The runtime generates `id`, `time` and `specversion`; the output is the event                                                                                                                                                                                |
| Task reference                                                                       | `/do/<index>/<name>[…]` (CTK)                                                                                                                                                                                                                                |
| Communication error                                                                  | Type `…/spec/1.0.0/errors/communication`; the HTTP status, or 500; a title                                                                                                                                                                                   |
| Missing workflow input                                                               | `{}`                                                                                                                                                                                                                                                         |
| `status-changed` events                                                              | Not produced                                                                                                                                                                                                                                                 |
| Lifecycle `output`                                                                   | Left out above 64 KiB (the LifecycleEvent VO)                                                                                                                                                                                                                |
| Lifecycle `source`                                                                   | `/workflows/{namespace}/{name}/instances/{id}`                                                                                                                                                                                                               |
| `run.workflow.version`                                                               | Required by the 1.0.3 schema; `latest` is resolved when the task starts; a missing target faults the task with a configuration error (US2)                                                                                                                   |
| Fork                                                                                 | Output is an array, or the winner's output with `compete`; each branch's export applies when the branch ends, like any task's                                                                                                                                |
| `after`                                                                              | Next start only after **completion**                                                                                                                                                                                                                         |
| Script language                                                                      | `js` → Node.js; `python` → Python 3; `source` is outside the subset                                                                                                                                                                                          |
| Process output                                                                       | stdout and stderr as strings; a non-zero exit is not an error; time-out → timeout error; other sandbox failure → runtime error                                                                                                                               |
| `await: false`                                                                       | Transformed input; the process is detached                                                                                                                                                                                                                   |
| Backoff                                                                              | `constant`: the delay; `linear`: delay × attempt; `exponential`: delay × 2^(attempt − 1); jitter adds a share of `[from, to]`                                                                                                                                |
| `catch.errors.with.details`                                                          | Matches the error's `detail` (the schema names the filter property `details`)                                                                                                                                                                                |
| Retry limits                                                                         | `limit.attempt.count` bounds the retries and `limit.duration` the whole retry window; `limit.attempt.duration` is refused (the text bounds all attempts, the schema each one). Spent retries run the catch `do`, or fault the `try` task with the last error |
| A fraction in a duration other than in the smallest of its hours, minutes or seconds | Refused at publish (Temporal cannot compute it); listed in the conformance statement                                                                                                                                                                         |
| Initial `$context`                                                                   | `{}`                                                                                                                                                                                                                                                         |
| A faulted branch of a competing `fork`                                               | The first branch to end decides; a fault faults the fork (the standard names only the winner)                                                                                                                                                                |
| `exit` inside `for`                                                                  | Ends the current iteration; the loop goes on (the standard: "halts the current branch")                                                                                                                                                                      |
| `for.while`                                                                          | Checked before every iteration, the first included                                                                                                                                                                                                           |
| A `for` without `while` whose body is empty                                          | Completes with its input at once, whatever the number of items                                                                                                                                                                                               |
| Lifecycle `name` / `workflow`                                                        | The instance's qualified name `{name}-{id}.{namespace}`, like the standard's example `orderPetWorkflow-ix7iryakiem8j.samples`                                                                                                                                |
| Lifecycle times                                                                      | `task.created` and `task.started` carry the task instance's start (its `$task.startedAt`), `workflow.started` the instance's start (`$workflow.startedAt`); both are produced only once the `if` passed (a skipped task produces no event, FR-015)           |
| `task.retried`, `task.cancelled`                                                     | `retried` for the `try` task when a retry starts; `cancelled` only for a task that was announced, so a task abandoned before its `if` passed produces nothing                                                                                                |
| A skipped branch of a competing `fork`                                               | It does not compete; when every branch is skipped, the fork's output is its input (the standard: "considered skipped if not run")                                                                                                                            |
| A faulted sub-workflow                                                               | The `run` task faults with its error, with `instance` set to the `run` task ("Runtimes MUST set the property when raising or escalating the error")                                                                                                          |
| `for.each`, `for.at`, `catch.as`                                                     | Refused at publish when they name a runtime argument (`input`, `context`…), which they would otherwise hide                                                                                                                                                  |
| Emitted events                                                                       | Must be CloudEvents 1.0.2 (non-empty id, source and type; a URI-reference source; RFC 3339 time; spec version `1.0`; extension values string, boolean or integer), or the task faults with a runtime error; they are recorded with the task's completion     |
| The same `source` and `id` produced twice                                            | Stored once (`ON CONFLICT DO NOTHING`); CloudEvents lets consumers treat them as duplicates                                                                                                                                                                  |
| The 64 KiB lifecycle limit                                                           | Measured on the event's JSON; the structured HTTP body adds only the envelope headers                                                                                                                                                                        |

**Recorded contradiction.** In CTK `try.feature`, "Try Handle Caught Error" filters on `…/dsl/errors/types/communication`, but the specification requires `…/spec/1.0.0/errors/communication`. We follow the specification, and the scenario is recorded in FR-032 and SC-001.

## R17. Errors at non-HTTP inbound adapters

**Decision:**

- One `ErrorClassifier` (`interface-adapters/error-classifier.ts`) tells transient errors (stale writes, socket errors, and the PostgreSQL failures that `TransientFailures` recognizes) from settled ones (not found, stale start, invalid control). `TransientFailures` is declared at the `interface-adapters/` root and implemented in `persistence/` (SQLSTATE classes 08, 40, 53 and 57 and pool timeouts, through `cause`), so SQLSTATE stays in persistence while the classifier catches a failure wherever it surfaces (a pool connection, `BEGIN`/`COMMIT`, the engine's insert). Outbox handlers acknowledge settled errors, rethrow transient ones and turn the rest into `NonRetryableMessageError`; the module-level `retryIf` is not used, so the mail handler keeps its retries. Engine steps retry only transient errors. A full bulkhead is not an error: the callers return no result for the rejected item (architecture §3). The table is architecture §8; it arrives with its consumers (T046, T047).
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

| Removed                                                                                  | Reason                                                                         |
| ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| The default catalog (formerly US10)                                                      | Optional in the standard; `use.functions` and `run: workflow` cover reuse      |
| Housekeeping, `@nestjs/schedule`, `@nestjs/locks`                                        | Retention work, a later feature                                                |
| `@nestjs/cache-manager`, OpenAPI document retries                                        | Not needed for correctness                                                     |
| Breakers on DSL calls                                                                    | They change results according to process memory                                |
| `yaml`, `ipaddr.js`, line and column                                                     | JSON Pointers satisfy FR-002; `node:net` `BlockList` covers address ranges     |
| A report of every problem in a document                                                  | The standard requires none; the first problem refuses the document (R8)        |
| Publish-time checks of other workflows, of secret ownership and of variable availability | Resolved at run time, as in AWS Step Functions and Camunda (R8)                |
| Cipher ports; the `security/`, `maintenance/` and `dsl/` folders                         | They were grouped by purpose, not by agency                                    |
| `LifecycleEventProduced` and `EventEmitted` outbox topics                                | Events are added in the round's transaction (R3)                               |
| `AfterChainStarted`, `InstanceEnded` for every instance                                  | `NextStartDue(0)`; polymorphic origins                                         |
| Per-aggregate conflict errors, `ReferenceQueries`                                        | `StaleWriteError`; `SecretQueries` and `WorkflowQueries` already exist         |
| Separate `services/` and `subscribers/` folders                                          | One agency: endpoints chosen by users                                          |
| Creation-time address checks; the Helm claim                                             | Checks happen at connect time (US6 #8); Helm comes with the deployment feature |
| Idempotency on every command                                                             | Required only for starts and webhooks                                          |

## R21. Dependencies

Each package exists because nothing built in covers it:

| Package                                      | Purpose                                                                                                          | Why nothing built in suffices                                                                                                                                                           |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@nestjs/workflows` 0.0.4                    | Runs, parks, signals, schedules, leases                                                                          | User requirement; first-party                                                                                                                                                           |
| `@nestjs/outbox` 0.1.3                       | Reactions after commit, deliveries                                                                               | User requirement; first-party                                                                                                                                                           |
| `@nestjs/idempotency` 0.0.3                  | Idempotent starts and webhook calls                                                                              | User requirement; first-party                                                                                                                                                           |
| `@nestjs/resilience` 0.0.3                   | Timeouts, bulkheads, delivery breakers                                                                           | User requirement; first-party                                                                                                                                                           |
| `@openworkflowspec/sdk` 1.0.3-alpha8         | Parsing documents and checking the 1.0.3 schema, the DSL range and duplicate task names                          | The standard's own SDK; no vendored schema. `latest` is a 0.0.1 placeholder, so the alpha is pinned                                                                                     |
| `ajv` 8.20.0, `ajv-formats` 3.0.1            | The input, output and export schemas of FR-010                                                                   | zod's `fromJSONSchema` refuses `unevaluatedProperties`, `if`/`then`, `dependentSchemas` and external `$ref`, which the DSL schema and user schemas use. The SDK depends on both already |
| `jq-wasm` 3.0.0-jq-1.8.2                     | jq, which the standard mandates: syntax checks in US1, evaluations from US2                                      | Node has no jq                                                                                                                                                                          |
| `piscina` 5.3.2 (US2)                        | Worker pool for evaluations; aborting a task terminates its worker                                               | A runaway expression cannot be interrupted on the main thread. No dependencies. Installed with US2, because US1 only compiles                                                           |
| `@apidevtools/json-schema-ref-parser` 16.0.5 | Dereferences the external OpenAPI document of `call: openapi`                                                    | `@nestjs/swagger` generates our own document and reads none. `swagger-parser` only adds validation of the document, which the call does not need                                        |
| `undici` 8.12.3                              | The SSRF-checking dispatcher (`connect` lookup on every connection and redirect), the go-judge pool, `MockAgent` | Node 26 runs `fetch` on an internal undici but exposes neither `Agent` nor `MockAgent`                                                                                                  |
| `quickpickle` 1.11.2 (dev)                   | Runs the CTK Gherkin features in Vitest                                                                          | —                                                                                                                                                                                       |
| `testcontainers` 12.2.1 (dev)                | go-judge in integration tests                                                                                    | Already a dependency of `@testcontainers/postgresql`                                                                                                                                    |

**Removed:**

- `temporal-polyfill`: Node 26 has `Temporal`.
- `cloudevents`: zod schemas at the boundary cover the HTTP binding, as for every other body. The SDK pulled `uuid` 8, which has an advisory, plus browser polyfills and a second `ajv-formats`.
- `@apidevtools/swagger-parser`: see above.
- `js-yaml`: the SDK parses documents itself.

**Advisories.** NestJS 12.3.2 (`multer`) and zod 4.6.7. Overrides pin `@cucumber/messages>uuid` to 11.1.1 and `@esbuild-kit/core-utils>esbuild` to 0.25.12. `pnpm audit` reports no known vulnerabilities.

**Runtime.** Node.js 26.13.0 LTS. go-judge 1.13.3 with Node.js 26 and Python 3, from a custom image pinned by digest.

## R22. Critic verdicts in force

**Rounds 1–3** (2026-10-28 and 2026-10-29): DDD and Clean Architecture gave _approve with fixes_. Still in force from them:

- **Duplicate starts.** Derived ids with guards; a child whose input breaks its schema faults in its first round.
- **Catch-up.** It runs after commit.
- **Lease.** The bound is stated, with bulkheads that reject; renewal and signal retention are proven in S0.
- **Missing secrets and masking.** Both have domain owners.
- **Fan-out.** One rule for all candidates, deliveries included.
- **Topics.** They are the domain event names.
- **Adapters.** `endpoints/` replaces the two HTTP-out folders.
- **Events and schedules:**
  - produced Events are added in the round's transaction;
  - `abandon()` closes listens and children;
  - `deactivate` / `activate`;
  - `NextStartDue(0)`;
  - `after` fires only on completion;
  - stale-start checks read `FOR SHARE`.
- **Polymorphism.** `ProcessResult` and origins are polymorphic; `ProcessDetached` handles `await: false`.
- **Expressions.** `PatternMatch` work; `EventFilter` as the single owner; expected type `duration`; a stored DataLimits snapshot; jitter passed as a value.
- **US1 application.**
  - `Workflow.isCurrent`;
  - the 1 MiB text parser runs only on the two document routes;
  - policies are module providers;
  - not-found answers come from domain errors;
  - `PublishVersion` composes `CheckDocument`;
  - path parameters are zod schemas;
  - one `configureHttpApp`.
- **Not applied.**
  - Ids are generated in the aggregates, as constitution IV allows.
  - `found ?? Workflow.register(...)` stays.
  - Queries read committed rows outside the command's transaction.

**Round 4** (2026-10-29 and 2026-10-30, the US1 rework): both gave _approve with fixes_. Applied:

- Input validation at the boundary, invariants in the domain.
- Pure mappers with no state.
- SDK and jq clients in frameworks, with simple outcomes discriminated by `kind`.
- `Dsl.*` uses strings, and the mappers convert them to enums.
- Context-free value errors, which the mapper places in the document.
- Unique task names as a `TaskList` invariant.
- `Export` separate from `Output`.
- One owner for each closed set (`ErrorType` holds its URIs).
- Removal of the replaced code scheduled.

Moved to run time after comparing with AWS Step Functions and Camunda: other workflows, secrets, and variable availability.

**Not applied:** the standard's names `RetryPolicy` and `AuthenticationPolicy`. In this codebase "Policy" means an access policy, so the domain uses `RetryStrategy` and `Authentication`.

**Round 6** (2026-10-30, DDD and CA critics on the US2 design, before code): both gave _approve with fixes_. Applied:

- Sub-workflows run as steps of the parent's engine run (explicit flow), read from persisted state; the detached process stays on the outbox, because it leaves the database. Checked on 2026-10-31 against `@nestjs/workflows` 0.0.4: the run starts children with `ctx.startChild` and waits for them with `waitForAny`, and the engine signals the parent in the child's last transaction, so the child no longer resumes its parent and US2 sends no wake.
- `AdvanceInstance` composes `BeginRound` and `RecordRound`, both `@Transactional`; both add the produced Events; `progress(now)` replaces the `GetProgress` query.
- One execution, one TaskInstance; progress keeps only state and receives its Task.
- `StartSubWorkflow` saves one aggregate: the child, or the parent when the target is missing.
- `ServiceResponded` carries the status, headers and body, and the call task decides; `AuthenticationFailed` added.
- Errors are classified inside the engine steps; `FaultInstance` takes the instance id only.
- The origin decides about a rejected input; jitter derives from the work id; the rule owners table is split by owner.

**Not applied:** cancelling an abandoned child stays with US9 (until then it runs to its end and its result is ignored); a cache for reading the Definition waits for a measurement.

**Round 12** (2026-11-01, DDD, Clean Architecture and standard critics on item 2 of the re-review and on T036–T037, and on the intended T039–T048; the user: "коммить и продолжай"). All three gave _approve with fixes_. Applied:

- Item 2 of the re-review. The guards follow the concepts' rules: whole, non-negative counters (attempts, positions, `for` indexes, fork branches), a retry only after a failed attempt, a body stage only around an unfinished body, no output stage after a failed body. The kind progress no longer stores the task input: `BodyStage` hands it over in a `BodyScope`, so 13 copies left the jsonb; a `Sequence` step is the next position or the list's `Outcome`; the twenty per-class progress mappers became two dispatchers, and an unknown stage is refused by name. Two Round 8 points are reversed on purpose: `TaskEnding` has a private constructor (its three factories restore it, and a completed ending derives its directive from the body and the task's `then`, so the contradiction the re-review found cannot be stored), and the duplicated input copies went.
- The DDD critic: a task whose parent is not loaded is corrupt state, never the root (`InconsistentProgressError`); `ProcessDetached` carries the `ProcessRun` and `WorkflowDetached` the derived instance id and the request, because the ended task that holds them is not loaded; `startSubWorkflow` refuses a workflow or version other than the one the task names; the round methods refuse a Definition of another version; `TaskInstance` reads its phase, output and error from its progress and keeps only the cancellation; a sub-workflow's end is `subWorkflowEnded(outcome)`, no longer a disguised child task (the "child" vocabulary became "sub-workflow"); the lifecycle sequence and the produced Events moved into the internal `ProducedEvents`; `takeDomainEvents`; the event origin's ids and sequence are required until intake arrives.
- The standard critic: `CloudEvent` is the one owner of the CloudEvents 1.0.2 rules for `emit` and the lifecycle events; `task.cancelled` only for an announced task; the lifecycle times equal `$task.startedAt` and `$workflow.startedAt`; a skipped branch does not win a competing fork; a sub-workflow's error is located at the `run` task; loop and catch variables cannot hide a runtime argument (R16).
- The Clean Architecture critic: capacity is data (no result for a rejected item, `AdvanceInstance` reports deferred work, the run sleeps on `busy`); transient PostgreSQL failures have one recognizer (`TransientFailures`, R17), so `TransientStoreError` is not needed; the repository's `save` writes the domain events to the outbox, and their payload shapes are declared once at the `interface-adapters/` root; `StartSubWorkflow` runs once per sub-workflow and saves one aggregate; `CompleteSubWorkflow` reads the sub-workflow's ending through a query and passes it by value; `AdvanceInstance` is not transactional and skips `RecordRound` when nothing was recorded; a `Clock` port and `EngineClock`; the progress mapper test moved to the unit suite; one way to mark a retried `Step`.
- The adapters of T042–T044 came with this slice: `AjvSchemaValidator`, `HttpServiceCaller` (URI templates, basic, bearer and client-credentials authentication, OpenAPI operations from Swagger 2 and OpenAPI 3, the 1 MiB response limit, a `CallMisconfigured` result for a missing operation or parameter) and `GoJudgeProcessRunner` (tested against go-judge in Testcontainers: no network, time and memory limits). The sandbox token is added by the pool factory in frameworks, and the limits are an injected `SandboxLimits`.

**Not applied:** a `forBody(input)` method on `TaskScope` (it would make `task-scope` and `body-scope` import each other; the body of the root is a `do`, which needs no definition arguments); loading the OpenAPI document with the library's own HTTP resolver (it would bypass the SSRF dispatcher, so the adapter fetches it and hands the text to the parser).

**Round 11** (2026-11-01, a second review by six category agents, its findings checked by hand). Applied:

- The SSRF policy refused every public IPv4 address: `BlockList` matches an IPv4 address against an IPv6 rule in its IPv4-mapped form, so `::ffff:0:0/96` covered all of them. The rule went (the IPv4 rules already catch `::ffff:127.0.0.1`), and `::/96` covers the IPv4-compatible form (`::127.0.0.1`), the unspecified address and loopback. A unit test keeps public addresses permitted.
- An emitted event without `with` faulted the check with a `TypeError` (500): the 1.0.3 schema leaves `with` optional, and the documents contract claimed it was required. "An event to emit names its source and its type" is a rule of the concept (the DDD critic, after Khorikov's "Always-valid domain model"), so `EmitTask` owns it: its constructor refuses a template without them (`IncompleteEventError`), and an event whose source or type does not evaluate to text faults the task with a runtime error, as `raise` does. The mapper passes an absent `with` as an empty one. `dsl-reference` types `emit.event` as event properties, while its example and the schema put them under `with`; the platform follows the schema (a recorded contradiction).
- `end` inside a declared function was lost: `FunctionCallProgress` took the plain outcome. It now takes `workflowEnd()` first, as `fork` does. A declared function runs apart from the tasks that call it, so `ReusableComponents` refuses a directive naming a task (`FunctionJumpError`); before, `then: nowhere` was published and ignored.
- An `evaluate` of the wrong shape (a string, a misspelled key) ran as strict jq, since the 1.0.3 schema leaves `evaluate` out. `DefinitionMapper` checks the types the schema would (an object, string `mode` and `language`: `InvalidDocumentError`) and refuses unknown keys; the documents contract types it as `JsonValue`.
- `$secrets` in an expression and the OAuth2 or OIDC settings that client credentials with a secret does not use were published and would fail or be ignored only at run time, and a published version is never checked again. They are refused until US8 and T043 run them (FR-011), as `use.secrets` already is. Client credentials need a client id and secret (the DDD critic). The `$secrets` scan is lexical and may refuse the text inside a jq string; it goes with US8.
- FR-001 admitted DSL pre-releases, which the mapper refuses; the text now follows the code.
- The Round 10 reason "the seeded administrator is a constant" was false: the migration reads `app.bootstrap_admin_email`. The migration trims, lower-cases and checks it with zod's pattern, so the format is checked at both ways in; a test keeps the SQL pattern equal to `z.regexes.email.source` (the CA critic).

DDD and CA critics: _approve with fixes_; applied above. The dependency rule holds over the slice.

Refuted on check: the recovery completion checks a suspended user (the library calls `findUser`, that is `FindRecoveryAccount`, before `updatePassword`).

**Round 10** (2026-11-01, the user, after rereading Khorikov: "Value Objects: when to create one?", "Always-valid domain model", "Validation and DDD", "Combining ASP.NET Core validation attributes with Value Objects", "Functional C#: Primitive obsession"). Schemas only coerce types and validate: zod at the HTTP boundary, the standard's schema in the SDK for documents. Business rules never go into a schema or an adapter. The domain drops only the checks of type and format that a schema already makes; a rule about what a domain concept may be stays in the domain however simple it is and however few its ways in, and the adapter translates its error. A value object needs one of Khorikov's reasons (several primitives, non-trivial rules, repetition); a simple rule is not worth one. Stored rows are trusted, since only the application writes them. Applied:

- `EmailAddress` and `InvalidEmailAddressError` went: the format is one simple rule with two ways in, each checked where it enters. The zod `Email` schema trims, lower-cases and checks it at HTTP (`format: email` kept for clients); the bootstrap migration does the same with zod's pattern for the operator's `app.bootstrap_admin_email` (the re-review found the earlier claim that the seed is a constant false). The entities, ports and repositories take the normalized string.
- `WorkflowName` keeps the pair that identifies a workflow (`equals`) without a label rule: the path schema and the standard's schema check the labels, and the standard sets no pattern for the target of `run: workflow`, which the guard refused. `InvalidWorkflowNameError` went.
- `RetryStrategy` lost the unused `attemptCount` getter.

**Kept, with reasons:** `FixedDuration` (negative, calendar and fraction rules that the standard's schema allows, from two ways in: the document and jq results at run time); `RetryStrategy` refuses a negative attempt count and `Attempt` counts from zero (the user: rules of the concept, not format; the standard's schema checks only the integer type, and the retry mapper translates the error); the type checks on jq results (`for.in`, `raise`, `emit`, templates), which the standard answers with a `WorkflowError`; the language rules no schema can state (unique task names, directive targets, competing forks, one default case); the consistency guards of `Outcome`, `TaskEnding`, `ForProgress` and `ForkProgress`, invariants of state that many domain paths compose; the password length in zod, since on recovery the library hashes the password before our code sees it.

**Round 9** (2026-11-01, the user's question on value objects; a CA critic on all four circles against Martin 2012 and a DDD critic against Khorikov's blog). Applied:

- Ports take domain types; a use case never unwraps one for a port, and adapters do all mapping (the user). `AccountRepository.findByEmail(email)` replaced `findByIdentifier(type, email)`, so the account type is the repository's concern; `Mailing.sendInvitation(invitation, token, inviterName)` and `sendPasswordReset(to, link, expiresAt)`, with the template data owned by the mailing adapter; `FindRecoveryAccount` returns `{ user, account }` and the auth handler maps it.
- The HTTP path schema takes the standard's label rule (the 1.0.3 schema allows upper case); its stricter copy made a published `Team/…` unreadable (component test).
- `Workflow` holds its `WorkflowName` and creates its versions (`publish`), the one statement of "a version belongs to its workflow"; `SourceDocument` derives its fingerprint; `dslVersion` is a `DslVersion` in `Definition` and `WorkflowVersion`.
- `TaskEnding` holds the body's `Outcome`, so the effects and their rules have one owner; the `try` states share an `Attempt`; `Input`, `Output` and `Export` own their part of the data flow, and the stages decide only the round.
- `MalformedDurationError` names a value that is not a duration (a jq result of `42` was reported as a misplaced fraction).
- The conformance statement is an application read model; `ExcludedCallKind` and `OAuth2Grant` moved to `documents/enums.ts`; `FunctionReference` and `PointerToken` became class constants; one `StaleWriteError` for every optimistic conflict; `Actor`, `CheckDocumentQuery.format` and the public `Invitation.isExpired` and `LIFETIME_MS` went; `TaskScope.definitionArgumentsWith` and `JsonPointer.idIn` own the argument merge and the work id format.

**Kept, with reasons:** the framework clients translate library output into the contracts their adapters own (`SdkOpenWorkflowClient`, `InProcessJqClient`), so library types stay in frameworks (review item A-4, closed). The fixed-duration mapper turns domain value errors into located publish errors: translation, with one owner per rule. `settled` stays in both progress hierarchies, whose stop rules differ. `AcceptInvitation` checks the email before it creates the user (Khorikov, "Email uniqueness as an aggregate invariant": the application service checks, the unique index backs it). The OpenAPI email fields keep `format: email`, the hint clients map to `<input type=email>`, whose rule the server applies. `PasswordHasher.verify` keeps the hash as a string, since the domain has no hash type. The US2 modules, presets, factories and progress mappers stay as the Phase 2 foundations of the next story.

**Waiting for the user:** whether to drop the OIDC half of `Account` (`AccountType.Oidc`, the nullable hash, `AccountWithoutPasswordError`) until an OIDC story exists, or to fold the password into `User`; this belongs to the open User/Account and OIDC decision. The accept route's controller transaction belongs to the constitution amendment.

**Round 8** (2026-11-01, an external review by eight agents, its main findings checked again by hand): the dependency rule holds, and `language` is a real domain model. Decided by the user and applied:

- Spent retries run the catch `do`, otherwise the `try` task faults with the last error (`spec.md` and `research.md` had disagreed).
- `limit.attempt.duration` is refused at publish; `RetryStrategy` and the `try` states lost the attempt start.
- A workflow input that breaks its schema faults the instance: the root task validates it in its first stage; `inputCheck`, `InputRejectedError` and the start's 422 are gone.
- A fork branch's `end` ends the workflow (`TaskEnding.workflowEnd`, used by `Sequence` and `ForkProgress`); each branch ends once; a branch that names another branch is refused (`BranchJumpError`).
- Framework-aware use cases stay, as a deliberate marriage (Martin, "Frameworks Are Details").

- Progress state is persistable: the progress classes expose their fields through getters, as `Invitation` does, and `TaskProgressMapper` with one mapper per class (`interface-adapters/persistence/mappers/progress/`) writes and restores them; a round-trip test covers every stage and every kind. Duplicated fields stay: each state object is whole on its own.
- A round saves only at side effects (architecture §3); `FaultInstance` is the compensation of the first step and interrupts are rethrown (architecture §4).
- Publishing closes the gaps the review found: `evaluate`, the DSL version, calendar and negative durations, `Schema` holding the JSON Schema itself (no `resource`, only `json`), one default case, backoff parameters. An audit of the 1.0.3 schema against the mappers added: `return` on `run: workflow`, and unknown properties of the open objects (`catch.errors` and its `with`, where a typo emptied the filter and caught every error; `emit.event`; the workflow root; declared authentications).

**Deferred by the user:** YAML alias bombs (the SDK parses with `maxAliases` unlimited).

**Critics on this round** (DDD and CA): both _approve with fixes_. Applied:

- `Outcome` and `TaskEnding` keep public constructors for reconstitution (persistence mappers build them, as they build `Invitation`), and the Round 7 rule moved into them as guard clauses: a failure carries nothing else, one effect at most, a task that did not fault has a directive, a skipped task exports nothing. `ForkProgress` (distinct, known, waiting branches), `ForProgress` (no iteration before the items) and the `try` attempts (from zero) guard their state too, since jsonb is where old or corrupt state comes in (`InconsistentProgressError`). `FlowDirective` keeps its private constructor; a restored directive goes through `named`.
- One owner of "an `end` stops the flow": `Outcome.endsWorkflow()` for `for`, `TaskEnding.workflowEnd()` for `do` and `fork`. `FixedDuration` checks the sign only in its constructor.
- The jsonb shapes belong to persistence: `ServiceCallState` and `ProcessRunState` with their mappers; one `InstantMapper` for every date; the naming table lists `toState`/`toDomain` and `confirm`.
- The constants only the documents adapter reads (`EvaluationMode`, `ExpressionLanguage`, `SchemaFormat`) moved to `documents/enums.ts`; `EvaluateMapper` folded into `DefinitionMapper`; the texts of `UnsupportedConstruct` no longer repeat the lists that `ConformanceStatement` prints.
- Architecture §3: outside writers only signal the run, so the replayed results never meet a changed task; §8: persistence turns driver failures into `TransientStoreError`, settled for T038.
- An exception to "behaviour comes with its first consumer": the progress mappers precede their repository (T045), with the round-trip test as their consumer, because T037 needed proof that the T035 objects persist.

**Then, in order** (the user: "иди по порядку"): identity (001 R14); the `subscriber-delivery` preset left with US6 (a preset's breaker is shared, T096 builds one per subscription) and the unread CLS `generateId`; go-judge on its own network with a bearer token (R12) and the SSRF list widened by `2001::/32`, `2002::/16`, `64:ff9b:1::/48`, `fec0::/10`; a health check that passes for a worker-only container; `engine:migrate` in CI (`test:ctk` joins with T050); a full bulkhead parks the round, `NextStartDue` carries no outbox key, `StartInstance` derives the instance id from the `Idempotency-Key`, a `Clock` port arrives with T046 (architecture §3–§5, §8).

**Kept, with reasons:** mail through the outbox stays as it is: `@nestjs/mail` documents no outbox pattern beyond what the handler already does (`idempotencyKey` = the outbox message id, permanent `MailError` dead-lettered). The presets, factories and modules of US2 stay, since US2 is the story in progress.

**Waiting for the user:** amending constitution 3.0.1 (repository query methods such as `findActiveById`, framework session services kept out of ports, the controller-level transaction); a readiness check against R13's decision of a health route without dependency checks; the package changes (explicit OpenTelemetry instrumentations instead of `auto-instrumentations-node`, `express` 5.3.0 to match `platform-express`), which the user installs.

**Not applied:** a default no-op `childEnded` in the base classes (strict lint refuses the unused parameters it needs; the explicit no-ops show which states ignore children).

**Not applied:** run generations past the journal limit (the user accepted the limit); moving the subset decision into the domain (the mappers and `ConformanceStatement` already share `UnsupportedConstruct`); `{ use }` inside a declared authentication and negative literal durations, which the SDK already refuses.

**Round 7** (2026-10-31, DDD and CA critics on the code of T034–T035): both gave _approve with fixes_. Applied:

- A bug: the `try` state re-ran its catch while the handler ran. `try` is now four states (`TryProgress`, `CatchProgress`, `RetryProgress`, `HandlerProgress`), the task stages are one class each (`language/stages`), and every kind ends as `ConcludedProgress`; the `Stage` enum and the nullable fields are gone.
- One owner per rule: `Expression.holds` (jq truthiness), `TaskEnding.outcome()` (a faulted child faults its parent), `TaskScope.workId` (work ids), `Schema` (schema work and failures), `ErrorCondition` (`when`/`exceptWhen` of catch and retry), `ForTask.variablesFor`, `CatchClause.variablesFor`, `SwitchTask.outcomeFor`.
- The standard's keywords stay in the domain: `FlowDirective.named` (an enumeration class); unknown output formats and process returns are refused at publish (`UnknownValueError`); the call task carries its `CallOutput`.
- `Outcome` and `TaskEnding` are built only through factories, so they cannot hold contradictory states; the detached process or workflow travels in the `TaskEnding`, acted on once.
- `$authorization` is `null` at the definition stage; `RoundResults` is built from the ports' arrays; leftovers removed; one grouping rule in `language/`: a folder per family of kinds with its base (`tasks/`, `backoffs/`, `results/`, `progress/`, `stages/`, `scopes/`), single values at the root.
- Fork exports apply as branches end (the earlier "declaration order" had no owner and no source in the standard).
- For T037 and the round: `pendingWork(definition, runtime, now)`, `progress(now)` as plain data, the unchanged save skipped by the repository, `$runtime` passed as a value.

**Not applied:** the `TaskScope<DoTask>` narrowing stays (a guard in WorkflowInstance checks the scope's reference); `ExpressionDuration` keeps the always-valid `FixedDuration` factory and turns its refusal into an expression error; leaf kinds keep an explicit no-op `childEnded`; domain tests keep building definitions from documents through the mapper (sociable, like the CTK).

**Round 5** (2026-10-30, CA critic on the US1 diff): _approve with fixes_. The dependency rule holds, and publishing checks only what a compiler would. Applied:

- `DefinitionReader.read(text)`, so the shared `language` ports no longer depend on `workflows`.
- Behaviour comes with the story that runs it: US1 removed `WorkflowError`, `ErrorType`, `ErrorFilter.matches`, retry delays, duration arithmetic and `latest` resolution (back with T034 and T035, where the backoff kinds became `Backoff` classes).
- Each adapter declares its client and its data in its own `interfaces.ts` and `enums.ts`; `ErrorClassifier` arrives with its first consumers (T046, T047).
- The client reports the deepest schema error that does not only select a `oneOf` branch, so a refusal points at the defect.
- `frameworks/http` is in the frameworks table.

**Not applied:**

- The subset rules for grants and script languages stay in the mappers (input validation through the domain's enums, R8).
- `call: http` and `call: openapi` narrow `with` in the call mapper, because TypeScript cannot exclude those two values from a function name.
- `DocumentRoute` and the controller's route strings, the language errors in `domain/errors.ts`, and the single-value `FunctionReference` enum stay as they are.
- `private static readonly` in decorated framework classes, because decorators do not allow `static #`.
