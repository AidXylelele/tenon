# Architecture: Workflow Engine

This document covers structure and behaviour. The model is in [data-model.md](data-model.md) and the decisions in [research.md](research.md).

## 1. Layers and grouping

The dependency rule: frameworks → interface adapters → application → domain (Martin, 2012). One grouping criterion per layer:

| Layer              | Grouped by                       | Folders                                                                                                         |
| ------------------ | -------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Domain             | Bounded context, then module     | `domain/automation/{language, workflows, instances, events, secrets}`                                           |
| Application        | The same modules                 | `application/automation/{workflows, instances, events, secrets}`: use cases, `ports.ts`, `queries.ts`, policies |
| Interface adapters | The external agency they talk to | see below                                                                                                       |
| Frameworks         | Technology                       | `frameworks/{di, drizzle, pino, jq, undici, ajv}`                                                               |

**Adapters.** Each one converts between the application and one external agency:

| Folder         | Agency                         | Direction  | Contents                                                                                                                                                                    |
| -------------- | ------------------------------ | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `http/`        | REST clients                   | In         | Controllers, parsers (DSL body, CloudEvents), zod schemas, presenters, filters                                                                                              |
| `persistence/` | PostgreSQL                     | Out        | Repositories (secrets encrypted at rest), queries, mappers, schema, outbox writers (`DomainEventOutbox`, `OutboxEventOffers`), idempotency store                            |
| `engine/`      | `@nestjs/workflows`            | In and out | `InstanceWorkflow`, `ScheduledStartWorkflow`, `InstanceRounds` (in); `InstanceRunsGateway`, `RecurringStartsGateway` (out); `StepErrorClassifier`                           |
| `messaging/`   | Outbox relay                   | In         | One `*OutboxHandler` per domain event, each calling one use case; `OutboxErrorClassifier`                                                                                   |
| `documents/`   | DSL documents (official SDK)   | Out        | `SdkDocumentReader`: parses and validates against the standard's schema, then maps to a ParsedDocument                                                                      |
| `expressions/` | jq                             | Out        | `JqExpressionEvaluator`: evaluations, pattern matches and syntax checks, plus the worker script and the sandbox prelude                                                     |
| `json-schema/` | Ajv                            | Out        | `AjvSchemaValidator`                                                                                                                                                        |
| `endpoints/`   | HTTP endpoints chosen by users | Out        | `HttpServiceCaller` (DSL `call: http/openapi` with the standard's authentication policies) and `CloudEventSubscriberGateway` (deliveries), both on the SSRF-safe dispatcher |
| `sandbox/`     | go-judge                       | Out        | `GoJudgeProcessRunner`, `GoJudgeCommand`                                                                                                                                    |
| `mailing/`     | SMTP                           | Out        | Unchanged                                                                                                                                                                   |

Rules:

- **Shared types.** `interface-adapters/interfaces.ts` declares what the frameworks provide: `Database`, `DrizzleTx`, `EndpointDispatcher`, `SandboxPool`, `JqPool`, `JsonSchemaCompilers` and `DslSchema`.
- **Contracts.** Outbox topics and payloads are the domain events in `domain/automation/*/events.ts`.
- **Isolation.** No adapter folder imports another.

**Naming.** One convention per kind:

| Kind             | Pattern                                                                         |
| ---------------- | ------------------------------------------------------------------------------- |
| Controllers      | `*.controller.ts`                                                               |
| Repositories     | `drizzle-*.repository.ts`                                                       |
| Queries          | `drizzle-*.queries.ts`                                                          |
| Stores           | `drizzle-*.store.ts`                                                            |
| Outbox handlers  | `*-outbox.handler.ts`                                                           |
| Gateways         | `*.gateway.ts`                                                                  |
| Engine workflows | `*.workflow.ts`                                                                 |
| Computations     | `*.reader.ts`, `*.evaluator.ts`, `*.validator.ts`, `*.caller.ts`, `*.runner.ts` |

**DI.** `frameworks/di/automation.module.ts` assembles the context. There is one module per library: `engine`, `outbox`, `idempotency`, `resilience` (presets).

**Ports.** Abstract classes in `application/automation/*/ports.ts` and `queries.ts`:

| Module    | Ports                                                                                                                                 | Queries                                                                   |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| workflows | WorkflowRepository, WorkflowVersionRepository, DocumentReader, RecurringStarts                                                        | WorkflowQueries (lists, documents, published targets, trigger candidates) |
| instances | WorkflowInstanceRepository, InstanceRuns, ExpressionEvaluator, SchemaValidator, ServiceCaller, ProcessRunner                          | InstanceQueries (lists, history, progress)                                |
| events    | EventRepository, CorrelationRepository, WebhookRepository, SubscriptionRepository, DeliveryRepository, EventOffers, SubscriberGateway | EventQueries (candidates, catch-up), ConnectionQueries                    |
| secrets   | SecretRepository                                                                                                                      | SecretQueries (`valuesFor`, `namesOwnedBy`)                               |

**Time.** A use case reads the clock once per operation (`new Date()`) and passes it as a value. Jitter samples come from `node:crypto`, also passed as values. The domain reads neither.

**Runtime topology.** Every API process runs the same image, and the flags `HTTP`, `ENGINE_WORKER` and `OUTBOX_RELAY` switch its roles. Work is shared through PostgreSQL:

- engine instances: `SKIP LOCKED` with leases;
- outbox messages: fenced leases;
- schedule occurrences: occurrence ids.

go-judge is a separate, stateless service. Both scale by adding processes. The deployment is Compose; a Helm chart comes with the deployment feature.

## 2. Where Synapse's DSL processing lands

| Synapse                                                               | Here                                                         | Layer           |
| --------------------------------------------------------------------- | ------------------------------------------------------------ | --------------- |
| SDK `WorkflowDefinition` executed directly                            | `Definition.build` → value objects                           | Domain          |
| `TaskExecutor` lifecycle, stages, `GetTaskAfter`, composite executors | `WorkflowInstance`, task kinds, progress objects, `TaskList` | Domain          |
| `IExpressionEvaluator` (a jq process per evaluation), recursive `${}` | `ExpressionEvaluator` → jq-wasm in a worker pool             | Port; adapter   |
| `ISchemaHandler`                                                      | `SchemaValidator` → Ajv                                      | Port; adapter   |
| `HttpCallExecutor`, `OpenApiCallExecutor`, `AuthorizationInfo`        | `ServiceCaller` → `HttpServiceCaller`                        | Port; adapter   |
| Script and shell executors on the runner host                         | `ProcessRunner` → go-judge, with no network                  | Port; adapter   |
| `SecretsManager` (files)                                              | `Secret`, encrypted by its repository                        | Domain; adapter |
| Correlator (regex / `${}`, keys)                                      | `EventFilter` and `Correlation` decide; matching is work     | Domain          |
| Runner process per instance; Operator timers                          | One engine run per instance; engine schedules                | Adapter         |

Gaps this closes:

- validation before a run;
- durable timers and correlations;
- optimistic locking;
- retry delay and backoff;
- output and export schemas;
- workflow `input.from`, `output.as` and timeout;
- `evaluate.mode`, `for.while` and `until`;
- the fork output array;
- `$secrets` and `$authorization`;
- sandboxed scripts;
- the standard's error types.

## 3. A round

`AdvanceInstance` runs linearly. The begin save opens its own transaction (`Propagation.Required`), and the record phase runs inside `TransactionHost.withTransaction`, so the instance and the Events it produced commit together:

```text
instance = instances.get(id);  version = versions.get(instance.versionId)
secrets  = secretQueries.valuesFor(version.publisherId, version.definition.secretNames)
instance.beginRound(version.definition, secrets, now);  instances.save(instance)
work      = instance.pendingWork()
evaluated = expressions.evaluateAll(work.evaluations, secrets)
validated = schemas.validateAll(work.validations)
responses = services.callAll(work.calls, secrets)
processes = processRunner.runAll(work.processes)
transaction:
  current = instances.get(id)
  current.record({ evaluated, validated, responses, processes }, secrets, version.definition, now)
  instances.save(current)
  events.addAll(current.takeProducedEvents())
```

- `GetProgress` (a query) returns `{ kind, wakeAfterMs }`, computed inside the step.
- Adapters log work ids, never payloads. Handlers and gateways throw fixed texts, never response bodies.

## 4. The engine loop

```text
@Workflow('instance', { version: 1 })
run(ctx, { instanceId }):
  for round = 1, 2, …:
    try   progress = ctx.step("advance-" + round, rounds.untilParked(instanceId), retry: transient)
    catch ctx.step("fault-" + round, FaultInstance(instanceId, failure)); return
    if progress.kind = ended: return
    if progress.kind = run: continue
    ctx.waitForSignal("park-" + round, "wake", key: instanceId, timeout: progress.wakeAfterMs)
```

**Constraints:**

- **Round budget.** `untilParked` repeats rounds within a budget of 10 s. One round's caps add up to about 66 s:
  - evaluations 1 s;
  - calls 30 s;
  - processes 30 s + 5 s.
- **Lease.** `leaseDuration` is 120 s, and the worker heartbeat (every 40 s) renews it during a step. S0 proves both the renewal and that a `signal` sent during `advance-N` is consumed by `park-N`.
- **Bulkheads** reject when full, which is a transient error, so they never queue past the lease.
- **Journal.** Each park costs two entries. The accepted default of 10,000 entries therefore allows about 5,000 parks.

**Gateways and wakes:**

- `InstanceRuns.start` and `wake` run inside the caller's transaction (the engine's `transaction` option, with `TransactionHost.tx`). `start` is idempotent by id.
- `RecurringStarts.register` and `remove` call `WorkflowSchedules.upsert` and `remove`.
- Wakes are sent by `SuspendInstance`, `ResumeInstance`, `CancelInstance`, `CompleteListen`, `ConsumeListenEvent` and `CompleteSubWorkflow`.

