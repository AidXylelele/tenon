# Tasks: Workflow Engine

**Input**: [plan.md](plan.md), [spec.md](spec.md), [data-model.md](data-model.md), [architecture.md](architecture.md), [research.md](research.md), [contracts/openapi.yaml](contracts/openapi.yaml)

**Status**: as of `dc19774` on `002-workflow-builder`. `[x]` is done and tested; `[ ]` is open. Paths are under `apps/api/`. The commit that delivered a task is in brackets.

Stories run in dependency order: US1 → US2 → US3, then US7 → US5 → US4 → US8 → US6, then US9. Each task writes its tests with its code.

## Foundation

- [x] T001 Packages of research R18, the go-judge image (`docker/go-judge`) and service in `compose.yaml`, and the env keys (`SECRETS_KEY`, `OUTBOUND_ALLOW_LIST`, `SANDBOX_URL`, `SANDBOX_TOKEN`, role flags) in `config.module.ts` and `.env.example`
- [x] T002 Engine, outbox, idempotency (Drizzle store, migration 0003) and resilience modules in `src/frameworks/di/`; `engine:migrate`, `outbox:migrate`, `test:ctk`
- [x] T003 `EndpointDispatcher` with the address policy (FR-022) in `src/frameworks/undici/`, `SandboxPool` and `GoJudgeSandboxClient` in `src/frameworks/go-judge/`, `WorkerPool` in `src/frameworks/piscina/`
- [x] T004 CTK 1.0.3 feature files copied unchanged into `test/conformance/features/`, run by `quickpickle`

## US1 — Publish a workflow (P1)

- [x] T010 [US1] The runtime's checks in `src/frameworks/runtime/checking/`, first problem refuses, located by JSON Pointer (FR-002) [2a75b67]
- [x] T011 [US1] Bare expressions in expression-only fields compiled at publish (FR-002 d) [c6bda66]
- [x] T012 [US1] `Workflow`, `WorkflowVersion`, `CheckedDefinition`, `WorkflowName` in `src/domain/automation/workflows/` [2a75b67]
- [x] T013 [US1] `CheckDefinition`, `PublishVersion` (checks outside the transaction) and `ArchiveWorkflow` in `src/application/automation/workflows/` [2a75b67, a4ae5dd]
- [x] T014 [US1] `WorkflowsController`: check, publish (201 with `Location`, 200, 409, 422), list by status, read, versions, document, archive; migration 0004 [2a75b67]
- [x] T015 [US1] Conformance declared once in `src/frameworks/runtime/conformance.ts`; `GET /conformance` with script languages, authentications and contradictions (ER-001) [dc19774]
- [x] T016 [US1] Tests: `test/integration/automation/definition-checks.spec.ts` (32 defective documents, SC-002), `test/component/automation/publish.spec.ts`, `test/unit/domain/automation/workflow*.spec.ts`

## US2 — Run a workflow and follow its execution (P1)

