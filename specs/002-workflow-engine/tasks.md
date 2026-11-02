# Tasks: Workflow Engine

**Input**: [plan.md](plan.md), [spec.md](spec.md), [data-model.md](data-model.md), [architecture.md](architecture.md), [research.md](research.md), [contracts/openapi.yaml](contracts/openapi.yaml), [quickstart.md](quickstart.md)

**Tests**: required by constitution VI and the plan's test plan. Each task writes its tests together with its code, at the lowest level that observes the behaviour.

**Behaviour** lives in data-model.md and architecture.md. A task names its files and its outcome only.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on an unfinished task)
- **[Story]**: the user story from spec.md

## Path Conventions

- `src/` and `test/` are `apps/api/src/` and `apps/api/test/`.
- Domain: `src/domain/automation/<module>/`. Application: `src/application/automation/<module>/`. Adapters: `src/interface-adapters/<agency>/`.
- Tests: `test/unit/domain/automation/`, `test/unit/application/automation/`, `test/integration/automation/`, `test/component/automation/`, `test/conformance/`, `test/e2e/automation/`.
- Every story runs in the plan's order: domain with unit tests → both critics → application → adapters → the CA critic on the diff.
- Each story moves the constructs it makes runnable from `UnsupportedConstruct` into the enums of what is supported, so `GET /conformance` is always exact (ER-001).

---

## Phase 1: Setup

- [x] T001 Amend the constitution to 3.1.0 with the R19 points and the R21 modules in `.specify/memory/constitution.md`, on its own branch for a separate PR
- [x] T002 The user installs the R21 packages and upgrades `@nestjs/outbox` to 0.1.3 in `apps/api/package.json`
- [x] T003 [P] Build a custom go-judge image, pinned by digest, with Node.js and Python 3 in `docker/go-judge/Dockerfile`, and add the privileged `go-judge` service with a health check to `compose.yaml`
- [x] T004 [P] Add the scripts `engine:migrate` (`nest-workflows migrate --url "$DATABASE_URL"`) and `test:ctk` to `apps/api/package.json`, with the CTK project in `apps/api/vitest.config.ctk.ts`
- [x] T005 [P] Add `SECRETS_KEY`, `OUTBOUND_ALLOW_LIST`, `SANDBOX_URL` and the role flags `HTTP`, `ENGINE_WORKER`, `OUTBOX_RELAY` to the env schema in `src/frameworks/di/config.module.ts` and to `.env.example`
- [x] T006 Move `Database` and `DrizzleTx` from `src/interface-adapters/persistence/interfaces.ts` to `src/interface-adapters/interfaces.ts`, declare `EndpointDispatcher`, `SandboxPool`, `JqPool`, `JsonSchemaCompilers` and `DslSchema` there, and update the imports
- [x] T007 [P] Copy the CTK 1.0.3 feature files unchanged into `test/conformance/features/` with the upstream commit in `test/conformance/features/COMMIT`, and run one scenario through quickpickle in `test/conformance/steps/workflow.steps.ts` (fallback `@cucumber/cucumber`, R18)

---

## Phase 2: Foundational

**⚠️ No user story starts before this phase is complete.**

- [x] T008 Add `StaleWriteError` to `src/domain/errors.ts` and map it to 409 in `src/interface-adapters/api/filters/domain-error.filter.ts`
- [x] T009 [P] Engine module (Postgres store, `leaseDuration` 120 s, heartbeat 40 s, worker only under `ENGINE_WORKER`) in `src/frameworks/di/engine.module.ts`. Tests in `test/integration/automation/engine.spec.ts`: `start` and `signal` inside a nestjs-cls transaction; the lease renewed during a long step; a signal sent during `advance-N` consumed by `park-N`
- [x] T010 [P] Outbox 0.1.3 with the relay only under `OUTBOX_RELAY` in `src/frameworks/di/outbox.module.ts`; the mailing suite stays green
- [x] T011 [P] Idempotency: the `idempotency_key` table in `src/interface-adapters/persistence/schema/idempotency-key.ts`, `src/interface-adapters/persistence/stores/drizzle-idempotency.store.ts` and `src/frameworks/di/idempotency.module.ts`, with `idempotencyStoreContract` in `test/integration/automation/idempotency.store.spec.ts`
- [x] T012 [P] The resilience presets of R15 (`service-calls`, `subscriber-delivery`, `processes`, `jq`; bulkheads reject when full) in `src/frameworks/di/resilience.module.ts`
- [x] T013 [P] `JqClient.compile` and `JqCompilation` in `src/interface-adapters/workflows/expressions/{interfaces,enums}.ts`, and `InProcessJqClient` (compiles `empty | (program)` with every mentioned `$name` bound) in `src/frameworks/jq/in-process-jq.client.ts`, with tests in `test/integration/automation/in-process-jq.client.spec.ts`. Remove `src/frameworks/jq/jq-pool.ts`, `src/interface-adapters/workflows/expressions/jq.worker.ts`, `JqPool`, the `jq` preset and `piscina` until US2
- [x] T014 [P] `EndpointDispatcher` (undici `connect.lookup` against a `node:net` `BlockList` on every connect and redirect; `OUTBOUND_ALLOW_LIST`) in `src/frameworks/undici/endpoint-dispatcher.ts` and `SandboxPool` in `src/frameworks/go-judge/sandbox-pool.ts`, with tests in `test/integration/automation/endpoint-dispatcher.spec.ts`
- [x] T015 [P] `JsonSchemaCompilers` (Ajv with formats, `allErrors`) in `src/frameworks/ajv/json-schema-compilers.ts`; `OpenWorkflowClient`, `DslOutcome` and the standard's shape `Dsl.*` in `src/interface-adapters/workflows/definitions/{interfaces,enums}.ts`, and `SdkOpenWorkflowClient` in `src/frameworks/openworkflowspec/sdk-open-workflow.client.ts`, with tests in `test/integration/automation/sdk-open-workflow.client.spec.ts`. Remove `src/frameworks/ajv/dsl-schema.ts`, `DslSchema` and `js-yaml`

