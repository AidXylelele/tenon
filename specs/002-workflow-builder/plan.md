# Implementation Plan: Workflow Builder and Core Nodes

**Branch**: `002-workflow-builder` | **Date**: 2026-10-12 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/002-workflow-builder/spec.md`

## Summary

This feature builds the core of the automation platform in the Automation bounded context: workflows that are built, versioned, activated, run and observed through the API.

- **Workflows and drafts**: a `Workflow` aggregate owned by its creator holds the draft graph. The draft is saved whole with its revision, validated against the node catalogue and published as immutable numbered versions.
- **Runs**: they execute on `@nestjs/workflows`.
  - A run is one durable engine instance over the graph snapshot. The domain's `RunExecution` decides the node order, skips, error handling and limits; the `run` workflow adapter drives it with engine steps. The engine is used only in interface adapters, never through application ports.
  - Each node is one durable step (the checkpoint), or, for orchestrating nodes (Wait, Execute Workflow and future AI agents), a composition of steps, sleeps, signals and child runs.
  - Node outputs are chunked JSON Lines in S3-compatible object storage, and step rows hold only metadata.
- **Node catalogue**: 29 core nodes, each a manifest and an executor registered from dependency injection, with parameter schemas in zod served as JSON Schema for a no-code editor.
  - Formulas run in an own safe interpreter over `acorn`.
  - The Code node runs JavaScript, TypeScript and Python in a go-judge sidecar.
  - The HTTP Request node uses the first-party HTTP client behind a connect-time SSRF guard and stored, encrypted credentials. Its pagination is configured declaratively (FR-037, research R23): ready-made choices for page number, offset, cursor and next link (including the `Link` header), completion conditions, a records path, and n8n-style formulas for unusual APIs, with cycle detection, per-page retries that honour `Retry-After`, and always-bounded page counts.
- **Triggers**: the manual trigger, schedules through engine schedules, webhooks with secrets and delivery deduplication, sub-workflows and error workflows.
- **History and retention**: a nightly retention job and a maintenance sweep keep history bounded and the run rows consistent.
- **Deployment**: one image runs in two roles, API and worker, and the worker scales by replicas.

## Technical Context

**Language/Version**: TypeScript 6.0.x on Node.js 24.21.0 (pinned; `engines >=24.15.0`), ESM. The sandbox runs Node.js 24.21.0 and CPython 3.14.

**Primary Dependencies**:

- Existing: NestJS 12.1.2 with the packages of feature 001 (authentication, authorization, outbox, mail, cls-transactional, Drizzle, zod 4.6.5, pino, OpenTelemetry).
- New, all pinned exactly (research R22):

  | Package               | Version           | Use                                               |
  | --------------------- | ----------------- | ------------------------------------------------- |
  | `@nestjs/workflows`   | 0.0.2             | Durable execution                                 |
  | `@nestjs/http-client` | 0.0.2             | HTTP Request node                                 |
  | `@nestjs/idempotency` | 0.0.2             | Webhook delivery and resume-call deduplication    |
  | `@nestjs/resilience`  | 0.0.2             | HTTP page retries, sandbox and storage policies   |
  | `re2js`               | 2.8.6             | Linear-time regular expressions for user patterns |
  | `undici`              | 7.30.0            | Outbound HTTP agent with the SSRF guard           |
  | `ipaddr.js`           | 2.5.0             | IP address classification for the SSRF guard      |
  | `@aws-sdk/client-s3`  | 3.1149.0          | Artifact store                                    |
  | `acorn`               | 8.19.0            | Formula parser                                    |
  | `luxon`               | 3.7.2             | Dates                                             |
  | `cheerio`             | 1.2.0             | HTML node                                         |
  | `fast-xml-parser`     | 5.11.2            | XML node                                          |
  | `marked`              | 18.1.0            | Markdown node                                     |
  | `turndown`            | 7.2.4             | Markdown node                                     |
  | `amaro`               | pinned when added | TypeScript transpilation for the Code node        |
  | `testcontainers`      | 12.2.0 (dev)      | Test containers                                   |

- Sandbox image: go-judge v1.13.2.

**Storage**:

- PostgreSQL 18.6: application tables `workflow`, `workflow_version`, `activation`, `webhook_endpoint`, `credential`, `run`, `step`, `node_sample`, `retention_settings` and `idempotency_key`; the engine schema `nest_workflows`; the outbox schema `nest_outbox`.
- Object storage, S3-compatible: Garage v2.4.1 locally and in tests, for step output chunks, diagnostics and resume bodies.

**Testing**: Vitest 5.0.3 with the constitution's layers (research R20).

- Domain: unit tests with real objects, including `RunExecution` traversal and draft validation. Use cases: unit tests on in-memory fakes of the ports.
- Integration: Testcontainers PostgreSQL, Garage and the sandbox image; the engine gateways on the real store with `ManualWorkflowClock` and `drain()`.
- Component: the in-process app with the worker drained.
- End-to-end: journeys against Compose, including a worker kill.

**Target Platform**: Linux containers.

- One API image in roles `api` and `worker`.
- The sandbox image as a privileged sidecar of the worker, on nodes with user namespaces, in a namespace at the privileged Pod Security level; the worker is not ready while the sandbox does not answer (DR-006).
- Compose adds `worker`, `sandbox`, `objects` (Garage) and `httpbin` (the HTTP Request test target).

**Project Type**: web-service (API and worker; `apps/web` untouched).

**Performance Goals**:

- SC-001: a 10-node, 100-item test run finishes within 10 s.
- SC-004: webhook calls acknowledged within 1 s at p95.
- SC-008: run lists and output pages within 2 s with 10,000 runs.
- Throughput comes from worker replicas; per-run execution is sequential.

**Constraints**:

- Only engine-native durability.
- Journal payloads hold references only, about 300 entries for 200 nodes, under the 10,000-entry limit.
- `run()` performs no I/O outside the context.
- Every limit of the spec is enforced in the writers and executors.
- Zero known critical or high vulnerabilities in the images and dependencies.
- No real-time channels: polling with `ETag`.

**Scale/Scope**:

- Single tenant, tens of users, hundreds of workflows, up to 200 nodes per workflow.
- Thousands of runs per day, 10,000 retained runs per workflow.
- About 30 endpoints under `/api/v1`.

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Gate                        | Status | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| --------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I. Web/API separation       | PASS   | Only `apps/api` changes, and the contract is `contracts/openapi.yaml`. Catalogue forms come from JSON Schema, so the web needs no shared code.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| II. Documentation-first     | PASS   | Sources: the NestJS docs pages Workflows, Outbox, Idempotency, Resilience, HTTP client, Authorization and Validation, the `@nestjs/workflows` type declarations, the go-judge API, and the AWS SDK S3 configuration. First-party modules are used: `@nestjs/workflows`, `@nestjs/http-client`, `@nestjs/outbox` for schedule synchronisation, `@nestjs/idempotency` for webhook and resume deduplication, `@nestjs/resilience` for page retries and the sandbox and storage policies. Custom code is limited to the gaps no first-party mechanism covers, the formula interpreter and the SSRF connector (Complexity Tracking).                                                                                                                                                                                                                                                                    |
| III. Clean Architecture     | PASS   | `domain` holds the aggregates and value objects and owns the rules: draft validation (`WorkflowDraft.validate`), traversal (`RunExecution`), retry decisions (`NodeSettings`), parameter resolution (`ParameterValues`) and the projection of engine states (`Run.project`); `NodeType` sees parameters only through the `ParameterSchema` interface. `application` holds linear use cases without `try`/`catch` and declares its ports as abstract classes in `interfaces.ts`; no port re-declares the engine. The engine is used only in `interface-adapters`: the workflow classes drive the run loop and catch step failures, and controllers and handlers start, cancel and signal runs and sync schedules in the request transaction. S3, go-judge, undici, acorn and zod live in `interface-adapters` and `frameworks`. Use cases are assembled by factory providers in `AutomationModule`. |
| IV. DDD, simply implemented | PASS   | Aggregates follow the Invitation style (data-model.md): Workflow (draft, owner, `version`), Activation, WebhookEndpoint, Credential and Run. WorkflowVersion and Step are entities, and the graph, parameter values, settings and validation report are value objects. Aggregates reference each other by id, and invariants are enforced by behaviour methods and unique indexes.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| V. CQS                      | PASS   | Commands: create, rename, save draft, publish, archive, restore, duplicate, transfer, pin, activate, deactivate, rotate secret, credential CRUD, start, cancel, resume and retention. Queries: get and list workflows, versions, runs, step output, credentials, catalogue and settings. Each command is one transaction opened at the controller, and the controller's engine `start`, `cancel` and `signal` calls join it. Queries have no side effects: `GET /runs/{id}` returns the row as stored, and only the maintenance sweep repairs stale rows.                                                                                                                                                                                                                                                                                                                                          |
| VI. Verified by tests       | PASS   | Research R20: every layer is covered at its lowest observing level; the engine runs against its real PostgreSQL store; a crash-recovery test runs on two app instances; the sandbox is real in integration and faked only in component tests (an unmanaged dependency).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| VII. Security by design     | PASS   | Controls: object-level ownership policies; credentials and webhook secrets under AES-256-GCM with versioned keys and write-only APIs; a connect-time SSRF guard on every redirect hop and every pagination page; credentials never sent to another origin by a next link; a sandbox with no network, no host files, seccomp and cgroup limits on loopback with a token; formulas evaluated by the expression sandbox of constitution 3.1.0 (no host code, allow-listed operations on JSON copies, 100 ms and 1 MB bounds); user payloads treated as opaque data within 1 MB and 64 nesting levels (constitution 3.1.0); signed resume addresses; constant-time secret checks; size limits on every ingress, with request-rate limits left to the API gateway (constitution: anonymous endpoints are rate limited, here at the gateway); images pinned and scanned.                                 |
| VIII. OpenTelemetry         | PASS   | Auto-instrumentation covers http, pg, undici and aws-sdk. One manual span per node step lives in `interface-adapters/workflows`, with identifiers only, and no telemetry calls appear in `domain` or `application`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| IX. Simplicity              | PASS   | Execution is sequential topological; no parallel-branch scheduler, no cache layer, no event bus. Every addition is listed in Complexity Tracking with the simpler alternative it beats.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |

**Security requirements review**, against the constitution's attack vectors:

| Attack vector            | Control                                                                                                                                                                               |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Injection                | Parameterised Drizzle queries; formulas parsed, never compiled                                                                                                                        |
| Broken authorisation     | Route policies plus ownership checks on the loaded aggregate                                                                                                                          |
| Mass assignment          | Strict DTO classes (`ValidationPipe` with whitelist and forbid-non-whitelisted); node parameters checked by their `z.strictObject` schemas                                            |
| Insecure deserialisation | JSON only, at most 64 nesting levels; XML entities off                                                                                                                                |
| SSRF                     | Connect-time guard                                                                                                                                                                    |
| Race conditions          | Optimistic `version`, unique indexes, engine id deduplication                                                                                                                         |
| Denial of service        | Item, byte, time and journal limits, a per-workflow concurrency limit, body caps; request-rate limits at the API gateway (Envoy Gateway in the Helm chart), never in the applications |
| Information leakage      | Write-only secrets, pino redaction, error messages built from codes                                                                                                                   |
| Supply chain             | Exact pins, `minimumReleaseAge`, Trivy pinned by digest                                                                                                                               |
| Secret exposure          | Keys only from the environment                                                                                                                                                        |

Post-design re-check (after Phase 1): all PASS; additions and deviations are listed in Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/002-workflow-builder/
├── plan.md              # This file
├── research.md          # Phase 0: R1–R22
├── data-model.md        # Phase 1: aggregates, value objects, tables, object storage, engine instances
├── quickstart.md        # Phase 1: validation guide
├── contracts/           # openapi.yaml, http-request-pagination.schema.yaml
├── checklists/          # requirements.md (spec quality)
└── tasks.md             # Phase 2 output (/speckit-tasks)
```

