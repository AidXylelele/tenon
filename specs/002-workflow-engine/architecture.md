# Architecture: Workflow Engine

This document covers structure and behaviour. The model is in [data-model.md](data-model.md) and the decisions, with their sources, in [research.md](research.md).

## 1. Layers and grouping

The dependency rule holds: frameworks → interface adapters → application → domain (Martin, 2012). The domain and the application import nothing from the outer rings, and no adapter group imports another. Each layer has one grouping criterion:

| Layer              | Grouped by                   | Folders                                                                                                                                                    |
| ------------------ | ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Domain             | Bounded context, then module | `domain/automation/{workflows, instances, webhooks, secrets, subscriptions}`, plus `json.ts` and `domain/result.ts`                                        |
| Application        | Subcontext                   | `application/automation/{workflows, instances, events, schedules, webhooks, secrets, subscriptions}`, plus `ports.ts` (`Clock`) and `enums.ts` (`Missing`) |
| Interface adapters | The agency they talk to      | `interface-adapters/{api, persistence, messaging, workflows, mailing}`                                                                                     |
| Frameworks         | The tool the code drives     | `frameworks/{runtime, workflows, outbox, undici, jq, ajv, piscina, go-judge, crypto, di, …}`                                                               |

**The DSL lives in the frameworks layer.** The Open Workflow DSL is the standard's language, not the platform's business. The runtime in `frameworks/runtime` checks and executes it. The domain keeps what the platform decides: publication and archiving, the instance lifecycle, webhooks, secrets and subscriptions (research R1).

### Domain

| Module          | Content                                                                                                                                                       |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `workflows`     | `Workflow` (publish, archive, on/off, which version its schedule starts, start, restart), `WorkflowVersion` (write-once), `CheckedDefinition`, `WorkflowName` |
| `instances`     | `WorkflowInstance`: the standard's phases, suspend, resume, cancel, delete, and the directive the runtime follows after each task                             |
| `webhooks`      | `Webhook` (a call becomes one event), `WebhookToken` (generated once, kept as its fingerprint)                                                                |
| `secrets`       | `Secret` (owner, name, value, version)                                                                                                                        |
| `subscriptions` | `Subscription` (refuses a secret its owner does not keep)                                                                                                     |

Expected refusals are `Result` values with a code, for example `WorkflowRefusal.Archived`; the API turns a code into a problem (§9).

### Application

| Subcontext      | Use cases                                                                                                                                                                                                                                                   | Ports and queries                                                                                                          |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `workflows`     | CheckDefinition, PublishVersion, ArchiveWorkflow, TurnWorkflowOn, TurnWorkflowOff                                                                                                                                                                           | DefinitionChecker, WorkflowRepository, WorkflowVersionRepository; WorkflowQueries; WorkflowPolicy                          |
| `instances`     | StartInstance, RestartInstance, SuspendInstance, ResumeInstance, CancelInstance, DeleteInstance; for the run: BeginInstance, RecordTaskStart, RecordTaskEnd, BeginWaiting, EndWaiting, InstanceDirective, StartSubWorkflow, CompleteInstance, FaultInstance | WorkflowInstanceRepository, InstanceRuns, TaskProgress; InstanceQueries; InstancePolicy                                    |
| `events`        | AcceptEvent, DispatchEvent, Listen, Unlisten                                                                                                                                                                                                                | EventStore, ListenerStore, EventDeliveries; EventQueries                                                                   |
| `schedules`     | SyncSchedule, StartScheduledInstance, StartOnEvent                                                                                                                                                                                                          | WorkflowSchedules, EventTriggers                                                                                           |
| `webhooks`      | CreateWebhook, DeleteWebhook, ReceiveWebhookCall                                                                                                                                                                                                            | WebhookRepository; WebhookQueries; WebhookPolicy                                                                           |
| `secrets`       | CreateSecret, ReplaceSecret, DeleteSecret                                                                                                                                                                                                                   | SecretRepository; SecretQueries; SecretPolicy                                                                              |
| `subscriptions` | CreateSubscription, DeleteSubscription, MatchSubscriptions, DeliverEvent, FailDelivery                                                                                                                                                                      | SubscriptionRepository, SubscriptionFilters, Deliveries, EventSender, DeliveryLog; SubscriptionQueries; SubscriptionPolicy |

Use cases read the time once through the `Clock` port, which `EngineClock` implements over the engine's time source, so `ManualWorkflowClock` drives HTTP requests and engine runs alike in tests.

### Interface adapters