**Checkpoint**: the libraries are proven, and the stories can begin.

---

## Phase 3: User Story 1 - Publish a workflow (P1) 🎯 MVP

**Goal**: documents are checked before they are published as immutable versions; the first problem refuses a document.

**Independent Test**: US1 independent test; quickstart scenarios 1, 2 and 13.

- [x] T017 [P] [US1] The enums of data-model §6 in `src/domain/automation/language/enums.ts` and `DocumentFormat` in `src/domain/automation/workflows/enums.ts`; `DefinitionRejectedError(pointer)` with its kinds and `InvalidValueError` with its kinds in `src/domain/errors.ts`; `JsonPointer` and `ConformanceStatement` in `src/domain/automation/language/{json-pointer,conformance-statement}.ts`
- [x] T018 [P] [US1] `TaskList` (unique names, directive targets), `FlowDirective`, `Expression`, `Template`, `Input`, `Output`, `Export`, `FixedDuration` (`inline`, `literal`), `ExpressionDuration`, `WorkflowName` and `WorkflowTarget` in `src/domain/automation/language/`, with tests in `test/unit/domain/automation/language/`
- [x] T019 [P] [US1] `ErrorFilter`, `CatchClause`, `RetryStrategy` with `BackoffKind`, `Endpoint`, `Authentication` and `ReusableComponents` in `src/domain/automation/language/`, with tests
- [x] T020 [US1] The abstract `Task` and `TaskBase` in `src/domain/automation/language/{task,task-base}.ts`, and the task kinds of the subset in `src/domain/automation/language/tasks/`, including `HttpCallTask`, `OpenApiCallTask` and `FunctionCallTask`; `ForkTask` refuses a competing fork without branches
- [x] T021 [US1] `Definition` (`expressions`) in `src/domain/automation/language/definition.ts`, with tests in `test/unit/domain/automation/language/definition.spec.ts`
- [x] T022 [US1] Remove from `src/domain/automation/language/` what the rework replaces: `Problem`, `Findings`, `Scope`, `DefinitionBuild`, `DocumentReading`, `Report`, `DocumentReferences`, `WorkflowReference`, `ReferenceFacts`, `SupportedSubset`, `RuntimeArguments`, `TaskSettings`, `DataSpec`, `AuthenticationPolicy`, `RetryPolicy`, `CallTask`, the factories and the parsed types
- [x] T023 [US1] `Workflow` (`register`, `publish`, current version), `WorkflowVersion` (`publish` refuses a definition of another workflow and keeps its `dslVersion`; the definition is not stored) and `SourceDocument` in `src/domain/automation/workflows/{workflow,workflow-version,source-document}.ts`; `VersionConflictError`, `WorkflowNotFoundError` and `VersionNotFoundError` in `src/domain/errors.ts`. Tests in `test/unit/domain/automation/workflows/` (schedules and `NoSchedule` come with US4)
- [x] T024 [US1] Run the DDD and CA critics on T017–T023 and on the intended US1 application and adapters, apply the fixes, and record the verdict in `specs/002-workflow-engine/research.md` R22
- [x] T025 [US1] `WorkflowRepository` and `WorkflowVersionRepository` in `src/application/automation/workflows/ports.ts`; `DefinitionReader.read(text)` in `src/application/automation/language/ports.ts`; `WorkflowQueries` (lists, document) in `src/application/automation/workflows/queries.ts`; `ExpressionEvaluator.check` in `src/application/automation/language/ports.ts`; `WorkflowPolicy` (FR-031) in `src/application/automation/workflows/workflow.policy.ts`. Remove the `DocumentReader` port and `referenceFacts`
- [x] T026 [US1] `CheckDocument` (read, check expressions, return the Definition), `PublishVersion` and `GetConformanceStatement` in `src/application/automation/workflows/{check-document,publish-version,get-conformance-statement}.ts`, with fakes in `test/support/fakes.ts` and tests in `test/unit/application/automation/workflows/`
- [x] T027 [P] [US1] `OpenWorkflowDefinitionReader` and the pure mappers in `src/interface-adapters/workflows/definitions/{open-workflow-definition.reader.ts,mappers/}`, with tests in `test/integration/automation/open-workflow-definition.reader.spec.ts`. Remove `workflows/definitions/{dsl-document.reader,schema-problems}.ts`
- [x] T028 [P] [US1] `JqExpressionEvaluator.check` (through `JqClient.compile`; the first failure throws `InvalidExpressionError`) in `src/interface-adapters/workflows/expressions/jq-expression.evaluator.ts`, with tests in `test/integration/automation/jq-expression.evaluator.spec.ts`
- [x] T029 [P] [US1] The `workflow` and `workflow_version` tables (data-model §11) in `src/interface-adapters/persistence/schema/{workflow,workflow-version}.ts`, with mappers, `drizzle-workflow.repository.ts`, `drizzle-workflow-version.repository.ts`, `drizzle-workflow.queries.ts` and migrations in `apps/api/drizzle/` (0005 drops `workflow_version.definition`). Tests in `test/integration/automation/workflow.repository.spec.ts`
- [x] T030 [US1] `WorkflowsController` (check gives 204 or the refusal; publish, list, read, versions, document) and `ConformanceController` in `src/interface-adapters/api/controllers/{workflows,conformance}.controller.ts`, with `@DocumentBody` in `src/interface-adapters/api/parsers/document-body.parser.ts`, `DocumentMediaType` and `DocumentRoute` in `src/interface-adapters/api/enums.ts`, presenters, and `src/interface-adapters/api/schemas/workflow.schemas.ts`. `DefinitionRejectedError` maps to 422 with its pointer in `domain-error.filter.ts`
- [x] T031 [US1] Bind the context, `OpenWorkflowClient` and `JqClient` in `src/frameworks/di/automation.module.ts` and import it in `src/frameworks/di/app.module.ts`
- [x] T032 [US1] Component tests for US1 scenarios 1–8 in `test/component/automation/publish.spec.ts`, and the SC-002 corpus of at least 30 defective documents, each refused with its defect located, in `test/component/automation/fixtures/defective-documents.ts`
- [x] T033 [US1] CA critic on the US1 diff (isolation, grouping, naming); apply the fixes, and record notable findings in `specs/002-workflow-engine/research.md` R22