### Source Code (repository root)

```text
apps/api/
├── sandbox/                          # go-judge image: Dockerfile, mount.yaml, harness/{harness.cjs, harness.py},
│                                     # js/package.json (luxon, lodash), py/requirements.txt (hashes)
├── drizzle/                          # + automation tables migration, retention_settings seed
├── src/
│   ├── main.ts                       # ROLE=api → HTTP application; ROLE=worker → application context, worker enabled
│   ├── domain/                       # + workflow.ts, workflow-version.ts, workflow-draft.ts (validation), workflow-graph.ts
│   │                                 #   (graph, nodes, connections, structural rules, rename rewrite), node-type.ts,
│   │                                 #   node-settings.ts (retry decisions), parameter-values.ts (resolution),
│   │                                 #   run-execution.ts (traversal), validation-report.ts, activation.ts, webhook-endpoint.ts,
│   │                                 #   credential.ts, run.ts, step.ts, node-sample.ts, retention-settings.ts, limits.ts,
│   │                                 #   run-id.ts (derived identifiers); errors.ts, interfaces.ts extended
│   ├── application/
│   │   ├── interfaces.ts             # + commands, outputs, ports: WorkflowRepository, WorkflowQueries, ActivationRepository,
│   │   │                             #   WebhookEndpointRepository, CredentialRepository, CredentialQueries, RunRepository,
│   │   │                             #   RunHistoryReader, NodeSampleRepository, RetentionSettingsRepository, ArtifactStore,
│   │   │                             #   StepData, DraftFacts, SecretCipher, Signer, NodeTypeCatalog, NodeExecutor,
│   │   │                             #   FormulaEngine (no port re-declares the engine)
│   │   ├── policies/                 # + workflow.policy (author, manage), credential.policy (manage), settings.policy (manage)
│   │   └── use-cases/                # workflows: create-workflow, rename-workflow, save-draft, publish-workflow-version,
│   │                                 #   archive-workflow, restore-workflow, duplicate-workflow, transfer-workflow, pin-node-sample,
│   │                                 #   unpin-node-sample, get-workflow, list-workflows, list-workflow-versions, get-workflow-version
│   │                                 # activation: activate-workflow-version, deactivate-workflow, sync-workflow-schedules,
│   │                                 #   list-webhook-endpoints, rotate-webhook-secret
│   │                                 # credentials: create-credential, update-credential, delete-credential, list-credentials, get-credential
│   │                                 # runs: start-manual-run, start-webhook-run, start-scheduled-run, resume-run, cancel-run,
│   │                                 #   get-run, list-runs, get-step-output
│   │                                 # execution: register-run, execute-node-step, record-node-failure, finish-run, terminate-run,
│   │                                 #   list-stale-runs, project-run-state, apply-retention
│   │                                 # settings and catalogue: get-retention-settings, update-retention-settings, list-node-types
│   ├── interface-adapters/
│   │   ├── http/                     # controllers: workflows, runs, credentials, node-types, ingress (webhooks, resume), settings;
│   │   │                             # guards/ (webhook-ingress.guard: endpoint, method, secret → uniform 404;
│   │   │                             #   resume.guard: optional header credential)
│   │   │                             # dto/, presenters/ (workflow, version, run, credential, node-type), filter mappings extended
│   │   ├── workflows/                # run.workflow (drives RunExecution with engine steps), scheduled-trigger.workflow,
│   │   │                             # maintenance.workflow, retention.workflow, activation-outbox.handler (engine schedules)
│   │   ├── node-types/               # registry.ts (NodeTypeCatalog), parameters.ts (zod ParameterSchema, ParameterValue union),
│   │   │                             # io/ (chunk reader and writer, limits), <type>/{manifest.ts, executor.ts} × 29,
│   │   │                             # http-request/pagination.ts (pagination loop, guards, Link header reader)
│   │   ├── formulas/                 # acorn-formula.engine.ts (FormulaEngine), allowed members, Luxon helpers
│   │   ├── sandbox/                  # go-judge.gateway.ts (CodeSandboxGateway), typescript.transpiler.ts
│   │   ├── storage/                  # s3-artifact.store.ts, aes-gcm.secret-cipher.ts, hmac.signer.ts
│   │   └── persistence/              # + schema, repositories, mappers, queries for the nine tables;
│   │                                 #   drizzle-idempotency.store.ts (IdempotencyStore of @nestjs/idempotency)
│   └── frameworks/
│       ├── di/                       # + automation.module, workflows-infra.module, storage.module, outbound-http.module;
│       │                             # config.module (ROLE, worker, storage, sandbox, keys, allow-list, limits)
│       ├── s3/                       # S3 client factory
│       └── undici/                   # guarded outbound Agent factory
└── test/
    ├── support/                      # + Garage and sandbox containers, fake gateways, graph builders, test node types,
    │                                 #   worker drain and ManualWorkflowClock helpers, local HTTP target
    ├── unit/{domain,application,node-types,formulas}/
    ├── integration/{persistence,storage,workflows,sandbox,outbound}/
    ├── component/                    # workflows, drafts, publish, activation, runs, credentials, ingress, retention
    └── e2e/                          # journeys incl. worker restart mid-run

compose.yaml                          # + worker (profile app), sandbox (network_mode service:worker), objects (Garage), httpbin
infra/garage/garage.toml              # single-node Garage for Compose and the test container
.env.example, .github/workflows/ci.yml (sandbox image build and scan, workflows:migrate, secret scanning), docs/architecture/* (R21)
```

