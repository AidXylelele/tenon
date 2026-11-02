# Architecture: Workflow Engine

This document covers structure and behaviour. The model is in [data-model.md](data-model.md) and the decisions in [research.md](research.md).

## 1. Layers and grouping

The dependency rule: frameworks → interface adapters → application → domain (Martin, 2012). One grouping criterion per layer:

| Layer              | Grouped by                                                        | Folders                                                                                                                   |
| ------------------ | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Domain             | Bounded context, then module                                      | `domain/automation/{language, workflows, instances, events, secrets}`                                                     |
| Application        | The same modules, plus `language` for the ports every module uses | `application/automation/{language, workflows, instances, events, secrets}`: use cases, `ports.ts`, `queries.ts`, policies |
| Interface adapters | Purpose                                                           | see below                                                                                                                 |
| Frameworks         | The tool the code drives (a library or an external service)       | see below                                                                                                                 |

**The split between adapters and frameworks** (Martin, 2012: "the interface adapters convert data from the format most convenient for the use cases and entities to the format most convenient for some external agency"; the frameworks are "glue code"):

- **Adapters map.** An adapter turns domain values and use-case results into the shapes of an external agency and back. It never creates a library object, applies a resilience preset, classifies an error or decides a retry. Its IO goes through a client from `frameworks/`; the persistence group is the one gateway that speaks its agency's language itself (Martin: "all the SQL should be restricted to this layer"): repositories build queries on the injected Drizzle client and translate their own constraint conflicts (a unique violation into `StaleWriteError`), while the driver, the pool and the classification of transient failures stay in `frameworks/`.
- **Frameworks hold the libraries.** Library instances, client implementations, resilience presets, error parsing and classification, the engine's run loop and the outbox's error policy live in `frameworks/`. A client implements a contract its adapter group declares in `interfaces.ts` and answers with simple outcomes discriminated by `kind`, so the adapter maps an outcome instead of catching an error.
- **Inbound glue calls controllers.** An HTTP route, an engine step and an outbox message reach the application through a controller in the adapters, which maps the input to a command and the result to the glue's shape. The glue around it (the `@Workflow` loop, the `@OnOutboxMessage` handlers) is in `frameworks/`.

**Adapters.** Grouped by purpose:

| Folder                   | Purpose                                     | Contents                                                                                                                                                              |
| ------------------------ | ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `api/`                   | The REST API                                | Controllers, parsers (DSL body), zod schemas, presenters (the CloudEvent JSON format of lifecycle events, its 64 KiB rule), filters, middleware, `auth/`              |
| `persistence/`           | PostgreSQL                                  | Repositories (they write domain events to the outbox), queries, stores, mappers, schema, `Database` and `DrizzleTx`                                                   |
| `messaging/`             | Domain events delivered by the outbox relay | One `*.controller.ts` per domain event: the payload → a command → one use case                                                                                        |
| `mailing/`               | Mail                                        | `MailGateway` and the templates                                                                                                                                       |
| `sandbox/`               | The go-judge sandbox                        | `SandboxGateway` (`ProcessRunner`): a `ProcessRun` → a go-judge command → a `ProcessResult`, through `SandboxClient`                                                  |
| `workflows/definitions/` | DSL documents                               | `OpenWorkflowDefinitionReader`: the client's outcome → the Definition through pure mappers, or a refusal                                                              |
| `workflows/expressions/` | jq                                          | `JqExpressionEvaluator`: compilations and evaluations through `JqClient`; a program's outputs → one value or an expression failure                                    |
| `workflows/schemas/`     | JSON Schema                                 | `JsonSchemaValidator`: a `Validation` → `JsonSchemaClient` → `Validated` or `ValidationFailed`                                                                        |
| `workflows/services/`    | HTTP endpoints chosen by authors            | `ServiceCallGateway` (`ServiceCaller`): `call: http` and `openapi` → requests and authorizations for `EndpointClient` → `ServiceResult`; later the subscriber gateway |
| `workflows/runs/`        | The durable engine                          | `InstanceRunController` (an engine step → a use case → `RoundProgress`), `InstanceRunsGateway` (`InstanceRuns` → `RunClient`), `EngineClock`                          |