## 5. Starts

Every non-HTTP start derives its id, so a repeated message finds the instance and returns at a guard:

| Use case                                                | Id                                                  | Steps                                                                                                                                                            |
| ------------------------------------------------------- | --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `StartInstance` (HTTP, `@Transactional`, `@Idempotent`) | new                                                 | version → `schemas.validate` → `WorkflowInstance.start` → save → `InstanceRuns.start`                                                                            |
| `StartScheduledInstance(workflowId, epoch, occurrence)` | `workflowId` + occurrence (or previous instance id) | guard (exists) → `workflows.getForStart` (`FOR SHARE`) → `assertStartable(epoch)` → the same steps                                                               |
| `StartTriggeredInstance`                                | correlation context id                              | the same steps, with the consumed events as input                                                                                                                |
| `StartSubWorkflow`                                      | parent id + task id                                 | guard (exists) → load parent and target (`latest` resolved) → validate the input → `child = parent.spawn(...)` → save parent → save child → `InstanceRuns.start` |

## 6. Events

1. **Produced events** (lifecycle, emit) are added in the round's transaction (§3). Each Event raises `EventAccepted`.
2. **Intake.**
   - `POST /api/v1/events` (zod schemas of the CloudEvents 1.0 HTTP binding; structured or binary; batch refused) → `AcceptEvent`.
   - `POST /api/v1/hooks/{token}` → `ReceiveWebhookCall`: `webhook.receive(call, now)` → `Event.accept` → `events.add`. A duplicate is acknowledged.