Adapters only map. An adapter turns domain values and use-case results into an agency's shapes and back. Its IO goes through a client that `frameworks/` implements, behind a contract the adapter group declares in its `interfaces.ts`. Persistence is the one group that speaks its agency's language itself (Martin: "all the SQL should be restricted to this layer").

| Group          | Contents                                                                                                                                                                                                                                                                                                                                                                    |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `api/`         | Controllers, zod schemas, presenters (`ProblemPresenter` turns refusal codes into RFC 9457 problems), mappers (CloudEvent binary mode, cursors, webhook calls, subscription endpoints), `ProblemFilter`, middleware, `auth/`; `HealthClient` contract                                                                                                                       |
| `persistence/` | Repositories, queries, stores (task progress, events, listeners, deliveries, idempotency), mappers (including `LifecycleEventMapper`), schema; `Database`, `DrizzleTx` and the `Cipher` contract                                                                                                                                                                            |
| `messaging/`   | Controllers for the outbox messages (`EventDispatchController`, `ScheduleController`, `SubscriptionController`) and `EventSenderGateway`; the message shapes and the `DeliveryClient` contract                                                                                                                                                                              |
| `workflows/`   | `definitions/` (`RuntimeDefinitionChecker`), `runs/` (`InstanceRunController`, `InstanceRunsGateway`, `EventDeliveriesGateway`, `EngineClock`), `schedules/` (`WorkflowSchedulesGateway`, `EventTriggersGateway`, `ScheduleRunController`), `subscriptions/` (`SubscriptionFiltersGateway`, `DeliveriesGateway`, `DeliveryRunController`); the runtime and engine contracts |
| `mailing/`     | `MailGateway` and the templates (feature 001)                                                                                                                                                                                                                                                                                                                               |

There is no `sandbox/` adapter group at HEAD. Only the runtime runs processes, so the go-judge contract (`SandboxClient`) is one of the runtime's own tool contracts in `frameworks/runtime/interfaces.ts`.

### Frameworks

Frameworks hold the libraries: library instances, client implementations, resilience presets, error classification and the engine's workflows. Two tools never share a folder.

