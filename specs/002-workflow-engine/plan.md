# Implementation Plan: Workflow Engine

**Branch**: `002-workflow-builder` | **Date**: 2026-10-28, updated 2026-11-03 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/002-workflow-engine/spec.md`

## Summary

This feature is the core of the automation platform: a durable, horizontally scalable runtime for the Open Workflow Specification DSL 1.0.3, for the subset of FR-011.

- **Runtime (frameworks).** The DSL is the standard's language. A runtime in `frameworks/runtime` checks documents as a compiler would and executes them with the standard's semantics on `@nestjs/workflows`: one durable step per task (research R1, R2).
- **Domain.** The domain keeps what the platform decides: publishing and archiving, the instance lifecycle, webhooks, secrets and subscriptions.
- **Use cases.** They orchestrate.
- **Adapters.** They only map.
- **Libraries.**
  - `@nestjs/workflows` runs instances, schedules and deliveries.
  - `@nestjs/outbox` dispatches every accepted event after the commit.
  - `@nestjs/idempotency` makes starts idempotent.
  - `@nestjs/resilience` bounds outbound work and the jq and Ajv workers.

Structure and behaviour: [architecture.md](architecture.md). Model: [data-model.md](data-model.md). Decisions and their sources: [research.md](research.md).

## Technical Context

|                          |                                                                                                                                                                  |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Language/Version**     | TypeScript 6.0.3, Node 26.13.0 LTS (ESM, SWC)                                                                                                                    |
| **Primary Dependencies** | NestJS 12 with `@nestjs/workflows`, `@nestjs/outbox`, `@nestjs/idempotency`, `@nestjs/resilience`; the DSL tooling of research R18; the go-judge sandbox service |
| **Storage**              | PostgreSQL through Drizzle 0.45, plus the `nest_workflows` and `nest_outbox` schemas                                                                             |
| **Testing**              | Vitest 5, supertest, Testcontainers, `quickpickle` (CTK), undici `MockAgent`, `ManualWorkflowClock`, `OutboxRelay.runOnce`, k6 for load                          |
| **Target Platform**      | Linux containers (the existing Dockerfile and Compose)                                                                                                           |
| **Project Type**         | Web service: `apps/api` only                                                                                                                                     |
| **Performance Goals**    | SC-004 to SC-010                                                                                                                                                 |
| **Constraints**          | The engine's per-instance journal limit (accepted); the limits of FR-021; external calls at least once                                                           |
| **Scale/Scope**          | Identical processes in any number; 10,000 waiting instances; 9 user stories                                                                                      |

No NEEDS CLARIFICATION remains.

## Constitution Check (3.0.1)

| Gate                                         | Result                                                                                                                                                                               |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| I. Web/API separation                        | Pass: API only                                                                                                                                                                       |
| II. Documentation first, first-party modules | Pass. Each mechanism cites its docs (research). Custom code fills only the gaps: the idempotency Drizzle store, the address policy, the cipher and the CTK steps                     |
| III. Clean Architecture                      | Pass. Dependencies point inward, no adapter group imports another, and the DSL runtime sits in frameworks behind the adapters' contracts (R1)                                        |
| IV. DDD, simply                              | Pass with the open tensions of research R19. Six aggregates (Workflow, WorkflowVersion, WorkflowInstance, Webhook, Secret, Subscription), each with what it protects (data-model §3) |
| V. CQS                                       | Pass: commands are use cases; reads go through query ports into read models                                                                                                          |
| VI. Tests                                    | Pass so far: the table below. The US3 journeys are open (tasks.md)                                                                                                                   |
| VII. Security                                | Pass: architecture.md §11                                                                                                                                                            |
| VIII. OpenTelemetry                          | Pass: auto-instrumentation only; undici is not instrumented, because authors' URLs and headers would leak                                                                            |
| IX. Simplicity                               | Pass: every dependency is justified (research R18)                                                                                                                                   |

**Test plan:**

| What                                                           | Test type                              | Location                                                   |
| -------------------------------------------------------------- | -------------------------------------- | ---------------------------------------------------------- |
| Domain                                                         | Unit                                   | `test/unit/domain/automation`                              |
| Use cases                                                      | Unit with fakes                        | `test/unit/application/automation`                         |
| The runtime's checks and execution, on an in-memory durability | Integration                            | `test/integration/automation`, `test/integration/runtime`  |
| Repositories, the delivery client                              | Integration on PostgreSQL, `MockAgent` | `test/integration/automation`, `test/integration/delivery` |
| HTTP, with the engine and the relay drained                    | Component                              | `test/component/automation`                                |
| CTK                                                            | Gherkin over HTTP                      | `test/conformance`                                         |
| Load                                                           | k6                                     | `test/load`                                                |
| Fault injection and scale-out                                  | e2e (open)                             | `test/e2e`                                                 |

## Project Structure

### Documentation (this feature)

```text
specs/002-workflow-engine/
├── spec.md  plan.md  research.md  data-model.md  architecture.md  quickstart.md  tasks.md
├── contracts/openapi.yaml
└── checklists/requirements.md
```

### Source Code

The layers and folders are in [architecture.md §1](architecture.md#1-layers-and-grouping):

- `apps/api/src/domain/automation/{workflows, instances, webhooks, secrets, subscriptions}/`
- `apps/api/src/application/automation/{workflows, instances, events, schedules, webhooks, secrets, subscriptions}/`
- `apps/api/src/interface-adapters/{api, persistence, messaging, workflows, mailing}/`
- `apps/api/src/frameworks/{runtime, workflows, outbox, undici, jq, ajv, piscina, go-judge, crypto, di, …}/`
- `apps/api/drizzle/0004`–`0013` (data-model §8)

**Structure Decision**: The existing API is extended in place, in the identity code's style. There is one new bounded context, `automation`.

## Slices

Each slice ran in this order: domain, application, adapters and frameworks, with tests; then the critics on the diff (research R19). Tasks and their status: [tasks.md](tasks.md).

| Slice             | Delivered                                                                                  | Commits                                              |
| ----------------- | ------------------------------------------------------------------------------------------ | ---------------------------------------------------- |
| Rework            | The runtime owns the DSL; publish, archive, conformance                                    | 2a75b67                                              |
| US2 Run           | Instances on the runtime; processes and sub-workflows; lifecycle events; problem responses | 91bef79, d4bb301, 0aecef6, d04c4b4                   |
| US7 Events        | The event store, the intake, listeners and signals                                         | 0aecef6, 2e52a8a                                     |
| Load and QA       | k6 scenarios and their fixes; DSL 1.0.3 fixes                                              | 1b1d8d8, a4ae5dd, 16d746c                            |
| US5 Webhooks      | Webhooks and the hook route                                                                | 5b4da39                                              |
| US4 Schedules     | On/off, cron, every, after, `schedule.on`                                                  | b4ddb40                                              |
| US8 Secrets       | Sealed secrets, publish-time ownership, masking                                            | 29405ec                                              |
| US6 Subscriptions | Deliveries as engine runs                                                                  | 1794679                                              |
| Critics           | Round 19 fixes; bare expressions; conformance in one place                                 | c6bda66, 2fd7d61, 2e13a75, a9f9990, 30c817b, dc19774 |
| US3 Durability    | Limits and journeys                                                                        | open                                                 |

## Complexity Tracking

| Complexity                                       | Why needed                                                             | Simpler alternative rejected because                                                 |
| ------------------------------------------------ | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| 1. A DSL runtime in the frameworks layer         | The standard's semantics must run durably, step by step                | A domain interpreter put the standard's rules in the platform's domain (research R1) |
| 2. Two records of execution (journal and tables) | `@nestjs/workflows` is required; the tables are what users read        | Reading the journal would tie the API to the engine's storage                        |
| 3. Worker pools for jq and Ajv                   | A runaway expression or schema must be stopped (constitution VII)      | Synchronous WASM and Ajv cannot be interrupted on the main thread                    |
| 4. The go-judge service                          | Scripts and shell commands must run isolated, with no network (FR-012) | `node:vm` and `isolated-vm` run in process and support JavaScript only               |