**Checkpoint**: publishing works on its own.

---

## Phase 4: User Story 2 - Run a workflow and follow its execution (P1) 🎯 MVP

**Goal**: instances run with the standard's semantics in rounds, and their history is readable.

**Independent Test**: the CTK through HTTP (SC-001); quickstart scenarios 3–5.

- [x] T034 [P] [US2] Work as plain data (`Evaluation`, `Validation`, `ServiceCall`, `ProcessRun`, `RoundWork`) in `src/domain/automation/language/interfaces.ts`; results in `src/domain/automation/language/results/` (`Evaluated`, `EvaluationFailed`, `Validated`, `ValidationFailed`, `ServiceResponded`, `ServiceTimedOut`, `AuthenticationFailed`, `CommunicationFailed`, `ProcessExited`, `ProcessTimedOut`, `SandboxFailed`), each deciding its outcome; `WorkflowError` and `ErrorType` (the DSL 1.0.3 URIs and statuses); `Template.fill`. Lands with T035, which issues and reads them. Tests
- [x] T035 [US2] The task stages (`TaskProgress`: `EntryStage` … `EndedStage`) in `src/domain/automation/language/stages/`, the kind progress objects (`ValueProgress`, `CallProgress`, `ProcessProgress`, `FunctionCallProgress`, `RunWorkflowProgress`, `DoProgress`, `ForProgress`, `ForkProgress`, `SwitchProgress`, `TryProgress`, `CatchProgress`, `RetryProgress`, `HandlerProgress`, `ConcludedProgress`) in `src/domain/automation/language/progress/`, `Sequence`, `TaskScope` and `WorkflowScope`, and `enter(input, scope)` on each task kind, with tests in `test/unit/domain/automation/language/progress/`: the stages and arguments of data-model §7; progress keeps only state and receives its Task through `Definition.taskAt(reference)`; the call task decides the output mode, `redirect` and the status rule from `ServiceResponded`; `ErrorFilter.matches`, `RetryStrategy.allows` and `delayFor` with polymorphic backoffs (jitter from the work id), and `FixedDuration.endFrom` for timeouts, as their callers arrive; the document JSON on the Definition for `$task.definition` and `$workflow.definition`; `FlowDirective`, `ProcessReturn` and `OutputFormat` become enumeration classes and `Backoff` polymorphic; a function call runs the declared function as its child task; the workflow runs as `Definition.root`
- [x] T036 [US2] `LifecycleEvent` and `LifecycleEventType` (data, sequence, source) in `src/domain/automation/instances/`, `CloudEvent` (typed attributes; `of` reads an evaluated `emit`) in `src/domain/automation/language/cloud-event.ts`, and the write-once `Event` with `lifecycle` and `emitted` in `src/domain/automation/events/event.ts`, with tests; the CloudEvent JSON format and the 64 KiB rule are written by `InstancePresenter` (Round 14)
- [x] T037 [US2] `WorkflowInstance` (`start`, `startDetached`, `beginRound`, `pendingWork`, `record`, `takeProducedEvents`, `takeDomainEvents`, `fault`, `requestedSubWorkflows`, `answerSubWorkflow`, `completeSubWorkflow`, `progress`, timeouts, phases) with the internal `ProducedEvents`, and `TaskInstance` (one per execution, with a derived id; a terminal task never changes) in `src/domain/automation/instances/`; origins `UserOrigin` and `ParentOrigin` in `src/domain/automation/instances/origins/`; `ProcessDetached` (with the `ProcessRun`) and `WorkflowDetached` (with the derived instance id and the resolved target), raised once from the `TaskEnding`, in `src/domain/automation/instances/domain-events/`; `DerivedId`; `InstanceNotFoundError` in `src/domain/errors.ts`. Tests in `test/unit/domain/automation/instances/` for US2 scenarios 1–5 and the error edge cases
- [x] T038 [US2] Settle the recognition of transient PostgreSQL failures (`TransientFailures`, architecture §8); run the DDD, CA and standard critics on T034–T037 and on the intended round, engine loop and adapters, apply the fixes, and record the verdict in `specs/002-workflow-engine/research.md` R22 (Round 12)
- [x] T039 [US2] Ports and policy: `WorkflowInstanceRepository`, `InstanceRuns`, `ServiceCaller` and `ProcessRunner` in `src/application/automation/instances/ports.ts`; `ExpressionEvaluator.evaluateAll` and `SchemaValidator` in `src/application/automation/language/ports.ts`; `EventRepository.addAll` in `src/application/automation/events/ports.ts`; `InstanceQueries` (filtered, paginated lists; history; task records; lifecycle events) in `src/application/automation/instances/queries.ts`; `InstancePolicy` in `src/application/automation/instances/instance.policy.ts`
- [x] T040 [US2] `AdvanceInstance` composing `BeginRound` and `RecordRound` (architecture §3: pure work recorded in memory, one save per side effect), `FaultInstance({ instanceId })`, `StartSubWorkflow` (the children the parent requested; `latest` resolved through `WorkflowTarget.isLatest`; a missing target or an unpublished version faults the `run` task with a configuration error and saves only the parent; returns the ids of the children that exist), `CompleteSubWorkflow`, `RunDetachedProcess` and `StartDetachedWorkflow` in `src/application/automation/instances/` (`StartInstance` derives the instance id from the user and the `Idempotency-Key`, architecture §5), with fakes in `test/support/fakes.ts` and tests in `test/unit/application/automation/instances/`
- [x] T041 [P] [US2] Evaluation: `JqExpressionEvaluator.evaluateAll` runs jq programs with the sandbox prelude and the arguments each Evaluation carries, through `JqClient`; `PiscinaJqClient` and `jq.worker.ts` in `src/frameworks/jq/` (up to four workers, the 1 s `jq` preset terminates a runaway's worker, an aborted jq-wasm instance is reloaded), with tests in `test/integration/automation/piscina-jq.client.spec.ts` for the timeout, memory exhaustion and recovery
- [x] T042 [P] [US2] `JsonSchemaValidator` in `src/interface-adapters/workflows/schemas/`, behind `JsonSchemaClient`, and `AjvJsonSchemaClient` (one Ajv per draft, `addUsedSchema: false`, a bounded cache) in `src/frameworks/ajv/`, with tests in `test/integration/automation/json-schema.validator.spec.ts`
- [x] T043 [P] [US2] `ServiceCallGateway` and its mappers in `src/interface-adapters/workflows/services/` (requests, OpenAPI operations, authorizations, results) behind `EndpointClient`, and `UndiciEndpointClient` in `src/frameworks/undici/` (requests on `EndpointDispatcher`, OIDC discovery and client-credentials tokens, `@apidevtools/json-schema-ref-parser`, the 1 MiB limit, the `service-calls` preset, every library error as an outcome). Results: `ServiceResponded`, `ServiceTimedOut`, `AuthenticationFailed`, `CommunicationFailed` or `CallMisconfigured`, and none for a call the full bulkhead rejected. Tests with `MockAgent` in `test/integration/automation/service-call.gateway.spec.ts`
- [x] T044 [P] [US2] `SandboxGateway` and `process-run.mapper.ts` (the R12 mapping and statuses) in `src/interface-adapters/sandbox/`, behind `SandboxClient`, and `GoJudgeSandboxClient` with the authorized `SandboxPool` (`Authorization: Bearer SANDBOX_TOKEN`) and the `processes` preset in `src/frameworks/go-judge/`; the limits are an injected `SandboxLimits`; a rejected run gets no result, and an answer that is not a go-judge result is refused. Tests against go-judge in Testcontainers in `test/integration/automation/sandbox.gateway.spec.ts`: network refused, time and memory limits (SC-012)
- [x] T045 [P] [US2] Persistence: the `workflow_instance`, `task_instance` and `event` tables (data-model §11) in `src/interface-adapters/persistence/schema/`, with mappers; `drizzle-workflow-instance.repository.ts` (one multi-row write of the tasks and of the outbox entries per save), `drizzle-event.repository.ts`, `drizzle-instance.queries.ts` and a migration; tests in `test/integration/automation/`
- [x] T046 [US2] Reopened and done in Round 14: `InstanceWorkflow` in `src/frameworks/workflows/instance.workflow.ts` (architecture §4: `attempted` ids, awaited children through `ctx.startChild` with `parentClose: 'abandon'`, `StepErrors` in every step, the fault and the compensation included, `STEPS` retries, `busy` sleeps, no wake until US7/US9), `InstanceRunController` and `InstanceRunsGateway` in `src/interface-adapters/workflows/runs/`, `EngineRunClient` in `src/frameworks/workflows/`; tests on `ManualWorkflowClock` in `test/integration/automation/instance.workflow.spec.ts` that assert the engine status (`maxEntries: 20`, compensation, a busy sleep, a refused and a detached sub-workflow); a child that ended without a result in the use-case tests; `ErrorClassifier` and `PostgresTransientFailures` with tests in `test/unit/automation/error-classifier.spec.ts`
- [x] T047 [P] [US2] Reopened and done in Round 14: the outbox handlers in `src/frameworks/outbox/` with `OutboxErrors`, and their controllers in `src/interface-adapters/messaging/`; tests on `OutboxRelay.runOnce` in `test/integration/automation/instance-outbox.handlers.spec.ts` (a deferred process kept for a retry, a detached sub-workflow on its resolved version, a malformed payload dead-lettered; a detached process run in `instance-persistence.spec.ts`)
- [x] T048 [US2] `InstancesController` (start with `@Idempotent()` and the start key; list with independent filters; read; tasks; lifecycle events; cursors checked by zod) in `src/interface-adapters/api/controllers/instances.controller.ts`, with presenters, `src/interface-adapters/api/mappers/start-key.mapper.ts` and `src/interface-adapters/api/schemas/instance.schemas.ts`; bindings in `automation.module.ts`
- [x] T049 [US2] Component tests for US2 scenarios 1–8 and SC-010 in `test/component/automation/run.spec.ts`
- [x] T050 [US2] CTK steps in `test/conformance/steps/workflow.steps.ts`, with `MockAgent` for petstore and httpbin: every scenario passes except the recorded contradiction (SC-001, FR-032); `pnpm --filter api test:ctk` joins the CI job
- [x] T051 [US2] Round 14 (research R22): move clients, library instances, presets and error handling to `src/frameworks/` behind the adapter groups' contracts, regroup the adapters (`api/`, `persistence/`, `messaging/`, `mailing/`, `sandbox/`, `workflows/{definitions,expressions,schemas,services,runs}`) so they only map, remove the CloudEvent JSON round trip from the domain, apply the critics' fixes (named `StartSubWorkflow` outcomes, detached targets resolved in the run, `versions.findFor`, the start key, the jq output rule, Ajv's cache, multi-row saves and indexes, the list filters and cursors, the contract), add the missing US2 tests (AS6, AS7, FR-014, FR-016 filters and pages, task record fields, events off the happy path, expression-like input), and run the DDD, CA and standard critics again; Round 15 (the critics again) applied
- [x] T051a [US2] Compile the author's `input`, `output` and `export` schemas at publish (FR-002, compiler-like): `Definition.schemas`, `SchemaValidator.check` called by `CheckDocument`, `JsonSchemaClient.compile`, `InvalidSchemaError` at the schema's pointer; tests in `test/integration/automation/json-schema.validator.spec.ts` and the defective documents of `test/component/automation/publish.spec.ts`

**Checkpoint**: the MVP core. US1 and US2 run the CTK end to end.

---

## Phase 5: User Story 3 - Survive failures and scale out (P1)

**Goal**: instances survive any process failure, and capacity grows with workers.

**Independent Test**: the US3 independent test (SC-003, SC-004).

- [ ] T052 [US3] `DataLimits` (a snapshot taken at start) and the task-execution limit (FR-021; the defaults in the spec's Assumptions) in `src/domain/automation/instances/data-limits.ts` and `WorkflowInstance`, with the limits read from `config.module.ts`. Tests for a large `for`, an endless `then` and an oversized output
- [ ] T053 [US3] Run the DDD and CA critics on T052; apply the fixes, and record the verdict in `specs/002-workflow-engine/research.md` R22
- [ ] T054 [US3] Recovery tests in `test/integration/automation/recovery.spec.ts`: a recorded task is not executed again; an interrupted task runs again; no task runs on two workers at once; every instance continues after all workers restart
- [ ] T055 [US3] A Compose e2e profile with two API processes in `compose.yaml`, and the journeys `test/e2e/automation/fault-injection.spec.ts` (SC-003) and `test/e2e/automation/scale-out.spec.ts` (SC-004)
- [ ] T056 [US3] CA critic on the US3 diff; apply the fixes, and record notable findings in `specs/002-workflow-engine/research.md` R22

---

## Phase 6: User Story 7 - Wait for time and for events (P2)

**Goal**: `wait`, `listen` and the event log with routing. US4, US5 and US6 build on it.

**Independent Test**: the US7 independent test; quickstart scenarios 6 and 7.

- [ ] T057 [P] [US7] Language for waits and listens, with tests: `WaitTask` with `WaitProgress`, and `ListenTask` with `ListenProgress` (strategies, `until`, read modes, the `foreach` FIFO; `abandon()` raises `ListenEnded`); `ConsumptionStrategy` and `EventFilter` in `src/domain/automation/language/`; `wait` and `listen` move from `UnsupportedConstruct` to `TaskKind`
- [ ] T058 [US7] Correlation and listening, with tests for US7 scenarios 2, 3, 5 and 6: `Correlation` and `ListenOwner` in `src/domain/automation/events/{correlation,listen-owner}.ts`; `Event.accept`, and `EventAccepted` raised by both factories; `CorrelationStarted`, `EventConsumed` and `CorrelationCompleted` in `src/domain/automation/events/events.ts`; `ListenStarted`, `ListenEnded`, `completeListen` and `consumeListenEvent` on `WorkflowInstance`
- [ ] T059 [US7] Run the DDD and CA critics on T057–T058 and on the intended routing; apply the fixes, and record the verdict in `specs/002-workflow-engine/research.md` R22
- [ ] T060 [US7] Ports and policy: `CorrelationRepository` and `EventOffers` in `src/application/automation/events/ports.ts`; `EventQueries` (candidates by `filter_types` or `*`, catch-up since) in `src/application/automation/events/queries.ts`; `EventPolicy` in `src/application/automation/events/event.policy.ts`
- [ ] T061 [US7] `AcceptEvent`, `RouteEvent`, `OfferEvent`, `StartCorrelation`, `CatchUpCorrelation` and `EndCorrelation` in `src/application/automation/events/`, and `CompleteListen` and `ConsumeListenEvent` in `src/application/automation/instances/`, with tests
- [ ] T062 [P] [US7] The `correlation` table (GIN on `filter_types`) in `src/interface-adapters/persistence/schema/correlation.ts`, with its mapper, `drizzle-correlation.repository.ts`, `drizzle-event.queries.ts`, `OutboxEventOffers` in `src/interface-adapters/persistence/outbox/outbox-event-offers.ts` and a migration. Tests
- [ ] T063 [P] [US7] Outbox handlers in `src/interface-adapters/messaging/`: `event-accepted`, `event-offer`, `listen-started`, `correlation-started`, `event-consumed`, `correlation-completed` and `listen-ended` (`*-outbox.handler.ts`). Tests on `OutboxRelay.runOnce`
- [ ] T064 [US7] `EventsController` (`POST /events`, structured or binary, 256 KiB, batches refused) in `src/interface-adapters/api/controllers/events.controller.ts`, with the CloudEvents HTTP binding as zod schemas in `src/interface-adapters/api/schemas/cloud-event.schemas.ts`
- [ ] T065 [US7] Component tests for US7 scenarios 1–6 in `test/component/automation/events.spec.ts`; an e2e journey for SC-005–SC-007 in `test/e2e/automation/waiting.spec.ts`
- [ ] T066 [US7] CA critic on the US7 diff; apply the fixes, and record notable findings in `specs/002-workflow-engine/research.md` R22

---

## Phase 7: User Story 5 - Receive webhooks from other applications (P2)

**Goal**: an HTTP call becomes an ordinary CloudEvent.

**Independent Test**: the US5 independent test, with a `listen` instance in place of `schedule.on` (US4 covers that path); quickstart scenario 8 after US4.

- [ ] T067 [P] [US5] `Webhook` (`create`, `receive` dropping `Authorization` and `Cookie`) and `WebhookToken` in `src/domain/automation/events/{webhook,webhook-token}.ts`, plus `WebhookNotFoundError` in `src/domain/errors.ts`, with tests
- [ ] T068 [US5] Run the DDD and CA critics on T067; apply the fixes, and record the verdict in `specs/002-workflow-engine/research.md` R22
- [ ] T069 [US5] `WebhookRepository` in `src/application/automation/events/ports.ts`; `ConnectionQueries.listWebhooks` in `src/application/automation/events/queries.ts`; `CreateWebhook`, `DeleteWebhook` and `ReceiveWebhookCall` in `src/application/automation/events/`, with tests
- [ ] T070 [P] [US5] The `webhook` table (unique `token_fingerprint`) in `src/interface-adapters/persistence/schema/webhook.ts`, with its mapper, `drizzle-webhook.repository.ts`, `drizzle-connection.queries.ts` and a migration. Tests
- [ ] T071 [US5] Controllers in `src/interface-adapters/api/controllers/{webhooks,hooks}.controller.ts`: `WebhooksController`, and `HooksController` (`POST /hooks/{token}`, public, `@Idempotent({ scope: false })`, 256 KiB, text bodies, the same 404 for deleted and unknown). Schemas and presenters
- [ ] T072 [US5] Component tests for US5 scenarios 1–6 in `test/component/automation/webhooks.spec.ts`, including SC-008
- [ ] T073 [US5] CA critic on the US5 diff; apply the fixes, and record notable findings in `specs/002-workflow-engine/research.md` R22

---

## Phase 8: User Story 4 - Start workflows on a schedule and on events (P2)

**Goal**: workflows that are on start themselves through the standard's `schedule`.

**Independent Test**: the US4 independent test; quickstart scenarios 8 and 10.

- [ ] T074 [P] [US4] Schedules in `src/domain/automation/language/schedules/`, with `schedule` moved out of `UnsupportedConstruct`: `CronSchedule`, `IntervalSchedule`, `AfterSchedule` and `EventSchedule`, each with `activate` and `deactivate`; `RecurringScheduleSet`, `RecurringScheduleCleared` and `NextStartDue` in `src/domain/automation/workflows/events.ts`
- [ ] T075 [US4] `Workflow.turnOn`, `turnOff`, the epoch and `assertStartable`; `StaleStartError` in `src/domain/errors.ts`; the origins `RecurringOrigin`, `AfterOrigin` and `TriggerOrigin`; `TriggerOwner` with `Correlation.forTrigger` (no self-trigger) and `TriggerSatisfied`. Tests for US4 scenarios 1–6
- [ ] T076 [US4] Run the DDD and CA critics on T074–T075; apply the fixes, and record the verdict in `specs/002-workflow-engine/research.md` R22
- [ ] T077 [US4] `RecurringStarts` in `src/application/automation/workflows/ports.ts`, and `getForStart` (`FOR SHARE`) and trigger candidates in `WorkflowQueries`. Use cases, with tests: `TurnWorkflowOn`, `TurnWorkflowOff`, `RegisterRecurringStarts` and `RemoveRecurringStarts`; `StartScheduledInstance` and `StartTriggeredInstance` (derived ids, guards); `OfferTrigger`; `RouteEvent` extended with trigger candidates
- [ ] T078 [P] [US4] `ScheduledStartWorkflow` in `src/frameworks/workflows/scheduled-start.workflow.ts` with its controller, and `RecurringStartsGateway` in `src/interface-adapters/workflows/runs/`; cron syntax checked with `parseSchedule` by the schedule mapper; `StaleStartError` settled by `ErrorClassifier`
- [ ] T079 [P] [US4] The `trigger_types` column (GIN) on `workflow`, with a migration. Outbox handlers `recurring-schedule-set`, `recurring-schedule-cleared`, `next-start-due`, `trigger-offer` and `trigger-satisfied` in `src/interface-adapters/messaging/`. Tests
- [ ] T080 [US4] On and off endpoints in `workflows.controller.ts`
- [ ] T081 [US4] Integration tests in `test/integration/automation/schedules.spec.ts`: exactly once across two workers on `ManualWorkflowClock`; one missed occurrence; stale epochs. Component tests for US4 scenarios in `test/component/automation/schedules.spec.ts`
- [ ] T082 [US4] CA critic on the US4 diff; apply the fixes, and record notable findings in `specs/002-workflow-engine/research.md` R22

---

## Phase 9: User Story 8 - Keep credentials for workflows (P2)

**Goal**: owner-scoped, encrypted secrets that workflows and subscriptions use by name.

**Independent Test**: the US8 independent test; quickstart scenario 12.

- [ ] T083 [P] [US8] `Secret`, `SecretValue` (`reveal()`) and `SecretValues` (`has`, `valueOf`, `mask`) in `src/domain/automation/secrets/{secret,secret-value,secret-values}.ts`, and `SecretNotFoundError` and `ForeignSecretError` in `src/domain/errors.ts`, with tests
- [ ] T084 [US8] Secrets in `src/domain/automation/instances/workflow-instance.ts` and `src/domain/automation/language/enums.ts`, with tests for US8 scenarios 3–5 and the masking edge cases: `beginRound` faults a task whose secret is missing or not the publisher's with an authorization error; `record` and `fault` mask resolved values; `use.secrets`, `$secrets` in `input.from` and secret-based authentication move out of `UnsupportedConstruct`
- [ ] T085 [US8] Run the DDD and CA critics on T083–T084; apply the fixes, and record the verdict in `specs/002-workflow-engine/research.md` R22
- [ ] T086 [US8] `SecretRepository` and `SecretQueries` (`valuesFor`, `namesOwnedBy`) in `src/application/automation/secrets/{ports,queries}.ts`, and `SecretPolicy`. `CreateSecret`, `ReplaceSecret` and `DeleteSecret`. Secret values resolved in `AdvanceInstance`, and owned names passed to `PublishVersion`. Tests
- [ ] T087 [P] [US8] The `secret` table (unique (owner_id, name)) in `src/interface-adapters/persistence/schema/secret.ts`, `drizzle-secret.repository.ts` (AES-256-GCM with `SECRETS_KEY`), `drizzle-secret.queries.ts` and a migration. Tests in `test/integration/automation/secret.repository.spec.ts`
- [ ] T088 [P] [US8] Authentication policies from `SecretValues` in `http-service.caller.ts`, with tests
- [ ] T089 [US8] `SecretsController` in `src/interface-adapters/api/controllers/secrets.controller.ts`, with schemas and presenters (the value is never returned)
- [ ] T090 [US8] Component tests for US8 scenarios 1–5 in `test/component/automation/secrets.spec.ts`; an SC-011 sweep of records, events and logs in `test/integration/automation/secret-masking.spec.ts`
- [ ] T091 [US8] CA critic on the US8 diff; apply the fixes, and record notable findings in `specs/002-workflow-engine/research.md` R22

---

## Phase 10: User Story 6 - Deliver events to other applications (P2)

**Goal**: every matching event reaches subscribers at least once, for 24 hours.

**Independent Test**: the US6 independent test; quickstart scenario 9.

- [ ] T092 [P] [US6] `Subscription.create(input, ownedSecretNames)` and `Delivery` (`plan`, `record`, the 24-hour limit, masked `lastError`, `DeliveryScheduled`) in `src/domain/automation/events/{subscription,delivery}.ts`, and `SubscriptionNotFoundError` in `src/domain/errors.ts`. Tests
- [ ] T093 [US6] Run the DDD and CA critics on T092; apply the fixes, and record the verdict in `specs/002-workflow-engine/research.md` R22
- [ ] T094 [US6] `SubscriptionRepository`, `DeliveryRepository` and `SubscriberGateway` in `src/application/automation/events/ports.ts`, and subscriptions in `ConnectionQueries`. Use cases, with tests: `CreateSubscription`, `DeleteSubscription`, `OfferDelivery` and `DeliverEvent`; `RouteEvent` extended with subscription candidates
- [ ] T095 [P] [US6] The `subscription` (GIN on `filter_types`) and `delivery` (unique (subscription_id, event_id)) tables, with mappers, `drizzle-subscription.repository.ts`, `drizzle-delivery.repository.ts` and a migration. Tests
- [ ] T096 [P] [US6] `CloudEventSubscriberGateway` in `src/interface-adapters/workflows/services/` (the CloudEvent JSON format and its 64 KiB rule) and its client in `src/frameworks/undici/`: structured mode, a 10 s timeout and a breaker per subscription (`ResilienceService.create(options, 'subscriber:<id>')`: a preset's breaker is shared under the preset's name), on `EndpointDispatcher`. Tests with `MockAgent`
- [ ] T097 [P] [US6] Outbox handlers `delivery-offer` and `delivery-scheduled` in `src/interface-adapters/messaging/`. The handler throws while the delivery is pending, with the backoff capped at 60 s. Tests
- [ ] T098 [US6] `SubscriptionsController` (create, list, read with delivery states, delete) in `src/interface-adapters/api/controllers/subscriptions.controller.ts`, with schemas and presenters
- [ ] T099 [US6] Component tests for US6 scenarios 1–8 in `test/component/automation/subscriptions.spec.ts`; an SC-009 journey in `test/e2e/automation/delivery.spec.ts`
- [ ] T100 [US6] CA critic on the US6 diff; apply the fixes, and record notable findings in `specs/002-workflow-engine/research.md` R22

---

## Phase 11: User Story 9 - Suspend, resume and cancel an instance (P3)

**Goal**: authors control instances, and cancellation cascades.

**Independent Test**: the US9 independent test; quickstart scenario 11.

- [ ] T101 [US9] Control in the domain, with tests for US9 scenarios 1–5 and the control edge cases: `suspend`, `resume` and `cancel` on `WorkflowInstance`, with `InvalidControlError` in `src/domain/errors.ts`; events that arrive during a suspension are consumed on resume; abandoning a `SubWorkflowProgress` raises `CancelRequested`
- [ ] T102 [US9] Run the DDD and CA critics on T101; apply the fixes, and record the verdict in `specs/002-workflow-engine/research.md` R22
- [ ] T103 [US9] `SuspendInstance`, `ResumeInstance` and `CancelInstance` (with wakes) in `src/application/automation/instances/`, with tests
- [ ] T104 [US9] Adapters for control: the suspend, resume and cancel endpoints in `instances.controller.ts`; `cancel-requested-outbox.handler.ts` in `src/interface-adapters/messaging/`; `InvalidControlError` settled by `ErrorClassifier`
- [ ] T105 [US9] Component tests for US9 scenarios 1–5 in `test/component/automation/control.spec.ts`
- [ ] T106 [US9] CA critic on the US9 diff; apply the fixes, and record notable findings in `specs/002-workflow-engine/research.md` R22

---

## Phase 12: Polish

- [ ] T107 [P] Update `apps/api/README.md`, `.env.example` and the thesis text in `/Users/vladislavsevyrev/vscode/kpi/Master-s-dissertation`
- [ ] T108 [P] Check that the generated OpenAPI document matches `specs/002-workflow-engine/contracts/openapi.yaml`
- [ ] T109 Run every scenario in `specs/002-workflow-engine/quickstart.md`
- [ ] T110 Map every FR, ER and edge case to its tests for SC-013 in `specs/002-workflow-engine/checklists/coverage.md`
- [ ] T111 Run the definition of done from `.specify/memory/constitution.md`: `pnpm lint`, `pnpm check-types`, and `pnpm --filter api test`, `test:int`, `test:ctk` and `test:e2e` green with nothing skipped, plus the security gates

---

## Dependencies

- Setup → Foundational → US1 → US2 → US3.
- US7 needs US2.
- US5 needs US7.
- US4 needs US7. Its quickstart scenario 8 also needs US5.
- US8 needs US2.
- US6 needs US7 and US8, for authentication from the owner's secrets.
- US9 needs US2. Its cascade needs `run: workflow` from US2.
- The P2 order (US7, US5, US4, US8, US6) follows these dependencies, not the spec's numbering.

## Parallel Examples

- **Foundational:** T009–T015 touch separate files and run together after T008.
- **US1:** T017, T018, T019 and T022 together; then T027, T028 and T029 together after T026.
- **US2:** T041–T045 and T047 together after T040.
- **US7:** T062 and T063 together after T061.
- **US6:** T095, T096 and T097 together after T094.
- **Stories:** after US7, US5 and US8 can proceed in parallel, because their files differ.

## Implementation Strategy

1. **MVP:** Setup, Foundational, US1 and US2. Stop and validate with the CTK (SC-001) and quickstart scenarios 1–5 and 13.
2. **Durability:** US3 proves the thesis claim (SC-003, SC-004).
3. **Increments:** US7, US5, US4, US8, US6 and US9, each validated by its independent test before the next.
4. **Commits:** each completed story is committed on the feature branch, per the commit policy. Nothing is pushed.
