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

| Event                                               | Reaction                                       | Key           | Why it is outside the transaction                                                                                                                                                                     |
| --------------------------------------------------- | ---------------------------------------------- | ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| EventAccepted                                       | RouteEvent                                     | —             | unbounded fan-out; webhook answers must not wait                                                                                                                                                      |
| (EventOffers) correlation, trigger, delivery offers | OfferEvent, OfferTrigger, OfferDelivery        | candidate     | one message per candidate, so one slow filter delays no other                                                                                                                                         |
| CorrelationStarted                                  | CatchUpCorrelation                             | correlation   | catch-up must see events committed after the start                                                                                                                                                    |
| ListenStarted, ListenEnded                          | StartCorrelation, EndCorrelation               | instance      | correlations advance under their own concurrency, per event                                                                                                                                           |
| EventConsumed, CorrelationCompleted                 | ConsumeListenEvent, CompleteListen             | instance      | the instance advances in its own engine run                                                                                                                                                           |
| TriggerSatisfied                                    | StartTriggeredInstance                         | workflow      | a new instance and its run                                                                                                                                                                            |
| CancelRequested (US9)                               | CancelInstance                                 | child         | a separate instance in a separate run; sub-workflows themselves are engine steps (architecture §4)                                                                                                    |
| ProcessDetached                                     | RunDetachedProcess                             | task instance | a sandbox process outside the database; the payload carries the evaluated `ProcessRun` (US8 must keep secret values out of it); keyed by the task, so a slow script holds no other reaction           |
| WorkflowDetached                                    | StartDetachedWorkflow                          | sub-workflow  | a new instance and its run; the payload names the version resolved when the task started                                                                                                              |
| NextStartDue (`delay`)                              | StartScheduledInstance                         | —             | delayed by definition; it carries no key, because a delayed message heads its key's queue and would hold every later message of the workflow (a new cron, switching the workflow off) until it is due |
| RecurringScheduleSet, RecurringScheduleCleared      | RegisterRecurringStarts, RemoveRecurringStarts | workflow      | `WorkflowSchedules.upsert` takes no transaction                                                                                                                                                       |
| DeliveryScheduled                                   | DeliverEvent                                   | —             | it leaves the system                                                                                                                                                                                  |

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
  - The client (`frameworks/jq`) compiles `empty | (wrapped program)`, with every `$name` the program mentions bound, so publishing checks exactly what a run evaluates. Only syntax errors remain, and the program never runs.
  - The first failure refuses the document.