**Structure Decision**: Flat Clean Architecture layers inside `apps/api/src`, as the constitution and `docs/architecture/03-api.md` prescribe. `AutomationModule` assembles the Automation context the way `IdentityAccessModule` assembles Identity & Access. Engine entry adapters live in `interface-adapters/workflows` and node types in `interface-adapters/node-types/<type>/`. Each new technology gets one factory in `frameworks`. The sandbox image is a deployable of the API application and lives next to its Dockerfile.

## Complexity Tracking

| Addition or deviation                                                                                                                     | Why it is needed                                                                                                                                                                     | Simpler alternative rejected because                                                                                                                               |
| ----------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Own formula interpreter over `acorn`                                                                                                      | FR-015 needs n8n-style formulas evaluated safely and fast in process; NestJS has no evaluator                                                                                        | Available engines either execute generated code, carry non-OSI licences, have unpatched critical advisories or speak another language (R10)                        |
| Connect-time SSRF connector (undici `connect` with a guarded `lookup` and an IP-literal check)                                            | FR-038 and the constitution's outbound rule; the first-party client takes an undici dispatcher but has no address policy                                                             | `net.BlockList` is ignored by `tls.connect` on Node 24; agent-based libraries target `http.Agent` only (R12)                                                       |
| `WebhookEndpoint` as its own aggregate (01-domain.md places endpoints inside Activation)                                                  | Webhook addresses must stay stable across drafts, versions and activations, and their secrets rotate                                                                                 | Endpoints inside Activation would change on every publish and break callers                                                                                        |
| `scheduled-trigger` workflow between engine schedules and runs                                                                            | Gives scheduled runs a queued row, a per-run timeout and overlap skipping over the whole run (FR-026)                                                                                | Schedules starting `run` directly cannot set a timeout, and overlap would cover only the start (R6)                                                                |
| `maintenance` workflow (every minute)                                                                                                     | The engine's events are in-process only; steps and compensation cover normal paths, and the sweep covers terminate, definition errors and lost compensations (R4)                    | Relying on `events$` (as 04-execution.md said) loses terminal states                                                                                               |
| Schedule synchronisation through the outbox                                                                                               | Engine schedule upserts are not transactional; the outbox delivers "activation changed" exactly when the activation commits                                                          | Upserting in the request risks schedules for rolled-back activations; upserting after commit loses them on a crash                                                 |
| Run concurrency limit read from `process.env` at import                                                                                   | Decorator options are evaluated at import time; the same variable is validated by the config schema                                                                                  | A per-workflow limit would need admission control on top of the engine (R7)                                                                                        |
| Retry attempts = max(user attempts, 3) + 2 with `retryIf`, raised for an unknown node type version                                        | The engine counts a crashed attempt; FR-020 requires the node to run again after a crash                                                                                             | `retry: false` fails the node after any worker crash (R5)                                                                                                          |
| Derived UUIDv8 run identifiers                                                                                                            | Deliveries, occurrences, child calls and error runs must map to the same run on every replay and redelivery                                                                          | Random ids break exactly-once starts and journal determinism                                                                                                       |
| Policies called inside use cases for ownership                                                                                            | Ownership is a record check; `@Can` resolvers would load records twice and answer 403 before 404. Policies decide on `ownerId` facts, so owner-only queries need not load aggregates | `AuthorizationService` in a use case imports the framework into the application layer (R14)                                                                        |
| HTTP 422 with `problems` for refused publication and test runs                                                                            | FR-010 requires the full report; the body stays Nest's shape with one added field                                                                                                    | 400 with a flat message list loses node and parameter paths                                                                                                        |
| `node_sample` table for pinned output and known fields                                                                                    | FR-015 field pickers and FR-021 pinned output, kept out of the draft so autosave stays small                                                                                         | Pins inside the draft would resend up to 1 MB per node on every save                                                                                               |
| Garage (AGPL-3.0) as local and test object storage                                                                                        | MinIO images stopped in 2025; Garage is small, active and runs unmodified as a separate service                                                                                      | RustFS had several 2026 advisories; SeaweedFS and LocalStack are heavy or need tokens (R9)                                                                         |
| Privileged sandbox sidecar                                                                                                                | go-judge needs namespaces and cgroups; the sidecar keeps the sandbox on localhost (05-node-types.md)                                                                                 | gVisor cannot enforce per-run cgroups; Firecracker needs KVM (R11)                                                                                                 |
| Pagination loop inside the HTTP Request node, with a request-signature set, per-page transient retries and a small RFC 8288 `Link` reader | FR-037 needs n8n-level flexibility without n8n's restart loops, undetected cycles and whole-node re-runs on a 429; the HTTP client has no pagination                                 | Copying n8n's two expression-only modes keeps every known loop and forces formulas for common APIs; a separate paginate node would need a cycle in the graph (R23) |
| `amaro` in the worker for TypeScript                                                                                                      | Strip-only transpilation keeps line numbers and fails syntax early; the sandbox runs plain JavaScript                                                                                | TypeScript 7 has no programmatic API; type stripping inside the sandbox costs 45 ms per run (R11)                                                                  |
| Bounded in-process memoisation of transpiled TypeScript and compiled RE2 patterns                                                         | Transpiling or compiling per item would dominate Code node and condition evaluation                                                                                                  | A shared cache layer (rejected: process-local maps bounded by entry count need no infrastructure)                                                                  |

**Spec refinements made while planning**, recorded in spec.md:

- FR-022: the run timeout counts from the start request, including queued time.
- FR-031: at most 4,000 sub-workflow calls per run, to fit the engine journal budget.
- FR-033: 32 processes and threads instead of 16, because the sandbox counts Node's threads.
- Data model: one resume-mode Wait per graph (the resume address is per run).
- FR-005: transferring ownership never deactivates; nodes that use the previous owner's credentials fail until the new owner replaces them.
- FR-013 and FR-016: node types declare default settings.
- FR-021: an unknown node type version is retried for up to 15 minutes, to bridge rolling updates.
- FR-025, FR-027, FR-030: user payloads are opaque JSON nested at most 64 levels (constitution 3.1.0).
- FR-033: limit breaches have the kind `limit` and isolation breaches the kind `isolation`.
- DR-006: Kubernetes verification belongs to the Helm chart feature; Compose implements the sidecar and the readiness dependency.
- Catalogue: Wait in resume mode adds `resume` (`body`, `receivedAt`) to each item.
