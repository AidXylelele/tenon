# Implementation Plan: Workflow Engine

**Branch**: `002-workflow-builder` | **Date**: 2026-10-28 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/002-workflow-engine/spec.md`

## Summary

This is the core of the automation platform: a durable, horizontally scalable runtime for the Open Workflow Specification DSL 1.0.3, for the subset of FR-011.

- **Domain.** The domain owns the standard's semantics: stages, flow, composites, catch and retry, phases, correlation and publication rules. It hands out the four computations it cannot do: expressions, schemas, service calls, and script or shell processes. Processes run in the go-judge sandbox. This is the split Synapse's executors already have, moved into Clean Architecture layers (research R1).
- **Use cases** only orchestrate.
- **Libraries.**
  - `@nestjs/workflows` drives one run per instance in rounds.
  - `@nestjs/outbox` carries every reaction that leaves a transaction, including deliveries to subscribers.
  - `@nestjs/idempotency` makes starts and webhook calls idempotent.
  - `@nestjs/resilience` bounds outbound work.

Structure and behaviour: [architecture.md](architecture.md). Model: [data-model.md](data-model.md). Decisions: [research.md](research.md).

## Technical Context

|                          |                                                                                                                                                                                 |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Language/Version**     | TypeScript 6.0.3, Node 24 (ESM, SWC)                                                                                                                                            |
| **Primary Dependencies** | NestJS 12 with `@nestjs/workflows`, `@nestjs/outbox`, `@nestjs/idempotency`, `@nestjs/resilience`; DSL and HTTP tooling as listed in research R21; the go-judge sandbox service |
| **Storage**              | PostgreSQL through Drizzle 0.45, plus the `nest_workflows` and `nest_outbox` schemas                                                                                            |
| **Testing**              | Vitest 5, supertest, Testcontainers, `quickpickle` (CTK), undici `MockAgent`, `ManualWorkflowClock` with `drain`, `OutboxRelay.runOnce`                                         |
| **Target Platform**      | Linux containers (existing Dockerfile and Compose)                                                                                                                              |
| **Project Type**         | Web service: `apps/api` only                                                                                                                                                    |
| **Performance Goals**    | SC-004 to SC-010                                                                                                                                                                |
| **Constraints**          | Journal limit of 10,000 entries per instance (accepted); 10,000 task executions; the data limits of FR-021; external calls at least once                                        |
| **Scale/Scope**          | Identical processes in any number; 10,000 waiting instances; 9 user stories                                                                                                     |

No NEEDS CLARIFICATION remains.

## Constitution Check (3.0.1)

| Gate                                         | Result                                                                                                                                                                                                  |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I. Web/API separation                        | Pass: API only                                                                                                                                                                                          |
| II. Documentation first, first-party modules | Pass. Each mechanism cites its docs. Custom code fills only the gaps: the idempotency Drizzle store (the module ships none), the SSRF lookup, encryption at rest with `node:crypto`, and the CTK steps. |
| III. Clean Architecture                      | Pass with the drift recorded in Complexity 1. Dependencies point inward; adapters are grouped by agency and import no other adapter folder.                                                             |
| IV. DDD, simply                              | Pass. Nine aggregates, each with a "Protects" line, one owner per rule, and interfaces instead of base classes.                                                                                         |
| V. CQS                                       | Pass: every operation is classified (data-model §4)                                                                                                                                                     |
| VI. Tests                                    | Pass: see the table below                                                                                                                                                                               |
| VII. Security                                | Pass: architecture.md §10                                                                                                                                                                               |
| VIII. OpenTelemetry                          | Pass: auto-instrumentation only                                                                                                                                                                         |
| IX. Simplicity                               | Pass: research R20 removes everything not required                                                                                                                                                      |

**Test plan:**

| Layer                                                                                         | Test type                               | Location                           |
| --------------------------------------------------------------------------------------------- | --------------------------------------- | ---------------------------------- |
| Domain                                                                                        | Sociable unit tests                     | `test/unit/domain/automation`      |
| Use cases                                                                                     | Solitary unit tests with fakes          | `test/unit/application/automation` |
| Repositories, queries, the store, engine rounds, outbox handlers, gateways (with `MockAgent`) | Integration on PostgreSQL               | `test/integration/automation`      |
| HTTP                                                                                          | Component tests with the engine drained | `test/component/automation`        |
| CTK                                                                                           | —                                       | `test/conformance`                 |
| Fault injection and scale-out                                                                 | e2e                                     | `test/e2e`                         |

## Project Structure

### Documentation (this feature)

```text
specs/002-workflow-engine/
├── spec.md  plan.md  research.md  data-model.md  architecture.md  quickstart.md
├── contracts/openapi.yaml
├── checklists/requirements.md
└── tasks.md   (/speckit-tasks)
```

### Source Code (repository root)

The layers and folders are in [architecture.md §1](architecture.md#1-layers-and-grouping):

- `apps/api/src/{domain,application}/automation/<module>/`
- `apps/api/src/interface-adapters/{http,persistence,engine,messaging,documents,expressions,json-schema,endpoints,sandbox,mailing}/` and `interfaces.ts`
- `apps/api/src/frameworks/{di,drizzle,pino,jq,undici,ajv}/` (`jq`, `undici` and `ajv` are new)

Tests go under `apps/api/test/`.

**Structure Decision**: Extend the existing API in place, in the identity code's style. There is one new bounded context, `automation`.

## Slices

Each slice goes in this order:

1. Domain with unit tests.
2. Both critics on the intended code.
3. Application.
4. Adapters.
5. The Clean Architecture critic on the diff.

Each slice adds to `SupportedSubset` the constructs it makes runnable, so the conformance statement stays exact (ER-001). Secrets come before subscriptions because a subscription authenticates with its owner's secrets. Tasks: [tasks.md](tasks.md).

| #   | Slice             | Delivers                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| --- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S0  | Foundation        | Constitution 3.1.0 (separate PR); packages (the user installs them); the go-judge service in Compose from a custom image pinned by digest, with Node.js and Python 3 and no network; outbox 0.1.3; the `engine:migrate` script (`nest-workflows migrate`); `Database`/`DrizzleTx` moved to `interface-adapters/interfaces.ts`; env schema (`SECRETS_KEY`, `OUTBOUND_ALLOW_LIST`, `SANDBOX_URL`, role flags); idempotency store and its contract test; resilience presets with rejecting bulkheads; engine module with tests of `start`/`signal` inside a nestjs-cls transaction, of lease renewal by the heartbeat during a long step, and of a signal sent during `advance-N` being consumed by `park-N`; jq pool with prelude, timeout and DoS tests; SSRF dispatcher tests; quickpickle trial; error classifiers |
| S1  | US1 Publish       | Definition model, Workflow, WorkflowVersion, `SdkDocumentReader`, expression syntax check, `DocumentReferences`, check and publish endpoints, conformance statement                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| S2  | US2 Run           | WorkflowInstance with stages and progress objects; `emit` and lifecycle events stored as produced Events; the four ports and their adapters, including `run: script` and `run: shell` through go-judge; the engine loop; start; history queries; CTK passing except the recorded contradiction                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| S3  | US3 Durability    | Fault-injection and scale-out journeys; limits                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| S4  | US7 Events        | Event intake, Correlation, wait/listen, routing of every Event                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| S5  | US5 Webhooks      | Webhook, token, receiver route                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| S6  | US4 Schedules     | On/off, epoch, engine schedules, `after`, triggers                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| S7  | US8 Secrets       | Secret, encryption at rest, masking, auth policies from secrets                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| S8  | US6 Subscriptions | Subscription (authentication from the owner's secrets), Delivery, routing to subscribers, `CloudEventSubscriberGateway` in `endpoints/` with circuit breakers                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| S9  | US9 Control       | Suspend, resume, cancel, cascading to children                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| S10 | Wrap-up           | README, `.env.example`, and the thesis text corrections                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |

## Complexity Tracking

| Violation                                        | Why Needed                                                                                                                            | Simpler Alternative Rejected Because                                                                                               |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| 1. Constitution drift (R19)                      | The identity code already follows the user's later rules, and a round cannot hold a transaction across a call                         | Rewriting identity, or holding connections during calls                                                                            |
| 2. Nine aggregates                               | Each protects a distinct transaction; the critics confirmed the boundaries                                                            | Merging Correlation into the instance would lock it on every event; without Delivery, the 24-hour rule would live in configuration |
| 3. Rounds with four kinds of work                | A pure domain that owns every decision; recorded results are never recomputed; one round is bounded below the lease (architecture §4) | Executing SDK objects, or an interpreter in adapters, scatters the rules (R1)                                                      |
| 4. Two records of execution (journal and tables) | `@nestjs/workflows` is required; the journal holds only Progress                                                                      | —                                                                                                                                  |
| 5. A jq worker pool                              | A runaway expression must be stopped (constitution VII)                                                                               | Synchronous WASM cannot be interrupted on the main thread                                                                          |
| 6. The go-judge service                          | Scripts and shell commands must run isolated, with no network (FR-012, constitution VII)                                              | `node:vm` and `isolated-vm` run in-process and support JavaScript only; containers need a runtime                                  |