- [x] T020 [US2] The runtime's execution in `src/frameworks/runtime/execution/`: one engine step per leaf task, composites between steps, `try`/`catch`/retry, timeouts [91bef79]
- [x] T021 [US2] The `instance` engine workflow and `EngineDurability` in `src/frameworks/workflows/`; `InstanceRunController` in `src/interface-adapters/workflows/runs/` [91bef79]
- [x] T022 [US2] `run: script` and `run: shell` in go-judge, detached processes as `process` runs, sub-workflows as engine children [d4bb301]
- [x] T023 [US2] `WorkflowInstance` lifecycle and the `task_progress` read model; migration 0005 [91bef79]
- [x] T024 [US2] Start with `latest` and the parsed-start fingerprint, list filters (version, `startedFrom`, `startedTo`), read, task records, instance events [d04c4b4]
- [x] T025 [US2] Problem responses (RFC 9457) on every automation route (FR-033) [d04c4b4]
- [x] T026 [US2] A task still running when its instance ends is recorded cancelled (FR-015) [d04c4b4]
- [x] T027 [US2] The runtime follows DSL 1.0.3 where QA found it did not: fork contexts, compete, timeouts, default case, bound arguments, engine clock [16d746c]
- [x] T028 [US2] The CTK's 21 scenarios pass through HTTP, the recorded contradiction asserted (SC-001, FR-032) in `test/conformance/steps/workflow.steps.ts`
- [x] T029 [US2] Tests: `test/integration/runtime/*.spec.ts`, `test/component/automation/run.spec.ts` (SC-010), `test/unit/application/automation/instances.spec.ts`
- [ ] T030 [US2] The remaining lifecycle events of FR-030: `task.created`, `task.retried`, `task.suspended`, `task.resumed`, and the workflow's correlation started and completed
- [ ] T031 [US2] A lifecycle event leaves out its `output` when that would make it larger than 64 KiB (FR-030)
- [ ] T032 [US2] Lifecycle events carry their sequence within the instance (FR-026)
- [x] T033 [US2] A process that exits with another code than 0 faults with a runtime error (the end of its standard error, or its code), unless `return` is `code` or `all` (R7)
- [x] T034 [US2] A failed connection of a service call names its reason: the address policy, DNS, refused, closed, TLS certificate, connect timeout (R6)
- [x] T035 [US2] Every attempt a retry policy counts is its own record (`#n`) with its `attempt`; an outage repeats the same attempt; a retried fault, on a single task or in a task list, records `retryAt` decided where it arose; migration 0014 (FR-016, R15)

## US3 — Survive failures and scale out (P1)