- **Evaluation (US2).**
  - `PiscinaJqClient` compiles and evaluates in Piscina workers behind `JqClient`. Measured on this machine, one jq run costs about 0.8 ms in process and in a worker alike, so the pool adds nothing noticeable.
  - The pool has one to four workers (about 20 MB each; Piscina's default of 1.5 × the CPUs gave 24 threads and 0.5 GB). The `jq` preset's 1 s covers the wait for a worker too, because the resilience timeout wraps the whole call; with the engine's ten runs per process and runs of about a millisecond, a program waits only behind other runaways.
  - A program that exhausts jq's memory makes jq-wasm abort its WebAssembly instance (`Aborted()`). The worker answers `aborted` and loads a fresh instance (4 ms), since the aborted one is in an unknown state. Both a time-out and an abort are expression errors, which `try` can catch.
  - jq-wasm computes synchronously and has no time limit. Measured on Node 26, `reduce range(30000000) as $i (0; . + 1)` blocked the event loop for 9 s. Only terminating a worker thread stops it, and jq-wasm's README recommends Piscina for that mode. The `jq` resilience preset gives 1 s.
  - The client wraps every program in the sandbox prelude, `null as $ENV | [ program` and a closing bracket on its own line (so a trailing `# comment` cannot swallow it):
    - `env`, `input`, `inputs`, `input_filename`, `halt`, `halt_error`, `localtime` and `strflocaltime` become errors; `$ENV` is `null`, because `--argjson ENV` does not shadow jq's built-in;
    - `debug` and `stderr` become identities.
    - Its reasons: the environment never depends on how a jq build emulates one; results do not depend on a worker's time zone; data never reaches stderr; and `halt` never yields silent emptiness.
  - **Outputs.** The client returns every value the program produced; the evaluator maps none to `null`, one to that value, and more than one to an evaluation failure (an expression error). The standard expects an expression to yield a value; collecting several into an array (the Java SDK's convention) would make the result's shape depend on the amount of data and turn `if: ${ .a, .b }` with two `false` into a truthy array.
  - Each Evaluation carries the runtime arguments that the standard's table allows at its place, chosen by the domain (data-model §7); the domain also splits templates into their expressions.
- **Templates.** A `${ }` leaf of a template is an expression. Fields typed as expressions are evaluated without `${ }` (CTK).
- **Pattern matches** run as jq `test()`, written by the adapter (US7).

**Rejected:**

- `node-jq` (a jq process per evaluation);
- `jq-web` and JavaScript reimplementations such as `jq-ts`, whose semantics differ;
- for evaluation, jq-wasm's asynchronous convenience API, which is asynchronous only while loading.

## R10. Schemas

**Decision:** Ajv 8 with `ajv-formats`, one instance per draft, in `AjvJsonSchemaClient` (`frameworks/ajv`), behind `JsonSchemaClient`; `JsonSchemaValidator` (`workflows/schemas/`) maps a `Validation` to it and its verdict back. A schema's own `$schema` decides the draft; the default is draft-07. It checks input, output and export schemas at workflow and task level.

- `addUsedSchema: false`: a schema with an `$id` compiles again in the same process instead of failing as a duplicate.
- Compiled validators are kept in a bounded cache (256 entries, least recently used out), keyed by the schema's text; an entry that leaves the cache is removed from Ajv too (`removeSchema`), since Ajv keeps every schema it compiled. So a long-running worker neither recompiles every round nor grows without limit.
- A schema Ajv cannot compile (an unknown type, an external `$ref`) is a configuration error, not a validation error: the standard keeps validation for data that does not match. Publishing compiles every author schema as a compiler would (T051a), so this happens only to versions published before that check.

**Why not the SDK.** `@openworkflowspec/sdk` validates only the standard's own types (`validate(typeName, data)` over its bundled schema, with a private Ajv). It cannot check instance data against an author's `input.schema`, `output.schema` or `export.schema` (FR-010), so a JSON Schema validator is needed; Ajv is already the SDK's dependency, so the platform adds no other.

## R11. Service calls

**Decision:**

- **Split.** `ServiceCallGateway` (`workflows/services/`) maps a `ServiceCall` to an HTTP request and an authorization (URI templates, `query`, headers, body; basic and bearer headers; oauth2/oidc client credentials as a token request), and maps the client's outcome back to a result. `UndiciEndpointClient` (`frameworks/undici`) performs the IO behind `EndpointClient`: the request on `EndpointDispatcher`, the OIDC discovery and the token request, the 1 MiB response limit, the decoding of a JSON body, the `service-calls` preset and every library error (credentials from secrets join with US8).
- **Outcomes and results.** The client answers `responded`, `rejected` (the full bulkhead: no result, the work stays pending), `timed-out`, `unreachable` or `unauthorized`; the gateway maps them to `ServiceResponded(status, headers, content, request, authorization)`, nothing, `ServiceTimedOut`, `CommunicationFailed` or `AuthenticationFailed`. A request the arguments cannot form (an invalid URI, a missing OpenAPI operation or required parameter, an unreadable document) is `CallMisconfigured`. The domain (`CallOutput`) decides the output format (`content`, `response`, `raw`), `redirect` and which statuses are errors. The client returns the status, the headers and the bytes; the gateway's mapper decodes the content (JSON by content type, else text) and encodes the body as base64, and `ServiceResponded` carries both, so `OutputFormat.Raw` picks the body in the domain. The OpenAPI dereference ignores circular references (`circular: 'ignore'`), so a document always stays JSON.
- **`call: openapi`.** The client reads the document through `EndpointDispatcher` and dereferences it with `@apidevtools/json-schema-ref-parser` (external resolution off), without caching or retries; the gateway's mapper then resolves the `operationId` and forms the request.
- **Limits.** The `service-calls` preset caps each exchange (the document read, the call) at 30 s and adds a bulkhead.

## R12. Scripts and shell commands (go-judge)

**Decision:**

- **Running.** `SandboxGateway` (`sandbox/`, implementing `ProcessRunner`) maps a `ProcessRun` to one go-judge command, and `GoJudgeSandboxClient` (`frameworks/go-judge`) sends it as `POST /run` on the authorized pool under the `processes` preset. A rejected run (full bulkhead), an unreachable sandbox and an answer that is not a go-judge result (a proxy's page, a non-2xx status) get no result, so the round waits and tries again: an outage of the platform's own sandbox is not the author's error (Round 17). A time-out is a result. The command:
  - the interpreter (`/usr/local/bin/node`, `/usr/bin/python3` or `/bin/sh -c`), then the file and the arguments;
  - `env`: only the task's environment;
  - stdin, plus stdout and stderr capped at 1 MiB;
  - `clockLimit` and `cpuLimit` from the deadline;
  - `memoryLimit` 256 MiB, `procLimit` 50;
  - `copyIn` with the code.
- **Results.** `Accepted` or `Nonzero Exit Status` → `ProcessExited` (stdout and stderr as strings). `Time Limit Exceeded` → `ProcessTimedOut`. Anything else → `SandboxFailed`.
- **`await: false`.** The task completes with its transformed input and raises `ProcessDetached` with the evaluated `ProcessRun`. `RunDetachedProcess` runs the process from the outbox, and its result is ignored.
- **Deployment.** go-judge runs privileged with cgroup v2 and the network off. It uses a custom image, pinned by digest, with Node.js and Python 3 in its rootfs. It is reached through the client's own pool (`frameworks/go-judge`), separate from `EndpointDispatcher`. It sits on its own Compose network (`sandbox`), which only the API shares, and requires a bearer token (`ES_AUTH_TOKEN` = `SANDBOX_TOKEN`), so a sandbox escape does not reach PostgreSQL and no other caller can run code.

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
- **The start key.** The interceptor keeps a key for 24 hours: the same key and request replay the answer, the same key with another request is a 422. To survive a crash between the commit and the stored answer, the instance id also derives from the key: the API controller maps the `Idempotency-Key` and a SHA-256 of the canonical JSON of the requested version and input (members in code-unit order, as RFC 8785 sorts, so every process computes the same fingerprint; a missing version is `latest` and a missing input `{}`) to a start key, and `WorkflowInstance.idFor` derives the id from the user, the workflow and that key. After 24 hours the same request still finds its instance, and another request starts a new one (the user's decision, 2026-11-02).
- A Drizzle store from the docs recipe, tested with `idempotencyStoreContract`.

## R15. Resilience (`@nestjs/resilience` 0.0.3)

**Decision:** Presets declared in `frameworks/di/resilience.module`:

| Preset                      | Timeout                                                                                                                            | Bulkhead (rejects when full) | Retries |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- | ------- |
| `service-calls`             | deadline, ≤ 30 s                                                                                                                   | yes                          | none    |
| `subscriber-delivery` (US6) | 10 s; no preset: a preset's breaker is shared under its name, so T096 creates one per subscription with `ResilienceService.create` | —                            | none    |
| `processes`                 | deadline + 5 s                                                                                                                     | yes                          | none    |
| `jq` (US2)                  | 1 s, applied by `PiscinaJqClient` in frameworks, because terminating the worker is pool mechanics                                  | —                            | —       |

Every preset is applied by the client in `frameworks/` that performs the IO (`PiscinaJqClient`, `UndiciEndpointClient`, `GoJudgeSandboxClient`), which turns its errors into outcomes; adapters never see a preset.

**Rationale:**

- Retries belong to the DSL author or the outbox.
- Breakers on DSL calls would invent results.

## R16. Interpretation of the standard and the CTK

| Point                                                                                | Decision                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `$secrets`                                                                           | Only in `input.from`, enforced at run time (US8). The standard's argument table marks it everywhere; its description limits it to `input.from`, and the platform follows the description (recorded contradiction)                                                                                                                                                                                                                                                                           |
| `$authorization`                                                                     | From the call's ServiceResult, for `output.as` and `export.as`; the availability of every argument follows the standard's table at run time (US2)                                                                                                                                                                                                                                                                                                                                           |
| `$runtime`                                                                           | `{ name, version }` of the platform                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `$task.definition`, `$workflow.definition`                                           | The parsed JSON kept in the Definition                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `set`                                                                                | Replaces the data                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `emit`                                                                               | The runtime generates `id`, `time` and `specversion`; the output is the event (CTK `emit.feature`)                                                                                                                                                                                                                                                                                                                                                                                          |
| Task reference                                                                       | `/do/<index>/<name>[…]` (CTK)                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| Communication error                                                                  | Type `…/spec/1.0.0/errors/communication`; the HTTP status, or 500; a title                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Missing or `null` workflow input                                                     | `{}`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `status-changed` events                                                              | Not produced                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| HTTP response `content`                                                              | The standard deserializes "one of the following" content types without listing them. JSON media types (`application/json`, `+json`) are parsed, and a body that does not parse is a communication error ("invalid responses"); `text/*`, XML and YAML are text; any other content, and a response without a content type, is base64 (Round 17)                                                                                                                                              |
| Lifecycle `output`                                                                   | Any JSON value the task or workflow produced (the standard types it as a map; the platform does not drop arrays or scalars). The stored Event keeps it, so internal consumers (listens, `schedule.on`, US7) see it whole. Where the event leaves the platform as CloudEvent JSON (the API presenter now, the delivery gateway in US6) it is left out when it would make the event larger than 64 KiB; before US6 the format and the rule move to one writer that both adapters share (T096) |
| Lifecycle `source`                                                                   | `/workflows/{namespace}/{name}/instances/{id}`                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `run.workflow.version`                                                               | Required by the 1.0.3 schema; `latest` is resolved when the task starts, awaited or not; a missing target faults the task with a configuration error (US2), as AWS Step Functions (`StateMachineDoesNotExist`) and Camunda (an incident on a call activity to a missing process) do                                                                                                                                                                                                         |
| Fork                                                                                 | Output is an array, or the winner's output with `compete`; each branch's export applies when the branch ends, like any task's                                                                                                                                                                                                                                                                                                                                                               |
| `after`                                                                              | Next start only after **completion**                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Script language                                                                      | `js` → Node.js; `python` → Python 3; `source` is outside the subset                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Process output                                                                       | stdout and stderr as strings; a non-zero exit is not an error; time-out → timeout error; other sandbox failure → runtime error                                                                                                                                                                                                                                                                                                                                                              |
| `await: false`                                                                       | Transformed input; the process or sub-workflow is detached once the task has started it (a process) or resolved its target (a sub-workflow)                                                                                                                                                                                                                                                                                                                                                 |
| Backoff                                                                              | `constant`: the delay; `linear`: delay × attempt; `exponential`: delay × 2^(attempt − 1); jitter adds a share of `[from, to]`                                                                                                                                                                                                                                                                                                                                                               |
| `catch.errors.with.details`                                                          | Matches the error's `detail` (the schema names the filter property `details`)                                                                                                                                                                                                                                                                                                                                                                                                               |
| Retry limits                                                                         | `limit.attempt.count` bounds the retries and `limit.duration` the whole retry window; `limit.attempt.duration` is refused (the text bounds all attempts, the schema each one). Spent retries run the catch `do`, or fault the `try` task with the last error                                                                                                                                                                                                                                |
| A fraction in a duration other than in the smallest of its hours, minutes or seconds | Refused at publish (Temporal cannot compute it); listed in the conformance statement                                                                                                                                                                                                                                                                                                                                                                                                        |
| Initial `$context`                                                                   | `{}`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| A faulted branch of a competing `fork`                                               | The first branch to end decides; a fault faults the fork (the standard names only the winner)                                                                                                                                                                                                                                                                                                                                                                                               |
| `exit` inside `for`                                                                  | Ends the current iteration; the loop goes on (the standard: "halts the current branch")                                                                                                                                                                                                                                                                                                                                                                                                     |
| `for.while`                                                                          | Checked before every iteration, the first included                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| A `for` without `while` whose body is empty                                          | Completes with its input at once, whatever the number of items                                                                                                                                                                                                                                                                                                                                                                                                                              |
| Lifecycle `name` / `workflow`                                                        | The instance's qualified name `{name}-{id}.{namespace}`, like the standard's example `orderPetWorkflow-ix7iryakiem8j.samples`                                                                                                                                                                                                                                                                                                                                                               |
| Lifecycle times                                                                      | `task.created` and `task.started` carry the task instance's start (its `$task.startedAt`), `workflow.started` the instance's start (`$workflow.startedAt`); both are produced only once the `if` passed (a skipped task produces no event, FR-015)                                                                                                                                                                                                                                          |
| `task.retried`, `task.cancelled`                                                     | `retried` for the `try` task when a retry starts; `cancelled` only for a task that was announced, so a task abandoned before its `if` passed produces nothing                                                                                                                                                                                                                                                                                                                               |
| A skipped branch of a competing `fork`                                               | It does not compete; when every branch is skipped, the fork's output is its input (the standard: "considered skipped if not run")                                                                                                                                                                                                                                                                                                                                                           |
| A faulted sub-workflow                                                               | The `run` task faults with its error, with `instance` set to the `run` task ("Runtimes MUST set the property when raising or escalating the error")                                                                                                                                                                                                                                                                                                                                         |
| `for.each`, `for.at`, `catch.as`                                                     | Refused at publish when they name a runtime argument (`input`, `context`…), which they would otherwise hide                                                                                                                                                                                                                                                                                                                                                                                 |
| Emitted events                                                                       | Must be CloudEvents 1.0.2 (non-empty id, source and type; a URI-reference source; RFC 3339 time; spec version `1.0`; extension values string, boolean or integer), or the task faults with a runtime error; they are recorded with the task's completion; a source in the platform's lifecycle space (`/workflows/…`) faults the task with a runtime error, so no emitted event replaces or impersonates a lifecycle event                                                                  |
| The same `source` and `id` produced twice                                            | Stored once (`ON CONFLICT DO NOTHING`); CloudEvents lets consumers treat them as duplicates                                                                                                                                                                                                                                                                                                                                                                                                 |
| The 64 KiB lifecycle limit                                                           | Measured on the event's CloudEvent JSON by the adapter that writes it; the structured HTTP body adds only the envelope headers                                                                                                                                                                                                                                                                                                                                                              |
| A jq program with several outputs                                                    | An expression error (R9); none gives `null`                                                                                                                                                                                                                                                                                                                                                                                                                                                 |

**Recorded contradiction.** In CTK `try.feature`, "Try Handle Caught Error" filters on `…/dsl/errors/types/communication`, but the specification requires `…/spec/1.0.0/errors/communication`. We follow the specification, and the scenario is recorded in FR-032 and SC-001.

## R17. Errors at non-HTTP inbound adapters

**Decision:**

- Error handling lives in `frameworks/` (the user's decision, 2026-11-01: "Обработка ошибок правильнее всего на уровне фреймворка, а адаптеры — маппинг"). One `ErrorClassifier` (`frameworks/resilience`) tells transient errors (stale writes, deferred work, socket errors, and the PostgreSQL failures that `PostgresTransientFailures` in `frameworks/drizzle` recognizes through `cause`) from settled ones (not found, stale start, invalid control). `OutboxErrors` acknowledges settled errors, rethrows transient ones and turns the rest into `NonRetryableMessageError`; the module-level `retryIf` is not used, so the mail handler keeps its retries. `StepErrors` gives the engine `null` for settled errors, rethrows transient ones for the step's retry and turns the rest into `NonRetryableStepError`. A full bulkhead is not an error: the clients answer `rejected` and the gateways return no result for the item (architecture §3). The table is architecture §8.
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

**Round 18** (2026-11-02, the fault-tolerance QA (32 experiments on a cluster of two HTTP nodes, three workers and a relay) and the refactoring critics: GRASP, SOLID and Khorikov on the domain, and on the application, adapters and frameworks; the user: "DDD строится на GRASP, SOLID принципах и ООП … исправляй, анализируй, рефактори"). Applied:

- **Fault tolerance.** A worker frozen past its lease recorded its round over its successor's: rounds are fenced (`StaleRoundError`, architecture §3). A PostgreSQL kill crashed a node through a client in use: every client listens for its errors, and the pool keeps connections alive with TCP keepalive. A paused sandbox faulted scripts with a time-out: no answer within the preset is an outage, like an unreachable one. A stored call or process without a deadline (written by an earlier build) reads as none. The API container restarts after it ends.
- **The domain** (the domain critic's M3, H1, H2, H3, M1). `DueTime` owns due times; `TaskTree` owns the task executions and their tree, and `ProducedEvents` announces by name, so `WorkflowInstance` lost 220 lines and faults in one place; leaf tasks have one class per waiting state (no nullable field switches behaviour), on `LeafTask`, `ValueTask`, `CallTask` and `ProcessTask` base classes; `BodyScope` wraps the task's scope.
- **The outer rings** (the outer critic's H1, H3, H4, M1). `NulCharacter` is the one owner of the NUL rule, checked by the result classes; `WorkerPool` (`frameworks/piscina`) owns the worker mechanics of the jq, Ajv and SDK clients; the instance repository gets an instance or fails and saves what the instance produced, so five use cases lost their guard and their event writes; schema validations run one after another.
- **The domain, M2.** `TaskEnding` is three classes, `CompletedEnding`, `FaultedEnding` and `SkippedEnding`: only a completed export replaces the workflow's context (`contextOr`), and the persistence mapper restores and stores each by its class.
- **The domain, H2 for `for`.** `ForProgress` held three states behind a nullable item list and sequence: it is now `ForCollectingProgress`, `ForCheckingProgress` and `ForIteratingProgress` on a `ForIteration` value object, so the constructor guard against impossible combinations and two unreachable branches are gone. `ForTask.whilst` refuses a loop without `while` (`InconsistentProgressError`), since only a guarded loop checks it. The stored kinds are `for-collecting`, `for-checking` and `for-iterating`. No data migration is needed on this unreleased branch.
- **The domain, M5.** The stages before the ending are `ActiveStage`s, which time out alike. The stages after a body that did not fail are `ResultStage`s, the one owner of the rule that a failed body has no output to transform, and of the deadline and outcome they carry on. `BodyStage` keeps its body scope and its "an unchanged body keeps the stage" rule in one place each. `RoundWork.checking` and `RoundWork.validating` name the work the stages ask for.
- **The re-verification** (FT-1 to FT-4 on the fixed build). The PostgreSQL kill, the frozen worker and the paused sandbox pass. A stage has stored its deadline since US2, so a stage without one is corrupt, not old: an instant that is not a time is refused when read (`InconsistentProgressError`), not when written back. An instance whose stored state can be neither read nor written faults neither in its round nor in its fault step: the run ends `failed` and the instance stays `running`. That is the `@nestjs/workflows` state of a run that needs a person, and `retry(id)` runs it again from its journal once the cause is fixed. Not applied: a direct `faulted` write past the aggregate, which would be a second owner of the fault rule and would skip the lifecycle events.

**Round 17** (2026-11-02, the final review and the first QA round on a local stand: three isolated stacks of PostgreSQL, Mailpit and go-judge with API nodes in their roles; two static reviewers (DDD, Clean Architecture and libraries) and four QA agents (identity and the contract, the runtime against DSL 1.0.3, performance, fault tolerance)). Applied:

- **Blockers and highs.** A 500-byte YAML document whose aliases expand without bound hung a node: the SDK reads documents in a worker with a time and heap limit (architecture §10). Author schemas ran on the main thread, where one `pattern` could stall every instance: Ajv runs in workers. Timeouts never interrupted calls or processes in flight, and results carried the round's start time: deadlines travel with the work and each answer is recorded at its time (§3). A `compete` fork chose the first declared branch: answers are recorded in arrival order (§3). The pool could wedge and a PostgreSQL restart crashed the process: queries share the transaction's connection, the pool waits 10 s for a connection and listens for idle errors. The API did not boot (a `Date` in the OpenAPI document).
- **Runtime.** Sibling fork branches lost each other's exports: one context export per pass. A loop of 5,000 items exceeded PostgreSQL's parameter limit and retried for 9 minutes: rows go in batches, and an instance faults at its 10,001st task execution. A NUL character faulted the whole instance unlocated: it fails the task that received it (§10). Binary content is base64 and invalid JSON is a communication error (R16). jq has a worker per engine slot plus one, so one instance's runaways no longer fail another's expressions.
- **Reliability.** An unavailable or refusing sandbox defers the run instead of faulting the author's task (R12). Only a missing instance is settled; another missing record faults the run or dead-letters the message. Permanent errors are logged before the engine or the outbox keep only the wrapper. The engine step starts no round after its signal aborted. The dispatchers close at shutdown, and the API container gets 100 s to drain.
- **Security.** `output: response` no longer stores the credentials it sent; undici is not instrumented (authors' URLs and trace headers); names refuse control characters; `X-Powered-By` is off.
- **Contract.** Checking a document refuses a conflict with a published version, as publishing does (FR-003): `CheckDocument` owns everything publishing checks. An empty `Idempotency-Key` is no key, as `@nestjs/idempotency` reads it. A start body may carry 1 MiB. `emit` refuses only the exact shape of a lifecycle source.

- **Performance** (measured on a stand with 270k instances, 0.95M tasks and 2.6M events):
  - The build targets ES2023 (`.swcrc`), so `#private` fields are native; SWC's `es2021` default turned them into WeakMap helpers that took 42% of the engine's CPU.
  - A round costs what runs, not what ran: the instance keeps its tasks by id and its running tasks apart, so a 5,000-item `for` takes 6 s instead of growing quadratically (159 s at 10,000).
  - The instance list pages with a row comparison and indexes on `(started_at, id)` and `(phase, started_at, id)` (125 ms and 34 ms became about 0.1 ms).
  - A jq call binds only the arguments its program names (`$workflow` alone carried the whole document into every call), and the reader keeps the Definitions of the last 64 texts.
  - The engine and the outbox journal a short text for an error they retry, never a query with its values, and a protocol violation (08P01) is permanent.

**Not applied, with reasons:** the engine's claim sorts its due rows by `(priority, wake_at, created_at, id)`, which no index of `@nestjs/workflows` serves (13.6 ms at a backlog of 9.8k, 50 ms at 100k; 0.6 ms with `CREATE INDEX ON nest_workflows.instances (priority, wake_at, created_at, id) WHERE wake_at IS NOT NULL`): the library owns that schema and its migrations run after ours, so the index is an issue for the library and an operator's index until it ships; worker concurrency and the 1 s poll stay the engine's defaults until an operator needs other values; Drizzle's query building (prepared statements), the copies of a large output inside the task's progress, and the size of the event indexes (the CloudEvents identity serves the webhooks of US5 and US7) wait for those measurements to matter; waiting for a `compete` loser's call before the round saves (the platform has no way to interrupt a call it started; the winner is recorded at its time); the URI-template expansion of a map variable (RFC 6570 defines one), the OpenAPI request body rules (the DSL is silent) and the sub-second timer precision of the engine's 1 s poll (within SC-006); the readiness check and a per-address limit for recovery mails, which are the user's decisions (R13, 001 FR-017).

**Round 16** (2026-11-02, the user's review of the frameworks layer, then T041 and T051a). The user: "в frameworks слое ты почему-то склеил sandbox клиент и его обработку ошибок вместе с реализацией http клиента, это неправильно — это разные инструменты". Applied:

- `frameworks/` is grouped by the tool the code drives, a library or an external service, and two tools never share a folder: `go-judge/` (the sandbox client and its pool) left `undici/`, which keeps the endpoints authors call; `errors/` became `resilience/` (transient-fault classification); `http/` became `express/` (architecture §1).
- T041: `PiscinaJqClient` and its worker replace the in-process client (R9).
- T051a: publishing compiles the author's schemas and refuses an unusable one at its pointer (R10, architecture §10).
- `PublishVersion` reads the time through the `Clock` port, as the other automation use cases do (architecture §1, "Time").

**Round 15** (2026-11-02, DDD, Clean Architecture and standard critics on the Round 14 slice). DDD: _approve with fixes_ (one blocker); Clean Architecture: _approve with fixes_; standard: _approve with fixes_, nothing blocks. Applied:

- **Blocker** (DDD): a repeated `start-<id>` step for a detached request whose child the outbox had already started answered `started`, and `ctx.startChild` then failed on the id. `StartSubWorkflow` now asks the parent's request first and the child's existence second; the outcomes are `started` and `answered`.
- `latest` has one owner in the domain: `VersionReference.forTarget(workflow, target)`; repositories fetch by the reference (`findBy`). A detached sub-workflow is pinned by its version id, not by name and semver.
- One transition for a `run: workflow` task: `subWorkflowAnswered(answer)` with `SubWorkflowEnded`, `SubWorkflowRefused` and `SubWorkflowDetached`, replacing two transitions, seventeen empty overrides and a dead branch; one factory, `WorkflowInstance.startSubWorkflow`, for awaited and detached children.
- Lifecycle Events are accepted at the time of the round that records them (`acceptedAt`), not back-dated to their own time.
- `CloudEvent` owns the completion of an emitted value (id, time, spec version) and holds its time as a `Date`; an emitted event may not claim a lifecycle source (`LifecycleSource`), so an `emit` cannot drop or impersonate another instance's lifecycle event (the standard critic).
- Clean Architecture: Ajv's own cache is bounded (`removeSchema` on eviction); the fault step retries like every step; `output: raw` has one owner (the domain picks the base64 body; the client returns bytes and the mapper decodes); the API owns its cursors both ways and the query ports take typed positions; the start key sorts members in code-unit order; the OpenAPI dereference ignores cycles; §1 states the persistence exception; the dead catch in the instance repository went.
- Standard: an unusable author schema is a configuration error; the contract's YAML descriptions are quoted; AS6 and FR-011 follow FR-009 and the detached rule; the emit id contradiction is recorded in the conformance statement; the CTK report names the contradiction; the Temporal citation became Camunda.
- Tests: the replay regression, the detached path in the domain, the reserved source, the round time, the presenter's 64 KiB rule, the start key, Ajv's cache, task and event pages and cursors, record fields (`retries`, a skipped task's output, `task.retried`), the same key with another version, the configuration error type, and every status of the concurrent starts.

**Not applied:** `StartInstance` returning a result instead of the aggregate (the codebase's results carry entities, as `PublishedVersionResult` does); names in the identity code of feature 001 (`auth/*.handler.ts`, the security headers middleware); one CloudEvent JSON writer for the presenter and the delivery gateway, which arrives with US6 (T096).

**Round 14** (2026-11-02, T051: DDD, Clean Architecture and standard critics on T039–T050, then the user's review). DDD: _approve with fixes_; Clean Architecture: _reject as is_; standard: _approve with fixes_, no blocker (CTK 20 scenarios passing plus the recorded contradiction asserted as the standard prescribes, the feature files equal to upstream v1.0.3). The user rejected the layering: "Обработка ошибок правильнее всего на уровне фреймворка, а адаптеры — маппинг по статье Роберта Мартина", with library instances and clients in `frameworks/`, logical adapter groups and no mapping in the domain. Decided by the user and applied:

- **Layers** (architecture §1). Clients, library instances, resilience presets and error handling moved to `frameworks/`, behind contracts the adapter groups declare; the adapters only map. The adapters are grouped by purpose: `api/` (the former `http/`), `persistence/`, `messaging/`, `mailing/`, `sandbox/` (its own gateway, the user's request) and `workflows/{definitions, expressions, schemas, services, runs}`. Inbound adapters are controllers (HTTP routes, engine steps, outbox messages); the `@Workflow` loop and the `@OnOutboxMessage` handlers are framework glue around them.
- **No mapping in the domain.** A lifecycle Event is built from its typed values (`Event.lifecycle`); an emitted event stays a `CloudEvent` value object from the task to the Event (`Outcome.emitted`, `Event.emitted`), with no JSON round trip. The CloudEvent JSON format (`specversion`) and the 64 KiB rule are written by the adapter that serializes the event (R16).
- **Ajv** stays, in `frameworks/ajv`: the SDK validates only the standard's own types (R10).
- **jq outputs.** More than one value is an expression error (R9).
- **Start key.** A key binds a request for the interceptor's 24 hours; after them another request with the same key starts a new instance (R14).

Applied from the critics:

- **Blocker** (DDD and CA): a refused sub-workflow left the run parked on a stale `park` with nothing to wake it. `StartSubWorkflow` answers a named outcome (`started`, `answered`, `unrequested`), the aggregate decides which (`answerSubWorkflow`), every outcome but `started` advances again, and the `instance-wake` signal went until its senders arrive (US7, US9), so a park with nothing to wait for fails loudly.
- A detached sub-workflow resolves its target in the parent's run like an awaited one: a missing target faults the task (FR-011), and `WorkflowDetached` names the resolved version, so `latest` is no longer resolved when the outbox delivers.
- `latest` has one owner: the domain's `VersionReference.forTarget(workflow, target)` (Round 15 replaced the repository's `findFor`); `WorkflowTarget.of(name, version | null)` owns the default.
- A sub-workflow id is stepped once per run, so `start-<id>` never repeats; a child that ended without a result faults the parent's task. Steps retry transient errors 10 times (1 s doubling to 1 min), and the fault step and the compensation are classified too.
- Ajv: `addUsedSchema: false` and a bounded cache of compiled schemas.
- Commands and results follow `<UseCase>Command` and `<…>Result` in `ports.ts`; "no result means deferred" has one owner; the in-memory repository stores snapshots.
- Persistence: one multi-row write of the tasks and of the outbox entries per save; indexes for the list's filters and the active tasks; the domain events taken only by a save that writes.
- API: the list filters on namespace and name each on their own; cursors are checked by zod (400); top-level task records have no parent; the contract follows the code (`retries`, no `activeTasks` or `sequence`, the 400, 403, 409 and 422 answers, page limits, `latest`).
- CTK: the recorded contradiction is reported as such, and the steps assert what the platform does there.
- Documents: R4's keys and payloads, R9's `$ENV`, the journal count per child.

**Not applied:** passing the outbox's `ctx.signal` to the use cases (no port takes a signal; the relay's publish timeout bounds a handler); a dedicated controller test per outbox topic beyond the integration tests on `OutboxRelay.runOnce`.

**Round 13** (2026-11-01, the US2 application and adapters, T039–T050; critics in T051). Decisions taken while building, recorded for the critics:

- **The round.** `AdvanceInstance` is not transactional; `BeginRound` and `RecordRound` are, and `RecordRound` is skipped when nothing was recorded. `ReadVersionDefinition` (a query use case) reads a version's document through `WorkflowQueries.documentOf` and the `DefinitionReader`, for the round, a refused sub-workflow and a completed one. `$runtime` is the injected `PlatformRuntime`.
- **Time.** `EngineClock` wraps the engine's clock and is one provider shared by the engine's options and the `Clock` port, because the engine does not export its options; tests replace that provider with a `ManualWorkflowClock`.
- _(Superseded in Round 14: the start key and `VersionReference`.)_ **Starts.** `WorkflowInstance.idFor` derives the id from the user, the workflow and the `Idempotency-Key` (a new UUID without a key); `StartInstance` returns an existing instance before it creates one (N-8). `WorkflowVersionRepository.findTarget` resolves `latest` through the workflow's current version.
- **Persistence.** One `task_instance` row per execution, ordered by its execution number; only rows without an end load with the aggregate; `save` writes nothing for an unchanged instance and writes the domain events to the outbox, keyed by the task instance (process) or the sub-workflow (workflow), so a slow script holds no other reaction (N-9). Events are inserted with `ON CONFLICT DO NOTHING`.
- **Reliability settings.** The outbox relay leases 120 s and gives a publish 60 s, so a detached process within the sandbox's 35 s budget is not counted as failed and run again (E-3); the engine's shutdown waits 90 s for a round (E-6); the database pool is `DATABASE_POOL_SIZE`, 20 by default (E-7). A detached process the full bulkhead rejected throws `WorkDeferredError`, which the classifier treats as transient, so the outbox retries it.
- _(Superseded in Round 14: the prelude lives in the client, and several outputs are an expression error.)_ **Expressions.** `JqExpressionEvaluator.evaluateAll` adds the sandbox prelude (R9) and binds `$ENV` to `null` with `null as $ENV`, since `--argjson ENV` does not shadow jq's built-in. A program's outputs are collected: none gives `null`, one gives that value, several give an array. Evaluations run in process until `piscina` is installed (T041); until then a runaway expression is not stopped.
- **The engine run.** One `start-<id>` step per sub-workflow, a `busy-<round>` sleep of 1 s doubling to 30 s for deferred work, and a park on a timer, the started sub-workflows and an `instance-wake` signal that US7 and US9 send.
- **CTK.** The steps publish and start through HTTP, drain the engine, and read the instance and its task records; petstore and httpbin are `MockAgent` stand-ins. The kit's YAML literals (inputs, expected values) are read through the standard's SDK as the value of a `set` in a throwaway document, since the API package has no YAML parser of its own. The recorded contradiction is asserted as the fault it is.

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
