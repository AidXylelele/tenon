# Architecture: Workflow Engine

This document covers structure and behaviour. The model is in [data-model.md](data-model.md) and the decisions in [research.md](research.md).

## 1. Layers and grouping

The dependency rule: frameworks → interface adapters → application → domain (Martin, 2012). One grouping criterion per layer:

| Layer              | Grouped by                                                        | Folders                                                                                                                   |
| ------------------ | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Domain             | Bounded context, then module                                      | `domain/automation/{language, workflows, instances, events, secrets}`                                                     |
| Application        | The same modules, plus `language` for the ports every module uses | `application/automation/{language, workflows, instances, events, secrets}`: use cases, `ports.ts`, `queries.ts`, policies |
| Interface adapters | The external agency they talk to                                  | see below                                                                                                                 |
| Frameworks         | Technology                                                        | `frameworks/{di, http, drizzle, pino, jq, undici, ajv, openworkflowspec}`                                                 |

**Adapters.** Each one converts between the application and one external agency:

| Folder         | Agency                         | Direction  | Contents                                                                                                                                                            |
| -------------- | ------------------------------ | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `http/`        | REST clients                   | In         | Controllers, parsers (DSL body, CloudEvents), zod schemas, presenters, filters                                                                                      |
| `persistence/` | PostgreSQL                     | Out        | Repositories (secrets encrypted at rest), queries, mappers, schema, outbox writers (`DomainEventOutbox`, `OutboxEventOffers`), idempotency store                    |
| `engine/`      | `@nestjs/workflows`            | In and out | `InstanceWorkflow`, `ScheduledStartWorkflow`, `InstanceRounds` (in); `InstanceRunsGateway`, `RecurringStartsGateway` (out)                                          |
| `messaging/`   | Outbox relay                   | In         | One `*OutboxHandler` per domain event, each calling one use case                                                                                                    |
| `documents/`   | DSL documents                  | Out        | `OpenWorkflowDefinitionReader`: turns the client's outcome into the Definition through pure mappers (`mappers/`), or into a refusal                                 |
| `expressions/` | jq                             | Out        | `JqExpressionEvaluator`: syntax checks through `JqClient` (US1); evaluations and pattern matches with the sandbox prelude (US2, US7)                                |
| `json-schema/` | Ajv                            | Out        | `AjvSchemaValidator`                                                                                                                                                |
| `endpoints/`   | HTTP endpoints chosen by users | Out        | `HttpServiceCaller` (DSL `call: http/openapi` with the standard's authentications) and `CloudEventSubscriberGateway` (deliveries), both on the SSRF-safe dispatcher |
| `sandbox/`     | go-judge                       | Out        | `GoJudgeProcessRunner`, `GoJudgeCommand`                                                                                                                            |
| `mailing/`     | SMTP                           | Out        | Unchanged                                                                                                                                                           |

Rules:

- **Shared types.** An adapter folder declares in its `interfaces.ts` and `enums.ts` the client the frameworks provide for it and its simple outcomes: `documents/` has `OpenWorkflowClient`, `DslOutcome` and the standard's document shape (`Dsl.*`); `expressions/` has `JqClient` and `JqCompilation`; `json-schema/` has `JsonSchemaCompilers`; `endpoints/` has `EndpointDispatcher` and its request shapes; `sandbox/` has `SandboxPool`, `SandboxLimits` and the go-judge command shapes. The `interface-adapters/` root keeps only what several adapters share: `Database` and `DrizzleTx`, the outbox payload shapes of the domain events (written by `persistence/`, read by `messaging/`), the `TransientFailures` recognizer that `persistence/` implements, and the `ErrorClassifier` that `engine/` and `messaging/` use (§8).
- **Contracts.** Outbox topics and payloads are the domain events in `domain/automation/*/events.ts`.
- **Isolation.** No adapter folder imports another.

**Naming.** One convention per kind:

| Kind                           | Pattern                                                                                                                                                                                                                                                                                                        |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Controllers                    | `*.controller.ts`                                                                                                                                                                                                                                                                                              |
| Repositories                   | `drizzle-*.repository.ts`                                                                                                                                                                                                                                                                                      |
| Queries                        | `drizzle-*.queries.ts`                                                                                                                                                                                                                                                                                         |
| Stores                         | `drizzle-*.store.ts`                                                                                                                                                                                                                                                                                           |
| Outbox handlers                | `*-outbox.handler.ts`                                                                                                                                                                                                                                                                                          |
| Gateways                       | `*.gateway.ts`                                                                                                                                                                                                                                                                                                 |
| Engine workflows               | `*.workflow.ts`                                                                                                                                                                                                                                                                                                |
| Clocks                         | `*.clock.ts` (`EngineClock` implements the `Clock` port over the engine's `WorkflowClock`)                                                                                                                                                                                                                     |
| Computations                   | `*.reader.ts`, `*.evaluator.ts`, `*.validator.ts`, `*.caller.ts`, `*.runner.ts`                                                                                                                                                                                                                                |
| Document mappers               | `documents/mappers/*.mapper.ts`, static `toDomain`: one-way into value objects; `KnownPropertiesMapper.confirm` refuses what a mapper does not read. Persistence mappers use `toEntity`/`toRow` for aggregates and `toState`/`toDomain` for the value graphs stored as jsonb (`persistence/mappers/progress/`) |
| Library factories (frameworks) | `create*`, for library objects that adapters use as they are                                                                                                                                                                                                                                                   |
| Library clients (frameworks)   | `<mechanism>-<agency>.client.ts` (`sdk-open-workflow`, `in-process-jq`, later `piscina-jq`), behind a client declared in its adapter's `interfaces.ts`; the folder is named after the wrapped library                                                                                                          |

**DI.** `frameworks/di/automation.module.ts` assembles the context. There is one module per library: `engine`, `outbox`, `idempotency`, `resilience` (presets).

**Ports.** Abstract classes in `application/automation/*/ports.ts` and `queries.ts`:

| Module    | Ports                                                                                                                                                          | Queries                                                |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| workflows | WorkflowRepository, WorkflowVersionRepository, RecurringStarts                                                                                                 | WorkflowQueries (lists, documents, trigger candidates) |
| language  | DefinitionReader (document text in, Definition out), ExpressionEvaluator, SchemaValidator (every module uses them, as every module uses the `language` domain) | —                                                      |
| instances | WorkflowInstanceRepository, InstanceRuns, ServiceCaller, ProcessRunner                                                                                         | InstanceQueries (lists, history, progress)             |
| events    | EventRepository, CorrelationRepository, WebhookRepository, SubscriptionRepository, DeliveryRepository, EventOffers, SubscriberGateway                          | EventQueries (candidates, catch-up), ConnectionQueries |
| secrets   | SecretRepository                                                                                                                                               | SecretQueries (`valuesFor`, `namesOwnedBy`)            |

**Time.** A use case reads the clock once per operation through the `Clock` port (`application/automation/language/ports.ts`), which `EngineClock` implements over the engine's `WorkflowClock`, so `ManualWorkflowClock` drives HTTP starts and engine runs alike in tests; the time is then passed as a value. A retry's jitter sample derives from its work id, which is pure and stable on replay. The domain reads no clock.

**Runtime topology.** Every API process runs the same image, and the flags `HTTP`, `ENGINE_WORKER` and `OUTBOX_RELAY` switch its roles. Work is shared through PostgreSQL:

- engine instances: `SKIP LOCKED` with leases;
- outbox messages: fenced leases;
- schedule occurrences: occurrence ids.

go-judge is a separate, stateless service. Both scale by adding processes. The deployment is Compose; a Helm chart comes with the deployment feature.

## 2. Where Synapse's DSL processing lands

| Synapse                                                               | Here                                                                            | Layer           |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------- | --------------- |
| SDK `WorkflowDefinition` executed directly                            | SDK validation, then `DefinitionMapper` → value objects                         | Adapter; domain |
| `TaskExecutor` lifecycle, stages, `GetTaskAfter`, composite executors | `WorkflowInstance`, task kinds, progress objects, `TaskList`                    | Domain          |
| `IExpressionEvaluator` (a jq process per evaluation), recursive `${}` | `ExpressionEvaluator` → `JqClient` (in-process compile; a worker pool from US2) | Port; adapter   |
| `ISchemaHandler`                                                      | `SchemaValidator` → Ajv                                                         | Port; adapter   |
| `HttpCallExecutor`, `OpenApiCallExecutor`, `AuthorizationInfo`        | `ServiceCaller` → `HttpServiceCaller`                                           | Port; adapter   |
| Script and shell executors on the runner host                         | `ProcessRunner` → go-judge, with no network                                     | Port; adapter   |
| `SecretsManager` (files)                                              | `Secret`, encrypted by its repository                                           | Domain; adapter |
| Correlator (regex / `${}`, keys)                                      | `EventFilter` and `Correlation` decide; matching is work                        | Domain          |
| Runner process per instance; Operator timers                          | One engine run per instance; engine schedules                                   | Adapter         |

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

`AdvanceInstance` composes two transactional use cases around the computation, the way `PublishVersion` composes `CheckDocument`. It is not transactional itself, so no transaction stays open across a call:

```text
AdvanceInstance({ instanceId, runtime }):
  now = clock.now()
  { definition, instance } = BeginRound({ instanceId, now, runtime })     // @Transactional
      instance = instances.find(id);  definition = definitions.read(queries.documentOf(instance.versionId))
      instance.beginRound(definition, runtime, now);  instances.save(instance)   // save writes nothing when unchanged
      events.addAll(instance.takeProducedEvents())                               // save writes the domain events to the outbox
  recorded = []
  repeat:                                                    // pure work is never saved on its own
    work = instance.pendingWork(definition, runtime, now)
    if work is empty: stop
    results = { evaluated: expressions.evaluateAll(work.evaluations), validated: schemas.validateAll(work.validations),
                responses: services.callAll(work.calls), processes: processes.runAll(work.processes) }
    instance.record(results, definition, runtime, now);  recorded.push(results)
    if work.endsRound(): stop                                 // it had calls or processes
  if recorded is not empty: RecordRound({ instanceId, recorded, definition, runtime, now })   // @Transactional
      current = instances.find(id);  for each results of recorded: current.record(…)
      instances.save(current);  events.addAll(current.takeProducedEvents())
  return { progress: current.progress(now), deferred: work the outside did not start }
```

`runtime` (`$runtime`: name, version) is configuration, passed as a value like the time.

- A round saves at the boundaries of side effects: a call, a process, a sub-workflow, parking, the end. Expressions and schemas are pure and run in process, so a crash only computes them again; one HTTP task costs one round instead of one per stage. `RecordRound` replays the recorded results on the instance it reloads. Work ids are positional (a task's id derives from the instance id and its execution number), so nothing outside the run changes task state between the two transactions: other writers (a listen's event in US7, a sub-workflow's start) only signal the run, which records the change in its own step, as `StartSubWorkflow` and `CompleteSubWorkflow` do. A cancel is the one exception, and it discards the round.
- **Capacity is data.** `ServiceCaller.callAll` and `ProcessRunner.runAll` take one bulkhead slot per item and return no result for an item the full bulkhead rejected, so the accepted results are kept, the rejected work stays pending in the domain, and `AdvanceInstance` reports how much it deferred.
- The engine run follows the returned progress; no separate query is needed.
- Secrets join the round with US8: their values are read once per round and passed as a value to `beginRound`, `record` and the computations that need them.
- Adapters log work ids, never payloads. Handlers and gateways throw fixed texts, never response bodies.

## 4. The engine loop

```text
@Workflow('instance', { version: 1 })
run(ctx, { instanceId }):
  started = the handles of the sub-workflows this run started (rebuilt on every replay)
  busy = 1 s
  for round = 1, 2, …:
    try
      progress = ctx.step("advance-" + round, rounds.untilParked(instanceId, started.ids),
                          round = 1: { compensate: FaultInstance({ instanceId }) })
      if progress.kind = ended: return
      for each id of progress.subWorkflows not in started:
        exists = ctx.step("start-" + id, StartSubWorkflow({ instanceId, subWorkflowId: id }))
        if exists: started[id] = ctx.startChild(InstanceWorkflow, { instanceId: id }, { id, parentClose: 'abandon' })
      if a sub-workflow was started: continue
      if progress.kind = busy: ctx.sleep("busy-" + round, busy); busy = min(2 × busy, 30 s); continue
      busy = 1 s
      if progress.kind = run: continue
      winner = ctx.waitForAny("park-" + round, { timer: ctx.timer({ until: progress.wakeAt }) when set, each started handle })
      if winner is a sub-workflow:
        remove it from started
        ctx.step("ended-" + round, CompleteSubWorkflow({ instanceId, subWorkflowId: winner.key }))
    catch (error)
      if isWorkflowInterrupt(error): throw error
      ctx.step("fault-" + round, FaultInstance({ instanceId })); return
```

**Constraints:**

- **Explicit flow, with the engine's children.** Sub-workflows are steps of the parent's run, not domain events (Khorikov, "Domain events: simple and reliable solution": events only for what leaves the application). The run follows the engine's own pattern: a step creates the child instances (`StartSubWorkflow`) and returns their ids, and `run()` starts each with `ctx.startChild` ("Start the child from run(), and pass it what the step returned"). The engine journals every start, so a replay gets the same child back. A child's end needs no step of the child: the engine writes the end and a signal to the parent in one transaction ("a parent never misses its child's end"), and the parent's `waitForAny` takes the child's handle.
- **Which sub-workflows.** `progress.subWorkflows` lists, from persisted state, the derived ids of the sub-workflow instances the awaiting `run: workflow` tasks need. One step per id runs `StartSubWorkflow`, which saves one aggregate (the sub-workflow, or the parent when the target is missing) and answers whether the instance exists, whether this attempt created it or an earlier one did; so a crash between its commit and its journal entry loses nothing, and the run starts only the ids it has not started. `untilParked` stops after a round that awaits a sub-workflow the run has not started, so a sub-workflow never waits for other branches.
- **The step's result.** `ctx.step` journals its value as JSON, so `InstanceRounds` maps the use case's result inside the step to its own `RoundProgress` (`engine/interfaces.ts`): `kind` (run, park, busy or ended), `wakeAt` as epoch milliseconds, and the sub-workflow ids. `busy` is the engine's word for deferred work and stays out of the domain.
- **`parentClose: 'abandon'`.** The engine never cancels a child behind the domain's back. Until US9, a child whose task ended early runs to its end and `CompleteSubWorkflow` ignores it; US9 cancels it through `CancelInstance`.
- **A child run that fails.** A faulted child instance ends its run normally. Only a run that fails in the engine (its own fault step failed) throws `ChildWorkflowFailedError` from `waitForAny`, and the parent faults as after any failed step.
- **A run the engine fails.** The journal limit, the run timeout or a failed fault step end the run as `failed` before it can record a new step, so the first step registers `FaultInstance` as its compensation ("Compensations may still record theirs"). `FaultInstance` does nothing to a terminal instance. The `catch` rethrows `WorkflowInterrupt` ("must rethrow").
- **Errors inside a step.** A failed step comes back from the journal as `StepFailedError`, without its class. So `ErrorClassifier` runs inside the step: it rethrows transient errors for a retry and turns the rest into `NonRetryableStepError`. A `NotFoundError` ends the run.

- **Round budget.** `untilParked` repeats rounds within a budget of 10 s. One round's caps add up to about 66 s:
  - evaluations 1 s;
  - calls 30 s;
  - processes 30 s + 5 s.
- **Lease.** `leaseDuration` is 120 s, and the worker heartbeat (every 40 s) renews it during a step. S0 proves both the renewal and that a `signal` sent during `advance-N` is consumed by `park-N`.
- **Bulkheads** reject when full, so they never queue past the lease. A full bulkhead never faults an instance: the rejected work gets no result and stays pending (§3), `untilParked` returns `busy` when a round deferred work, and the run sleeps 1 s doubling to 30 s, so capacity delays a `fork` of 65 calls instead of failing it.
- **Journal.** Each park costs two entries (the round and the wait), and each child two more (its start and the step that records its end). The accepted default of 10,000 entries therefore allows about 5,000 parks.

**Gateways and wakes:**

- `InstanceRuns.start` runs inside the caller's transaction (the engine's `transaction` option, with `TransactionHost.tx`) and is idempotent by id. `wake`, and the wake signal in the parent's wait, arrive with their senders.
- `RecurringStarts.register` and `remove` call `WorkflowSchedules.upsert` and `remove`.
- Wakes are sent by `CompleteListen`, `ConsumeListenEvent` (US7), `SuspendInstance`, `ResumeInstance` and `CancelInstance` (US9). A child's end needs no wake.

## 5. Starts

Every non-HTTP start derives its id, so a repeated message finds the instance and returns at a guard:

| Use case                                                                  | Id                                                                                    | Steps                                                                                                                                                                                                                                                                                                     |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `StartInstance` (HTTP, `@Transactional`; `@Idempotent` on the controller) | UUIDv5 of the user, the workflow and the `Idempotency-Key`, when given; otherwise new | version → id → guard (exists: return it, so a repeat after a crash gets the instance, not a 409) → `WorkflowInstance.start` → save → `InstanceRuns.start`                                                                                                                                                 |
| `StartScheduledInstance(workflowId, epoch, occurrence)`                   | `workflowId` + occurrence (or previous instance id)                                   | guard (exists) → `workflows.getForStart` (`FOR SHARE`) → `assertStartable(epoch)` → the same steps                                                                                                                                                                                                        |
| `StartTriggeredInstance`                                                  | correlation context id                                                                | the same steps, with the consumed events as input                                                                                                                                                                                                                                                         |
| `StartSubWorkflow({ instanceId, subWorkflowId })`                         | parent id + task instance id (derived in the domain)                                  | guard (exists: true) → the parent's request for that id (none: false) → target (`latest` resolved) → `WorkflowInstance.startSubWorkflow(…)` → save it; a missing target → `parent.refuseSubWorkflow(…)` → save the parent → false. It runs in the parent's own run, so it never races the parent's rounds |
| `StartDetachedWorkflow` (outbox)                                          | the id `WorkflowDetached` carries                                                     | guard (exists) → target → `WorkflowInstance.start` with a `ParentOrigin` → save → `InstanceRuns.start`; a missing target is acknowledged, because the detached task has already completed                                                                                                                 |

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

8. **Detached processes.** `ProcessDetached` carries the `ProcessRun` → `RunDetachedProcess`, which calls `processRunner.runAll` and ignores the result.

## 7. Schedules, control, sub-workflows

- **Schedules.** `RecurringScheduleSet` → `RegisterRecurringStarts`, which calls `WorkflowSchedules.upsert(workflowId, { workflow: 'scheduled-start', input: { workflowId, epoch }, …, tz: 'UTC', missed: 'once', overlap: 'allow' })`. `RecurringScheduleCleared` → `RemoveRecurringStarts`. `NextStartDue(delay)` is written with the outbox `delay` → `StartScheduledInstance`.
- **Suspend.** No new work. Results in flight are recorded.
- **Resume.** Passed deadlines apply on the next round.
- **Cancel.** Results in flight are discarded. Every abandoned task closes its correlation (`ListenEnded`) or its child (`CancelRequested`). The same happens for timeouts, `compete` losers and caught branches.
- **Sub-workflow.** A step of the parent's run creates the children (`StartSubWorkflow`), and the run starts them with `ctx.startChild`. The engine tells the parent's run when a child ends, and its next step records the end (`CompleteSubWorkflow`). A child whose input breaks its schema faults in its first round, so the parent learns through the same path.

## 8. Errors at non-HTTP inbound adapters

| Error                                                            | Outbox handler | `InstanceWorkflow` step                                   | `ScheduledStartWorkflow` |
| ---------------------------------------------------------------- | -------------- | --------------------------------------------------------- | ------------------------ |
| NotFoundError, StaleStartError, InvalidControlError              | Acknowledge    | End the run                                               | End the run              |
| StaleWriteError, a transient PostgreSQL failure, a network error | Retry          | Transient: retry (a full bulkhead is data, §3)            | Retry                    |
| Anything else                                                    | Dead-letter    | `NonRetryableStepError` → `FaultInstance({ instanceId })` | Fail the run             |

Use cases never catch. Some transient PostgreSQL failures surface outside repository code (a pool connection, `BEGIN` and `COMMIT` in `@Transactional`, the engine's insert in the caller's transaction), so translating them in the repositories would leave holes. Instead one owner recognizes them wherever they surface: `TransientFailures`, declared at the `interface-adapters/` root and implemented in `persistence/` (SQLSTATE classes 08, 40, 53 and 57 and pool timeouts, found through `cause`). The `ErrorClassifier` (`interface-adapters/error-classifier.ts`) asks it and classifies inner error classes into settled, transient or permanent; `engine/` and `messaging/` map that to their library's answer. The classification runs inside each step, because the engine's journal keeps no error class, and `FaultInstance` takes only the instance id, so no framework data reaches the use case.

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

- **jq.** Publishing only compiles expressions. From US2, evaluations run in Piscina workers (`frameworks/jq`), with the evaluator's prelude that disables `env`, `$ENV`, `input`, `inputs`, `input_filename`, `debug`, `stderr`, `halt`, `halt_error` and local time. Each evaluation times out after 1 s and terminates its worker. Expressions in data are never evaluated.
- **Secrets.**
  - At rest: AES-256-GCM in the repository (`SECRETS_KEY`).
  - Only the definition's declared names are decrypted, and only for its rounds and deliveries.
  - Values are masked in records, faults, delivery errors and logs.
- **Webhooks.** SHA-256 fingerprints; unknown and deleted tokens give the same 404; rates limited at the gateway.
- **Input.** zod on every body, query and path, unknown fields rejected. Documents up to 1 MiB, read as text only on the two document routes; events and webhook calls up to 256 KiB; the default limit everywhere else.

## 11. Conformance harness

- **Runner.** CTK 1.0.3 feature files, copied unchanged into `apps/api/test/conformance/features/`, run by `quickpickle` as a separate Vitest project over HTTP.
- **Stand-ins.** undici `MockAgent` on `EndpointDispatcher` stands in for petstore and httpbin.
- **Isolation.** The database is cleaned per scenario.
- **Contradictions** are recorded (research R16).