- [x] T040 [US3] Replay tests: a recorded effect never runs again, a crash before any step resumes as an uninterrupted run, in `test/integration/runtime/durability.spec.ts`
- [ ] T041 [US3] The task-execution limit and the data size limits of FR-021 (defaults in the spec's Assumptions)
- [ ] T042 [US3] Fault-injection journey with workers killed at random (SC-003) in `test/e2e/`
- [ ] T043 [US3] Scale-out journey from 2 to 4 workers (SC-004) in `test/e2e/`

## US7 — Wait for time and for events (P2)

- [x] T050 [US7] The event store (once per source and id), `POST /events` in structured and binary mode, lifecycle events written with their change; migration 0006 [0aecef6]
- [x] T051 [US7] `wait` as a durable sleep and the instance's waiting phase; migration 0007 [91bef79, 0aecef6]
- [x] T052 [US7] `listen` (`one`, `any`, `all`, an `until` expression, read modes, `correlate`) through listeners and engine signals `{sequence}:{key}` dispatched after the commit; migration 0008 [2e52a8a]
- [x] T053 [US7] Tests: `test/component/automation/listen.spec.ts`, `test/integration/runtime/listen.spec.ts`
- [ ] T054 [US7] `listen.foreach` in acceptance order and an `until` of events (US7 AS5; refused at publish now)
- [ ] T055 [US7] Journey for SC-005 to SC-007 with 10,000 waiting instances

## US5 — Receive webhooks from other applications (P2)

- [x] T060 [US5] `Webhook` and `WebhookToken`; create, list, delete; `POST /hooks/{token}` with the caller's `Idempotency-Key` as the event id; migration 0010 [5b4da39]
- [x] T061 [US5] `Webhook.receive` names the source; the API mapper drops `Authorization` and `Cookie` [a9f9990]
- [x] T062 [US5] Tests: `test/component/automation/webhooks.spec.ts`, `test/unit/domain/automation/webhook.spec.ts`
- [ ] T063 [US5] SC-008 measured: webhook calls acknowledged within 1 s at the 95th percentile under load

## US4 — Start workflows on a schedule and on events (P2)

- [x] T070 [US4] Turn on and off; `cron` (UTC) and `every` as engine schedules; `after` as a chain of delayed links; `schedule.on` through its consumer's inbox; migration 0011 [b4ddb40]
- [x] T071 [US4] The runtime reads a schedule's timing; `Workflow` decides the scheduled version and one chain at a time; `EngineCronModule` [2e13a75]
- [x] T072 [US4] Tests: `test/component/automation/schedules.spec.ts`, `test/unit/application/automation/schedules.spec.ts`, `test/unit/domain/automation/workflow.lifecycle.spec.ts`
- [x] T073 [US4] A workflow's `schedule.on` is never satisfied by a lifecycle event of its own instances (edge case): `Workflow.startScheduledInstance` with `lifecycleOf`
- [ ] T074 [US4] Exactly once across two workers and one missed occurrence after downtime, in a journey (US4 AS1, AS6)

## US8 — Keep credentials for workflows (P2)

- [x] T080 [US8] `Secret`; create, list, replace, delete; sealed with AES-256-GCM through `CryptoModule`; migration 0012 [29405ec, dc19774]
- [x] T081 [US8] Publish refuses a foreign `use.secrets` name and an undeclared secret policy; values read per execution and never journaled; masking; the engine's payload codec [29405ec]
- [x] T082 [US8] Tests: `test/component/automation/secrets.spec.ts`
- [ ] T083 [US8] SC-011 sweep of records, events, deliveries and logs across all suites for the test secrets

## US6 — Deliver events to other applications (P2)

- [x] T090 [US6] `Subscription`; create, list, read with recent deliveries, delete; the `delivery` read model; migration 0013 [1794679]
- [x] T091 [US6] Deliveries as `delivery` engine runs: structured mode, the owner's secret, the address policy, 36 attempts over about 24 h, 4 at once and 1 per subscription [1794679]
- [x] T092 [US6] `Subscription.create` refuses a foreign secret; `DeliverEvent` reports, the log writes; the delivery client masks the secret [2fd7d61]
- [x] T093 [US6] Tests: `test/component/automation/subscriptions.spec.ts`, `test/integration/delivery/undici-delivery.client.spec.ts`
- [ ] T094 [US6] SC-009 journey: a receiver down for 10 minutes while workers are killed

## US9 — Suspend, resume and cancel an instance (P3)

- [x] T100 [US9] Suspend, resume, cancel (awaited children in the same transaction), restart and delete; the engine told through the outbox [91bef79, 0aecef6]
- [x] T101 [US9] Tests: `test/component/automation/control.spec.ts`, `test/unit/domain/automation/workflow-instance*.spec.ts`

## Cross-cutting

- [x] T110 QA: a unit suite of 270 tests over every phase and operation [0aecef6]; the runtime against DSL 1.0.3 [16d746c]
- [x] T111 Load: k6 scenarios for publishing, runs, reads and a soak in `test/load/` [1b1d8d8]; their four findings fixed [a4ae5dd]
- [x] T112 Critics: DDD and Clean Architecture on the runtime slices, research R19 [2fd7d61, 2e13a75, a9f9990, 30c817b]
- [x] T113 Artifacts: spec, plan, research, data model, architecture, contract and tasks synchronized with HEAD
- [ ] T114 Owner's decisions on the open tensions of research R19 (domain services, branches in use cases, reads that load aggregates)
- [ ] T115 `apps/api/README.md` and the thesis text in `/Users/vladislavsevyrev/vscode/kpi/Master-s-dissertation`
- [ ] T116 A test that the generated OpenAPI document equals `contracts/openapi.yaml`; today `test/component/open-api.spec.ts` checks only that every route is described
- [ ] T117 Map every FR, ER and edge case to its tests (SC-013)
- [ ] T118 Run every scenario of `quickstart.md`
- [ ] T119 Definition of done: `pnpm lint`, `pnpm check-types`, and `test`, `test:int`, `test:ctk` and `test:e2e` green with nothing skipped