3. **Routing.** `EventAccepted` → `RouteEvent`. It finds the candidates whose `filter_types` hold the event's type or `*`, across correlations, trigger workflows and subscriptions. `EventOffers` then writes one outbox message per candidate.
4. **Offers.** Each loads, evaluates its filter through `expressions.evaluateAll(filter.evaluationsFor(event))`, decides and saves:
   - `OfferEvent` → `correlation.offer`;
   - `OfferTrigger` → `assertStartable(epoch)` → `Correlation.forTrigger` → `offer`;
   - `OfferDelivery` → `Delivery.plan`, with a guard for null → `deliveries.add`.
5. **Correlation start.** `ListenStarted` → `StartCorrelation`, which saves the correlation and raises `CorrelationStarted`. After commit, `CatchUpCorrelation` offers every committed event with `accepted_at ≥ since`. Overlap with routing is harmless, because `offer` ignores events already consumed.
6. **Listen.** `EventConsumed` → `ConsumeListenEvent`; `CorrelationCompleted` → `CompleteListen`; `ListenEnded` → `EndCorrelation`.
7. **Delivery.** `DeliveryScheduled` → `DeliverEvent`:
   1. guard if the subscription is gone;
   2. `secretQueries.valuesFor`;
   3. `SubscriberGateway.deliver`;
   4. `delivery.record(attempt, secrets, now)` and save.

   The handler throws while the delivery is pending, so the outbox retries (backoff capped at 60 s).

8. **Detached processes.** `ProcessDetached` → `RunDetachedProcess`, which calls `processRunner.runAll` and ignores the result.