**Frameworks.** Grouped by the tool the code drives. A tool is a library or an external service: two tools never share a folder, even when one uses the other (the go-judge client sends its requests with undici, yet go-judge is not the endpoints authors call).

| Folder              | Tool                                     | Contents                                                                                                                                                                                                                           |
| ------------------- | ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `di/`               | Nest's container                         | Nest modules; `automation.module.ts` assembles the context, one module per library (`engine`, `outbox`, `idempotency`, `resilience` presets)                                                                                       |
| `express/`          | The HTTP server                          | `configureHttpApp` (prefix, CSRF, trusted proxies, the document body parser)                                                                                                                                                       |
| `pino/`             | The logger                               | The HTTP logger options                                                                                                                                                                                                            |
| `swagger/`          | The OpenAPI document                     | `createOpenApiDocument` and `serveOpenApi`, which `main.ts` calls and a test builds                                                                                                                                                |
| `drizzle/`          | PostgreSQL through Drizzle               | `createDatabase` (`database.ts`); `PostgresTransientFailures` (SQLSTATE classes 08, 40, 53, 57 and pool timeouts, found through `cause`)                                                                                           |
| `resilience/`       | Transient-fault handling                 | `ErrorClassifier` (§8): settled, transient or permanent, shared by the engine's steps and the outbox handlers                                                                                                                      |
| `workflows/`        | The durable engine (`@nestjs/workflows`) | `InstanceWorkflow` (the `@Workflow` loop of §4, its retry options and the classification of step errors), `EngineRunClient` (`RunClient`, in the caller's transaction)                                                             |
| `outbox/`           | The outbox (`@nestjs/outbox`)            | The `@OnOutboxMessage` handlers, each calling one `messaging/` controller, and `OutboxErrors` (settled → acknowledge, transient → retry, else `NonRetryableMessageError`); `MailOutboxHandler` (the SMTP send)                     |
| `mail/`             | Mail (`@nestjs/mail`)                    | `OutboxMailTransport` (a rendered mail → the outbox) and the stored mail shape                                                                                                                                                     |
| `openworkflowspec/` | The Open Workflow SDK                    | `SdkOpenWorkflowClient` (`OpenWorkflowClient`): `sdk.worker.ts` reads documents on a `WorkerPool` (the 2 s `documents` preset, a 256 MB heap)                                                                                      |
| `jq/`               | jq (jq-wasm)                             | `PiscinaJqClient` (`JqClient`): the sandbox prelude, the program wrapper and jq's answers, on a `WorkerPool` of a worker per engine slot plus one (the 1 s `jq` preset); `jq.worker.ts` runs jq-wasm and reloads it after an abort |
| `ajv/`              | JSON Schema (Ajv)                        | `AjvJsonSchemaClient` (`JsonSchemaClient`) on a `WorkerPool` (the 1 s `schemas` preset); `ajv.worker.ts` holds one Ajv per draft (`addUsedSchema: false`, no `allErrors`) and a bounded cache of compiled schemas                  |
| `undici/`           | The endpoints authors call (undici)      | `EndpointDispatcher` and `AddressPolicy` (SSRF-safe), `UndiciEndpointClient` (`EndpointClient`: requests, OAuth2/OIDC tokens, OpenAPI documents, limits, the `service-calls` preset)                                               |
| `go-judge/`         | The go-judge sandbox                     | `GoJudgeSandboxClient` (`SandboxClient`: `POST /run`, the `processes` preset, its outcomes), `SandboxPool` (the sandbox's own connection pool with the bearer token)                                                               |
| `piscina/`          | Worker threads (Piscina)                 | `WorkerPool`: a pool whose runs a resilience preset bounds; a time-out terminates the worker and a worker past its heap ends, answered as `done`, `timed-out` or `exhausted`                                                       |

Rules:

- **Shared types.** An adapter folder declares in its `interfaces.ts` and `enums.ts` the client the frameworks provide for it, its simple outcomes and its data shapes. The `interface-adapters/` root keeps only what `persistence/` writes and `messaging/` reads: the outbox topics and payload shapes of the domain events.
- **Contracts.** Outbox topics and payloads are the domain events in `domain/automation/*/domain-events/`.
- **Isolation.** No adapter folder imports another, and no adapter imports `frameworks/`.

**Naming.** One convention per kind:

| Kind                          | Pattern                                                                                                                                                                                                                                                                                                                             |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Controllers (inbound)         | `*.controller.ts`: HTTP routes, engine steps, outbox messages                                                                                                                                                                                                                                                                       |
| Presenters                    | `*.presenter.ts`                                                                                                                                                                                                                                                                                                                    |
| Gateways (outbound services)  | `*.gateway.ts`: the engine, the sandbox, service endpoints, mail, sessions                                                                                                                                                                                                                                                          |
| Repositories                  | `drizzle-*.repository.ts`                                                                                                                                                                                                                                                                                                           |
| Queries                       | `drizzle-*.queries.ts`                                                                                                                                                                                                                                                                                                              |
| Stores                        | `drizzle-*.store.ts`                                                                                                                                                                                                                                                                                                                |
| Computations (in process)     | `*.reader.ts`, `*.evaluator.ts`, `*.validator.ts`                                                                                                                                                                                                                                                                                   |
| Clocks                        | `*.clock.ts` (`EngineClock` implements the `Clock` port over the engine's time source)                                                                                                                                                                                                                                              |
| Mappers                       | `mappers/*.mapper.ts`, static and pure. Document mappers use `toDomain`, one-way into value objects; `KnownPropertiesMapper.confirm` refuses what a mapper does not read. Persistence mappers use `toEntity`/`toRow` for aggregates and `toState`/`toDomain` for the value graphs stored as jsonb (`persistence/mappers/progress/`) |
| Engine workflows (frameworks) | `*.workflow.ts`                                                                                                                                                                                                                                                                                                                     |
| Outbox handlers (frameworks)  | `*-outbox.handler.ts`                                                                                                                                                                                                                                                                                                               |
| Library clients (frameworks)  | `<mechanism>-<agency>.client.ts` (`sdk-open-workflow`, `piscina-jq`, `ajv-json-schema`, `undici-endpoint`, `go-judge-sandbox`, `engine-run`), behind a client declared in its adapter's `interfaces.ts`                                                                                                                             |

**Ports.** Abstract classes in `application/automation/*/ports.ts` and `queries.ts`:

| Module    | Ports                                                                                                                                                          | Queries                                                |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| workflows | WorkflowRepository, WorkflowVersionRepository, RecurringStarts                                                                                                 | WorkflowQueries (lists, documents, trigger candidates) |
| language  | DefinitionReader (document text in, Definition out), ExpressionEvaluator, SchemaValidator (every module uses them, as every module uses the `language` domain) | —                                                      |
| instances | WorkflowInstanceRepository, InstanceRuns, ServiceCaller, ProcessRunner                                                                                         | InstanceQueries (lists, history, progress)             |
| events    | EventRepository, CorrelationRepository, WebhookRepository, SubscriptionRepository, DeliveryRepository, EventOffers, SubscriberGateway                          | EventQueries (candidates, catch-up), ConnectionQueries |
| secrets   | SecretRepository                                                                                                                                               | SecretQueries (`valuesFor`, `namesOwnedBy`)            |

**Time.** A use case reads the clock once per operation through the `Clock` port, except `AdvanceInstance`, which reads it as each answer arrives, so results, deadlines and lifecycle times carry the time they happened (`application/automation/language/ports.ts`), which `EngineClock` implements over the engine's time source, so `ManualWorkflowClock` drives HTTP starts and engine runs alike in tests; the time is then passed as a value. A retry's jitter sample derives from its work id, which is pure and stable on replay. The domain reads no clock.

**Runtime topology.** Every API process runs the same image, and the flags `HTTP`, `ENGINE_WORKER` and `OUTBOX_RELAY` switch its roles. Work is shared through PostgreSQL:

- engine instances: `SKIP LOCKED` with leases;
- outbox messages: fenced leases;
- schedule occurrences: occurrence ids.

go-judge is a separate, stateless service. Both scale by adding processes. The deployment is Compose; a Helm chart comes with the deployment feature.

## 2. Where Synapse's DSL processing lands

| Synapse                                                               | Here                                                                         | Layer                    |
| --------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ------------------------ |
| SDK `WorkflowDefinition` executed directly                            | SDK validation, then `DefinitionMapper` → value objects                      | Adapter; domain          |
| `TaskExecutor` lifecycle, stages, `GetTaskAfter`, composite executors | `WorkflowInstance`, task kinds, progress objects, `TaskList`                 | Domain                   |
| `IExpressionEvaluator` (a jq process per evaluation), recursive `${}` | `ExpressionEvaluator` → `JqExpressionEvaluator` → `PiscinaJqClient`          | Port; adapter; framework |
| `ISchemaHandler`                                                      | `SchemaValidator` → `JsonSchemaValidator` → `AjvJsonSchemaClient`            | Port; adapter; framework |
| `HttpCallExecutor`, `OpenApiCallExecutor`, `AuthorizationInfo`        | `ServiceCaller` → `ServiceCallGateway` → `UndiciEndpointClient`              | Port; adapter; framework |
| Script and shell executors on the runner host                         | `ProcessRunner` → `SandboxGateway` → `GoJudgeSandboxClient`, with no network | Port; adapter; framework |
| `SecretsManager` (files)                                              | `Secret`, encrypted by its repository                                        | Domain; adapter          |
| Correlator (regex / `${}`, keys)                                      | `EventFilter` and `Correlation` decide; matching is work                     | Domain                   |
| Runner process per instance; Operator timers                          | One engine run per instance; engine schedules                                | Framework; adapter       |

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
  { context, instance } = BeginRound({ instanceId, now, runtime })        // @Transactional
      instance = instances.get(id);  definition = definitions.read(queries.documentOf(instance.versionId))
      context = RoundContext(definition, runtime, now)
      instance.beginRound(context);  instances.save(instance)                  // save writes nothing when unchanged
      events.addAll(instance.takeProducedEvents())                               // save writes the domain events to the outbox
  recorded = []
  repeat:                                                    // pure work is never saved on its own
    work = instance.pendingWork(context)                      // at most one context export per pass
    if work is empty: stop
    for each answer of WorkAnswers.inArrivalOrder(work):     // expressions and schemas together, then each
      context = context.at(clock.now())                      // call and process as it ends
      instance.record(answer.results, context);  recorded.push({ answer.results, at: context.now })
    if work.endsRound(): stop                                 // it had calls or processes
  if recorded is not empty: RecordRound({ instanceId, round, context, recorded })   // @Transactional
      current = instances.get(id);  for each { results, at } of recorded: current.record(results, context.at(at))
      instances.save(current);  events.addAll(current.takeProducedEvents())
  return { progress: current.progress(context.now), deferred: work the outside did not start }
```

`runtime` (`$runtime`: name, version) is configuration, passed as a value like the time.

- A round saves at the boundaries of side effects: a call, a process, a sub-workflow, parking, the end. Expressions and schemas are pure and run in process, so a crash only computes them again; one HTTP task costs one round instead of one per stage. `RecordRound` replays the recorded results on the instance it reloads. Work ids are positional (a task's id derives from the instance id and its execution number), so nothing outside the run changes task state between the two transactions: other writers (a listen's event in US7, a sub-workflow's start) only signal the run, which records the change in its own step, as `StartSubWorkflow` and `CompleteSubWorkflow` do. A cancel is the one exception, and it discards the round.
- **Fencing.** `beginRound` counts the round, and `RecordRound` records only into the round that produced the results (`confirmRound`): a worker that resumes after it lost its lease meets `StaleRoundError`, which ends its step, and the worker that took over decides.
- **Arrival order.** `WorkAnswers` (an application service over the four computation ports) yields a pass's answers as they arrive: expressions and schemas together, then each call and process. The instance records each at its time, so the first `compete` branch to finish wins; the round still waits for the losers' calls, which the platform cannot interrupt, before it saves.
- **Deadlines in flight.** A call or process carries the earliest deadline of its task and the tasks around it (the workflow's included). The gateways turn it into a budget (`Clock.remainingUntil`): undici gets an abort signal, go-judge a smaller `clockLimit`, and work whose deadline already passed is not sent. Before each answer is recorded the instance fires every deadline elapsed by its time (`#expire`), so an answer that came too late is a time-out and a workflow timeout interrupts a call in progress.
- **Limits.** An instance faults with a runtime error at the task that would start its 10,001st task execution (the default of the spec's Assumptions). Task and event rows are written in batches of 1,000, under PostgreSQL's 65,535 parameters per statement.
- **Capacity is data.** `ServiceCaller.callAll` and `ProcessRunner.runAll` take one bulkhead slot per item and return no result for an item the full bulkhead rejected, so the accepted results are kept, the rejected work stays pending in the domain, and `AdvanceInstance` reports how much it deferred.
- The engine run follows the returned progress; no separate query is needed.
- Secrets join the round with US8: their values are read once per round and passed as a value to `beginRound`, `record` and the computations that need them.
- Adapters log work ids, never payloads. Handlers and gateways throw fixed texts, never response bodies.

## 4. The engine loop

The loop is framework glue (`frameworks/workflows/instance.workflow.ts`); every step calls `InstanceRunController` (`workflows/runs/`), which maps the run's ids to a command and the use case's result to a JSON value the journal keeps.

```text
@Workflow('instance', { version: 1 })
run(ctx, { instanceId }):
  run = RunState(instanceId)            // attempted ids, awaited children, the busy pause; rebuilt on every replay
  for round = 1, 2, …:
    try
      progress = step("advance-" + round, untilParked(run), round = 1: compensate: controller.fault(instanceId))
      if progress is settled or progress.kind = ended: return
      requested = run.unattempted(progress.subWorkflows)
      if requested: for each id: run.attempt(id)                                   // #startAll
                      started = step("start-" + id, controller.startSubWorkflow(instanceId, id))
                      if started is settled: return
                      if started = started: run.await(id, ctx.startChild(InstanceWorkflow, { instanceId: id }, { id, parentClose: 'abandon' }))
                    continue
      if progress.kind = busy: ctx.sleep("busy-" + round, run.busy()); continue     // 1 s doubling to 30 s
      run.rested()
      if progress.kind = run: continue
      winner = ctx.waitForAny("park-" + round, run.conditions(progress.wakeAt))     // the timer and each awaited child
      if run.ended(winner.key): step("ended-" + round, controller.completeSubWorkflow(instanceId, winner.key))
    catch (error)
      if isWorkflowInterrupt(error): throw error
      step("fault-" + round, controller.fault(instanceId)); return

step(name, work): ctx.step(name, classified(work), { retry: 10 attempts, 1 s doubling to 1 min })   // the one owner

untilParked(run):                                            // inside one step, within a 10 s budget
  repeat: progress = controller.advance(instanceId)
          stop unless progress.kind = run, it lists no unattempted id, the budget lasts and the step's signal holds
```

**Constraints:**

- **Explicit flow, with the engine's children.** Sub-workflows are steps of the parent's run, not domain events (Khorikov, "Domain events: simple and reliable solution": events only for what leaves the application). The run follows the engine's own pattern: a step creates the child instance (`StartSubWorkflow`) and answers what happened, and `run()` starts the child with `ctx.startChild` ("Start the child from run(), and pass it what the step returned"). The engine journals every start, so a replay gets the same child back. A child's end needs no step of the child: the engine writes the end and a signal to the parent in one transaction ("a parent never misses its child's end"), and the parent's `waitForAny` takes the child's handle.
- **Which sub-workflows.** `progress.subWorkflows` lists, from persisted state, the derived ids of the sub-workflows the `run: workflow` tasks have requested, awaited or not. One step per id runs `StartSubWorkflow`, which saves one aggregate and answers with a named outcome: `started` (the awaited child exists, whether this attempt created it or an earlier one did) or `answered` (the parent's task took the answer itself: it faulted on a missing target, or, not awaited, it completed and raised `WorkflowDetached` with the resolved version; or an earlier attempt answered it). The step asks the parent's request first and the child's existence second, so a repeated step for a detached request whose child the outbox already started still answers `answered`. `parent.answerSubWorkflow(…)` decides, and returns the child to save when there is one. An id is stepped once per run (`attempted`), so a step name is never used twice, whatever the child's end. `untilParked` stops after a round that lists an id the run has not stepped, so a sub-workflow never waits for other branches.
- **The step's result.** `ctx.step` journals its value as JSON, so the controller maps the use case's result to `RoundProgress` (`workflows/runs/interfaces.ts`): `kind` (run, park, busy or ended; ended wins over busy), `wakeAt` as epoch milliseconds, and the sub-workflow ids. `busy` is the engine's word for deferred work and stays out of the domain.
- **`parentClose: 'abandon'`.** The engine never cancels a child behind the domain's back. Until US9, a child whose task ended early runs to its end and `CompleteSubWorkflow` ignores it; US9 cancels it through `CancelInstance`.
- **A child run that fails.** A faulted child instance ends its run normally. Only a run that fails in the engine (its own fault step failed) throws `ChildWorkflowFailedError` from `waitForAny`, and the parent faults as after any failed step.
- **A park with nothing to wait for** is a broken invariant: the engine refuses an empty `waitForAny`, and the parent faults. Waits for listens and controls arrive with US7 and US9.
- **A run the engine fails.** The journal limit, the run timeout or a failed fault step end the run as `failed` before it can record a new step, so the first step registers the fault as its compensation ("Compensations may still record theirs"). `FaultInstance` does nothing to a terminal instance. The `catch` rethrows `WorkflowInterrupt` ("must rethrow").
- **Errors inside a step.** A failed step comes back from the journal as `StepFailedError`, without its class. So every step, the fault and the compensation included, runs its controller call through `StepErrors` (`frameworks/workflows`), which asks `ErrorClassifier`: a settled error becomes the value `null` and ends the run, a transient one is rethrown for the step's retry, and the rest become `NonRetryableStepError`.
- **Retries (`STEPS`).** 10 attempts, 1 s doubling to 1 min with equal jitter, for every step the fault step included, so a PostgreSQL failover of several minutes delays an instance instead of faulting it or leaving it without a run.
- **Round budget.** `untilParked` repeats rounds within a budget of 10 s. One round's caps add up to about 66 s:
  - evaluations 1 s;
  - calls 30 s;
  - processes 30 s + 5 s.
- **Lease.** `leaseDuration` is 120 s, and the worker heartbeat (every 40 s) renews it during a step. S0 proves both the renewal and that a `signal` sent during `advance-N` is consumed by `park-N`.
- **Bulkheads** reject when full, so they never queue past the lease. A full bulkhead never faults an instance: the rejected work gets no result and stays pending (§3), the controller returns `busy` when a round deferred work, and the run sleeps 1 s doubling to 30 s, so capacity delays a `fork` of 65 calls instead of failing it.
- **Journal.** Each park costs two entries (the round and the wait), and each awaited child three more (its start step, `$child:` and the step that records its end). The accepted default of 10,000 entries therefore allows about 5,000 parks.

**Gateways and wakes:**

- `InstanceRuns.start` runs inside the caller's transaction (`EngineRunClient` passes `TransactionHost.tx` as the engine's `transaction` option) and is idempotent by id.
- `RecurringStarts.register` and `remove` call `WorkflowSchedules.upsert` and `remove`.
- Wakes, and the signal condition in the parent's wait, arrive with their senders: `CompleteListen`, `ConsumeListenEvent` (US7), `SuspendInstance`, `ResumeInstance` and `CancelInstance` (US9). A child's end needs no wake.

## 5. Starts

Every non-HTTP start derives its id, so a repeated message finds the instance and returns at a guard:

| Use case                                                                  | Id                                                                                                                                                                                                                                                                                                              | Steps                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `StartInstance` (HTTP, `@Transactional`; `@Idempotent` on the controller) | UUIDv5 of the user, the workflow and the start key, when an `Idempotency-Key` is given; otherwise new. The API derives the start key from the `Idempotency-Key` and a fingerprint of the requested version and input, so a key repeated after the interceptor's 24 h with another request starts a new instance | `workflows.findByName` → `versions.findBy(VersionReference.forTarget(workflow, target))` → id → guard (exists: return it, so a repeat after a crash gets the instance, not a 409) → `WorkflowInstance.start` → save → `InstanceRuns.start`                                                                                                                                                                                                                                                                                                                                                                                              |
| `StartScheduledInstance(workflowId, epoch, occurrence)`                   | `workflowId` + occurrence (or previous instance id)                                                                                                                                                                                                                                                             | guard (exists) → `workflows.getForStart` (`FOR SHARE`) → `assertStartable(epoch)` → the same steps                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `StartTriggeredInstance`                                                  | correlation context id                                                                                                                                                                                                                                                                                          | the same steps, with the consumed events as input                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `StartSubWorkflow({ instanceId, subWorkflowId })`                         | parent id + task instance id (derived in the domain)                                                                                                                                                                                                                                                            | the parent's request for that id (none: `answered`) → guard (the child exists: `started`) → `workflows.findByName` → `versions.findBy(VersionReference.forTarget(workflow, target))` (the domain decides that `latest` is the loaded workflow's current version, so both reads agree) → `parent.answerSubWorkflow(…)`: a missing target faults the task; a task with `await: false` completes and raises `WorkflowDetached` with the resolved version id; an awaited one gets the new child. A child: save it, `started`; otherwise save the parent, `answered`. It runs in the parent's own run, so it never races the parent's rounds |
| `StartDetachedWorkflow` (outbox)                                          | the id `WorkflowDetached` carries                                                                                                                                                                                                                                                                               | guard (exists) → the workflow by name and the version by the id resolved when the task started (versions are write-once) → `WorkflowInstance.startSubWorkflow` with a `ParentOrigin` → save → `InstanceRuns.start`                                                                                                                                                                                                                                                                                                                                                                                                                      |

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

8. **Detached processes.** `ProcessDetached` carries the evaluated `ProcessRun` → `RunDetachedProcess`, which calls `processRunner.runAll` and ignores the result; a run the full bulkhead rejected throws `WorkDeferredError`, so the outbox retries it. With US8 the payload must not carry secret values in plain text.

## 7. Schedules, control, sub-workflows

- **Schedules.** `RecurringScheduleSet` → `RegisterRecurringStarts`, which calls `WorkflowSchedules.upsert(workflowId, { workflow: 'scheduled-start', input: { workflowId, epoch }, …, tz: 'UTC', missed: 'once', overlap: 'allow' })`. `RecurringScheduleCleared` → `RemoveRecurringStarts`. `NextStartDue(delay)` is written with the outbox `delay` → `StartScheduledInstance`.
- **Suspend.** No new work. Results in flight are recorded.
- **Resume.** Passed deadlines apply on the next round.
- **Cancel.** Results in flight are discarded. Every abandoned task closes its correlation (`ListenEnded`) or its child (`CancelRequested`). The same happens for timeouts, `compete` losers and caught branches.
- **Sub-workflow.** A step of the parent's run resolves the target and creates the awaited child (`StartSubWorkflow`), and the run starts it with `ctx.startChild`. The engine tells the parent's run when a child ends, and its next step records the end (`CompleteSubWorkflow`); a child that ended without a result (no row, or cancelled in US9) faults the parent's task. A child whose input breaks its schema faults in its first round, so the parent learns through the same path. A task with `await: false` resolves its target in the same step and completes; the outbox starts the child (`StartDetachedWorkflow`).

## 8. Errors at the engine and the outbox

| Error                                                                        | Outbox handler | `InstanceWorkflow` step                                   | `ScheduledStartWorkflow` |
| ---------------------------------------------------------------------------- | -------------- | --------------------------------------------------------- | ------------------------ |
| InstanceNotFoundError, StaleRoundError, StaleStartError, InvalidControlError | Acknowledge    | End the run (a stale round's successor goes on)           | End the run              |
| StaleWriteError, a transient PostgreSQL failure, a network error             | Retry          | Transient: retry (a full bulkhead is data, §3)            | Retry                    |
| Anything else                                                                | Dead-letter    | `NonRetryableStepError` → `FaultInstance({ instanceId })` | Fail the run             |

Error handling is framework work: use cases never catch, and an adapter catches only to translate a storage conflict into a domain error (a unique violation into `StaleWriteError`). Some transient PostgreSQL failures surface outside repository code (a pool connection, `BEGIN` and `COMMIT` in `@Transactional`, the engine's insert in the caller's transaction), so translating them in the repositories would leave holes. Instead one owner recognizes them wherever they surface: `PostgresTransientFailures` (`frameworks/drizzle`: SQLSTATE classes 08, 40, 53 and 57 and pool timeouts, found through `cause`). `ErrorClassifier` (`frameworks/resilience`) asks it, checks socket error codes and classifies the domain and application error classes into settled, transient or permanent; `StepErrors` (`frameworks/workflows`) and `OutboxErrors` (`frameworks/outbox`) turn that into their library's answer. The classification runs inside each step, because the engine's journal keeps no error class. Failures of the outbound clients are not errors at all: the clients in `frameworks/` answer with outcomes (rejected, timed out, unreachable, unauthorized, refused), which the gateways map to results.

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

- **jq.** Publishing only compiles expressions. Compilations and evaluations run in Piscina workers (`frameworks/jq`), with the client's prelude: `env`, `input`, `inputs`, `input_filename`, `halt`, `halt_error` and local time raise errors, `$ENV` is `null`, and `debug` and `stderr` pass their input through. Publishing compiles the same wrapped program that runs. Each run times out after 1 s and terminates its worker, and a run that exhausts jq's memory aborts its WebAssembly instance, which the worker reloads; both are expression errors (`The expression ran out of time`, `… of memory`). The pool has a worker per engine slot plus one, so a program waits for a worker only behind more programs than a process runs instances. Expressions in data are never evaluated.
- **Author schemas.** Publishing compiles every `input`, `output` and `export` schema of the workflow, its tasks and its declared functions (`Definition.schemas`, `SchemaValidator.check`), so a schema Ajv cannot use is refused at its pointer before any run. Ajv runs in Piscina workers (`frameworks/ajv`) with the 1 s `schemas` preset and without `allErrors`, because Ajv trusts its schemas and a `pattern` can backtrack without end; a validation out of time is a configuration error.
- **Documents.** The SDK reads a document in a Piscina worker (`frameworks/openworkflowspec`) with the 2 s `documents` preset and a 256 MB heap, since YAML aliases expand without bound; a reading out of time or memory is refused at the root. The client keeps the last 64 parsed texts, so the rounds of published versions read them from memory.
- **NUL.** PostgreSQL keeps no U+0000 in jsonb. A start input holding one is refused (400); a jq result, a response's content or a process's output holding one fails its task with a catchable expression, communication or runtime error.
- **Secrets.**
  - At rest: AES-256-GCM in the repository (`SECRETS_KEY`).
  - Only the definition's declared names are decrypted, and only for its rounds and deliveries.
  - Values are masked in records, faults, delivery errors and logs.
- **Webhooks.** SHA-256 fingerprints; unknown and deleted tokens give the same 404; rates limited at the gateway.
- **Input.** zod on every body, query and path, unknown fields rejected. Documents up to 1 MiB, read as text only on the two document routes; events and webhook calls up to 256 KiB; the default limit everywhere else.

## 11. Conformance harness

- **Runner.** CTK 1.0.3 feature files, copied unchanged into `apps/api/test/conformance/features/`, run by `quickpickle` as a separate Vitest project over HTTP.
- **Stand-ins.** undici `MockAgent` replaces `EndpointDispatcher` and stands in for petstore and httpbin; the address policy has its own integration tests.
- **Isolation.** The database is cleaned per scenario.
- **Contradictions** are recorded (research R16).