| Folder       | Tool                                     | Contents                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ------------ | ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `runtime/`   | The Open Workflow DSL 1.0.3              | `checking/` (schema, DSL version, subset, task names, references, durations, cron, expressions, author schemas, secrets, fingerprint), `document/` (walks, pointers, task kinds, event types, durations), `execution/` (the task runner, data flow, one kind per task, retry policy, event filters, secret masking), `conformance.ts`, `runtime.ts`, and the clients the adapters' contracts name (`RuntimeTimingClient`, `RuntimeTriggerClient`, `RuntimeFilterClient`); `interfaces.ts` declares its own tools |
| `workflows/` | The durable engine (`@nestjs/workflows`) | The engine workflows `instance`, `process`, `schedule` and `delivery`; `EngineDurability` (the runtime's `Durability`); the clients `EngineRunClient`, `EngineScheduleClient`, `EngineDeliveryClient`, `EngineCronClient`; `StepErrors`                                                                                                                                                                                                                                                                          |
| `outbox/`    | The outbox (`@nestjs/outbox`)            | The `@OnOutboxMessage` handlers (event dispatch, schedules, subscriptions, instance events, mail), `OutboxErrors`                                                                                                                                                                                                                                                                                                                                                                                                |
| `undici/`    | Outbound HTTP (undici)                   | `EndpointDispatcher` and `AddressPolicy` (FR-022), `UndiciEndpointClient` (service calls, OAuth2/OIDC tokens, OpenAPI documents), `UndiciDeliveryClient`                                                                                                                                                                                                                                                                                                                                                         |
| `jq/`        | jq (jq-wasm)                             | `PiscinaJqClient` (the sandbox prelude, the `jq` preset) and `jq.worker.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `ajv/`       | JSON Schema (Ajv)                        | `AjvJsonSchemaClient` (the `schemas` preset) and `ajv.worker.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `piscina/`   | Worker threads (Piscina)                 | `WorkerPool`: runs bounded by a resilience preset; a timed-out or out-of-memory worker ends                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `go-judge/`  | The go-judge sandbox                     | `GoJudgeSandboxClient` (the `processes` preset), `SandboxPool` (its own connection pool with the bearer token)                                                                                                                                                                                                                                                                                                                                                                                                   |
| `crypto/`    | `node:crypto`                            | `AesGcmCipher` (`Cipher`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `di/`        | Nest's container                         | One module per tool (engine, outbox, idempotency, resilience, runtime, undici, go-judge, jq, ajv, crypto, …), each closing what it opened; `automation.module.ts` assembles the context                                                                                                                                                                                                                                                                                                                          |

The remaining folders serve both features: `drizzle/` (`createDatabase`, `PostgresTransientFailures`), `express/` (`configureHttpApp`, `DatabaseUnavailableFilter`), `resilience/` (`ErrorClassifier`), `swagger/`, `pino/`, `terminus/` and `mail/`.

**Naming.** Controllers (inbound: HTTP routes, engine steps, outbox messages) are `*.controller.ts`; outbound adapters `*.gateway.ts`; `drizzle-*.repository.ts`, `drizzle-*.queries.ts`, `drizzle-*.store.ts`; mappers `mappers/*.mapper.ts`; engine workflows `*.workflow.ts`; outbox handlers `*.outbox.handler.ts`; library clients `<mechanism>-<agency>.client.ts`.

**Runtime topology.** Every API process runs the same image. The flags `HTTP`, `ENGINE_WORKER` and `OUTBOX_RELAY` switch its roles. Work is shared only through PostgreSQL: engine runs by leases, outbox messages by fenced leases, schedule occurrences by the engine's schedules. go-judge is a separate, stateless service. Both scale by adding processes.

## 2. The runtime

`Runtime.run(plan, durability, observer)` executes one instance's document with the standard's semantics. It reaches the engine only through `Durability` and the platform only through `RunObserver`, which `InstanceRunController` implements.

- **Durability.** Each effect is one durable step whose result is journaled, so a replay never repeats a recorded effect. A leaf task (`set`, `switch`, `raise`, `emit`, `call`, an awaited `run: script` or `run: shell`) is one step with its `if`, input, body, output and export. A composite (`do`, `for`, `fork`, `try`, a declared function, `wait`, `listen`) runs its children between steps. `wait` and retry delays are durable sleeps. A single task in a `try` is retried by the engine's own step retries; several tasks run again after a durable sleep.
- **Observer.** After each task the runtime reports the task record (`RecordTaskStart`, `RecordTaskEnd`) and asks for the instance's directive (`continue`, `suspend` or `stop`). A suspended run waits for the `resume` signal, rechecking at intervals. A stopped run starts no further task.
- **Expressions and schemas.** Run in Piscina workers (`jq/`, `ajv/`), each bounded at 5 s (research R4, R5).
- **Service calls.** Go through `UndiciEndpointClient` on the `EndpointDispatcher`: the `service-calls` preset (30 s, a bulkhead of 64) and a 1 MiB response limit.
- **Processes.** Awaited processes run in go-judge as a step. A process with `await: false` becomes an engine child (`process`) that nobody awaits.
- **Sub-workflows.** `run: workflow` starts the child instance through the platform (`StartSubWorkflow`), then runs it as an engine child (`executeChild` when awaited; `startChild` with `parentClose: 'abandon'` when not).
- **Listening.** `listen` registers a listener (`Listen`: a key, the event types and `since`), marks the instance waiting, and waits for `event` signals sent to its key. It decides by its own filters whether it consumes an event. When it ends it removes the listener (`Unlisten`).
- **Emitted events.** Go to `AcceptEvent` like any other event.
- **Secrets.** Read once per execution through the observer, never journaled, and masked in records, outputs, errors and emitted events (research R11).

## 3. Engine workflows

| Workflow               | Run per                             | Steps                                                                                                                                                                                                                                                       |
| ---------------------- | ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `instance` (version 2) | instance (id = instance id)         | `begin` (pending → running; a stopped instance ends the run), `plan` (the version's document and the input), the runtime's steps, `end` (`CompleteInstance` or `FaultInstance`). A defect of the platform faults the instance instead of leaving it running |
| `process` (version 1)  | detached process                    | `run` in go-judge; an outage of the sandbox repeats the step                                                                                                                                                                                                |
| `schedule`             | schedule occurrence or `after` link | an optional `after` sleep, then `start` (`StartScheduledInstance`), with the instance id from `ctx.uuid()` so a retried step finds the instance it started                                                                                                  |
| `delivery`             | subscription and event              | `deliver` (`DeliverEvent`), retried 36 times from 1 s doubling to 1 h (about 24 h), then `failed` (`FailDelivery`); concurrency 4 overall and 1 per subscription                                                                                            |

Engine settings: 10 runs per worker, a 100 ms poll, a 120 s lease renewed by the heartbeat, a 90 s shutdown, and payloads encrypted with `AesGcmPayloadCodec` under `SECRETS_KEY` (research R2). A step's transient failure (a PostgreSQL outage) is retried 10 times, from 1 s doubling to 1 min, on top of a retry policy's own attempts.

## 4. Publishing

`PublishVersion` composes `CheckDefinition` and writes only at the end:

1. `CheckDefinition` (no transaction) reads the publisher's secret names, asks `DefinitionChecker` (the runtime's checks, first problem refuses), loads or registers the `Workflow`, finds an existing version under the same identity, and lets `Workflow.publish` decide: the same content is the existing version (200); other content is `workflow.version-taken` (409); an archived workflow is `workflow.archived` (409).
2. `PublishVersion` opens a transaction only for the writes (`TransactionHost.withTransaction`): the workflow and the new version. The workflow's version fence and the unique (workflow, semver) index keep a concurrent publish out.

The checks run in this order: the standard's JSON Schema (Ajv 2020 over the SDK's schema, a task re-validated against its own kind for a precise pointer), the DSL version, the subset, unique task names, references, durations, cron syntax (the engine's own reading), expression syntax (bare expressions in expression-only fields included), author schemas, and `use.secrets` against the publisher's names.

## 5. Starts

| Use case                 | Trigger              | Steps                                                                                                                                                                                                                     |
| ------------------------ | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `StartInstance` (HTTP)   | `manual`             | `@Idempotent` on the route. Find the workflow, then the version named or the current one (`latest`), then `Workflow.startInstance` (refuses an archived workflow), save, and `InstanceRuns.start` in the same transaction |
| `RestartInstance` (HTTP) | `restart`            | An ended instance's version and input; `originId` names the restarted instance                                                                                                                                            |
| `StartSubWorkflow` (run) | `parent`, `detached` | The version named or the current one, of a workflow that is not archived; `originId` names the parent; the parent's run starts the child's run                                                                            |
| `StartScheduledInstance` | `schedule`           | `Workflow.startScheduledInstance`: only the current version of a workflow that is on (else `workflow.off`); a link of an `after` chain starts none while an instance the schedule started runs                            |
| `StartOnEvent` (outbox)  | `event`              | For each current version of a workflow that is on whose `schedule.on` takes the event: one instance with `[event]` as input                                                                                               |

`EngineRunClient.start` requires its caller's transaction (`Propagation.Mandatory`), so a run starts only with the instance it runs.

## 6. Events

1. **Acceptance.** `EventStore.accept` inserts the CloudEvent once per (source, id) (`ON CONFLICT DO NOTHING`) and, in the same transaction, adds one outbox message `event.accepted` under the single key `events`, so consumers see events in acceptance order. Sources:
   - the intake `POST /events` (structured or binary mode);
   - webhook calls;
   - `emit` tasks;
   - lifecycle events, written by the instance repository's `save` from the instance's changes, and by the task progress store from task records.
2. **Consumers** of `event.accepted`:
   - `dispatch` → `DispatchEvent`: every listener of a running instance that takes the event's type and began before the event was accepted gets an engine signal with id `{sequence}:{listener key}`, so a repeated dispatch delivers once per listener.
   - `schedule-on` → `StartOnEvent`, in one transaction with the consumer's inbox (`processInTransaction`), so a redelivered message starts nothing again.
   - `subscriptions` → `MatchSubscriptions`, in one transaction with the consumer's inbox: one pending delivery row and one `delivery` run for each subscription that existed when the event was accepted and whose filter takes it.
3. **Filters** are the standard's event filter, matched by `EventFilters` for listens, `schedule.on` and subscriptions alike (research R8).

## 7. Schedules and control

- **Schedule changes.** `Workflow` raises `workflow.schedule-changed` when a publish while on, an archive, or a turn on or off changes which version's schedule runs. Its outbox consumer `schedules` runs `SyncSchedule`, which applies the current version's timing through `WorkflowSchedules`. The runtime reads the timing from the document (`TimingClient`); the engine's schedule client gets only that timing (research R10).
- **Suspend.** `WorkflowInstance.suspend` refuses anything but running or waiting. The run sees `suspend` at its next task boundary and holds there. A call in flight finishes and is recorded.
- **Resume.** The outbox consumer `engine` sends the `resume` signal to the held run.
- **Cancel.** `CancelInstance` cancels the instance, marks its running task records cancelled, and does the same for every awaited child, recursively, in one transaction (US9 AS3). The consumer `engine` cancels each run (`WorkflowClient.cancel`). A task result that arrives after the end is ignored.
- **Delete.** Only an ended instance. The row goes with its task records and listeners (cascade). The consumer `engine` deletes the run's journal.

## 8. Subscriptions and deliveries

`DeliverEvent` reads the subscription (gone: nothing more to do), the event, and the owner's secret value when the endpoint names one (missing: the attempt fails with that reason). `EventSender` then posts the event in structured mode (`application/cloudevents+json`) through `UndiciDeliveryClient`: the `EndpointDispatcher`'s address policy, the `service-calls` preset, and the secret masked in any error. A 2xx answer is delivered. Anything else is recorded on the delivery row (`refused`: attempts, last error) and retried by the `delivery` run's step retries with the same event, so the same id. When the attempts are spent, the run's `failed` step marks the delivery failed.

## 9. Errors

- **HTTP.** Every automation controller uses `ProblemFilter`, so every refusal is `application/problem+json` (RFC 9457). A refusal a use case or the domain names has the type `urn:problem:<code>`, its title from `ProblemPresenter` and its status (404 not found, 409 conflict, 422 invalid). A located refusal (`definition.invalid`, `subscription.invalid`) lists `errors[{ pointer, detail }]`. Validation, authorization and idempotency refusals are `about:blank` problems titled by their status (RFC 9457 §4.2.1), with the library's `code` when it gave one. A transient PostgreSQL failure answers 503 with `Retry-After: 5` (`DatabaseUnavailableFilter`).
- **Engine and outbox.** Use cases never catch. `ErrorClassifier` (`frameworks/resilience`) tells settled, transient and permanent errors apart, using `PostgresTransientFailures` for the database. `StepErrors` makes the engine retry transient errors and stop on permanent ones. `OutboxErrors` acknowledges settled errors, retries transient ones and dead-letters the rest.
- **Outbound clients** answer with outcomes (responded, rejected, timed out, unreachable, unauthorized) rather than throwing, and the runtime maps them to the standard's errors.

## 10. Guarantees

| Operation                   | Transaction                                        | Guarantee                                                                                  |
| --------------------------- | -------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| HTTP command                | `@Transactional`; publish writes after its checks  | Atomic; a stale write is a conflict                                                        |
| Start                       | Instance row + engine run in one transaction       | One run per instance; a repeated start with the same `Idempotency-Key` within 24 h replays |
| Task effect                 | One engine step, journaled                         | A recorded effect is never repeated; an interrupted one runs again (at least once)         |
| Event acceptance            | Event row + outbox message                         | Once per source and id; dispatched after commit, in acceptance order                       |
| Event start, delivery match | Outbox consumer's inbox in the same transaction    | Exactly once per event and consumer                                                        |
| Listen                      | Engine signal with id `{sequence}:{key}`           | Once per event and listener                                                                |
| Delivery                    | Engine run per (subscription, event), step retries | At least once, with the same event id, for about 24 hours                                  |
| Schedule occurrence         | Engine schedule (`missed: once`)                   | Once across all workers; at most one missed occurrence after downtime                      |

## 11. Security

- **Outbound HTTP.** `EndpointDispatcher` (undici) refuses private, loopback and link-local addresses at every connect, redirects included, unless they are allow-listed (`OUTBOUND_ALLOW_LIST`). Service calls and deliveries use it.
- **Scripts and shell commands** run only in go-judge, with no network, read-only system directories with `node` and `python3` from a custom image, temporary work directories, and 30 s, 256 MiB, 50 processes and 1 MiB per output stream. go-judge sits on its own Compose network and requires a bearer token.
- **jq.** A prelude turns `env`, `input`, `inputs`, `input_filename`, `halt`, `halt_error` and local time into errors, and makes `debug` and `stderr` pass their input through. Each run is bounded at 5 s and a 128 MB worker heap. Expressions in data are never evaluated.
- **Author schemas.** Compiled at publish, validated in workers with a 5 s bound, because a `pattern` can backtrack without end.
- **Secrets.** Sealed at rest with AES-256-GCM (`SECRETS_KEY`). The engine's journal is encrypted with the same key. Values are read per execution and masked wherever the platform records, shows or delivers them.
- **Webhooks.** Unguessable tokens kept as SHA-256 fingerprints; unknown and deleted tokens answer the same 404.
- **Input.** zod on every body, query and path, unknown fields refused. JSON only, except the event and webhook routes. 1 MiB per body.

## 12. Conformance harness

- **Runner.** The CTK 1.0.3 feature files, copied unchanged into `apps/api/test/conformance/features/`, run through the public HTTP API by `quickpickle` as a separate Vitest project (`test:ctk`).
- **Stand-ins.** undici `MockAgent` stands in for petstore and httpbin; the address policy has its own tests.
- **Contradiction.** The one recorded contradiction (FR-032) is asserted as the specification prescribes.