## 7. Schedules, control, sub-workflows

- **Schedules.** `RecurringScheduleSet` → `RegisterRecurringStarts`, which calls `WorkflowSchedules.upsert(workflowId, { workflow: 'scheduled-start', input: { workflowId, epoch }, …, tz: 'UTC', missed: 'once', overlap: 'allow' })`. `RecurringScheduleCleared` → `RemoveRecurringStarts`. `NextStartDue(delay)` is written with the outbox `delay` → `StartScheduledInstance`.
- **Suspend.** No new work. Results in flight are recorded.
- **Resume.** Passed deadlines apply on the next round.
- **Cancel.** Results in flight are discarded. Every abandoned task closes its correlation (`ListenEnded`) or its child (`CancelRequested`). The same happens for timeouts, `compete` losers and caught branches.
- **Sub-workflow.** `SubWorkflowRequested` → `StartSubWorkflow`. The child's `SubWorkflowEnded` → `CompleteSubWorkflow` on the parent. A rejected child starts faulted, so the parent learns through the same path.

## 8. Errors at non-HTTP inbound adapters

| Error                                                        | Outbox handler (`OutboxErrorClassifier`) | `InstanceWorkflow` step            | `ScheduledStartWorkflow` |
| ------------------------------------------------------------ | ---------------------------------------- | ---------------------------------- | ------------------------ |
| NotFoundError, StaleStartError, InvalidControlError          | Acknowledge                              | `fault` step                       | End the run              |
| StaleWriteError, database or network errors, a full bulkhead | Retry                                    | Transient: retry                   | Retry                    |
| Anything else                                                | Dead-letter                              | `fault` → `FaultInstance` (masked) | Fail the run             |

Use cases never catch.

## 9. Guarantees

| Operation           | Transaction                                                                                          | Guarantee                                                                                     |
| ------------------- | ---------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| HTTP command        | `@Transactional`                                                                                     | Atomic; a stale write is a 409                                                                |
| Start               | Insert + run start; derived ids                                                                      | One instance and one run, however often the start is repeated                                 |
| Round               | Begin and save; compute with no transaction; then record, save and add the Events in one transaction | No event without its change; recorded results are never recomputed; work in flight may repeat |
| Wake                | In the change's transaction                                                                          | No lost wakes (proven in S0)                                                                  |
| Reactions           | Outbox + inbox                                                                                       | At least once, with idempotent handlers                                                       |
| Delivery            | Delivery + outbox retries                                                                            | At least once, with a stable id, for 24 hours                                                 |
| Schedule occurrence | Engine lease + occurrence id + epoch + `FOR SHARE`                                                   | Exactly once; at most one missed occurrence                                                   |

## 10. Security

- **Outbound HTTP.** `EndpointDispatcher` (undici, built in `frameworks/undici`) refuses private, loopback and link-local addresses at every connect, redirects included, unless they are allow-listed. It is used for service calls and deliveries.
- **Scripts and shell commands** run only in go-judge:
  - namespaces, cgroups and seccomp;
  - no network;
  - a read-only rootfs with `node` and `python3`, from a pinned custom image;
  - the limits of FR-021, in a temporary directory.

  They receive only the evaluated code, arguments, environment and stdin.

- **jq.** It runs in Piscina workers with a prelude that disables `env`, `$ENV`, `input`, `inputs`, `input_filename`, `debug`, `stderr`, `halt`, `halt_error` and local time. Each evaluation times out after 1 s and terminates its worker. Expressions in data are never evaluated.
- **Secrets.**
  - At rest: AES-256-GCM in the repository (`SECRETS_KEY`).
  - Only the definition's declared names are decrypted, and only for its rounds and deliveries.
  - Values are masked in records, faults, delivery errors and logs.
- **Webhooks.** SHA-256 fingerprints; unknown and deleted tokens give the same 404; rates limited at the gateway.
- **Input.** zod on every body, unknown fields rejected. Documents up to 1 MiB; events and webhook calls up to 256 KiB.

## 11. Conformance harness

- **Runner.** CTK 1.0.3 feature files, copied unchanged into `apps/api/test/conformance/features/`, run by `quickpickle` as a separate Vitest project over HTTP.
- **Stand-ins.** undici `MockAgent` on `EndpointDispatcher` stands in for petstore and httpbin.
- **Isolation.** The database is cleaned per scenario.
- **Contradictions** are recorded (research R16).
