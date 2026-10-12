# Tasks: Workflow Builder and Core Nodes

**Input**: Design documents from `/specs/002-workflow-builder/`

**Prerequisites**: plan.md, spec.md, research.md (R1–R24), data-model.md, contracts/openapi.yaml, contracts/http-request-pagination.schema.yaml, quickstart.md. The branch includes `master` after PR #13 (constitution 3.0.1, no in-app rate limiter).

**Tests**: Requested by the specification (DR-004, SC-009) and constitution principle VI. Test tasks come before the implementation they cover and must fail first. Each names the requirement, scenario or research decision it covers.

**Organization**:

- Phase 1 adds dependencies, configuration and local services.
- Phase 2 builds the execution core that every story needs: the domain kernel, persistence, the artifact store, the formula engine, the node registry and the durable run interpreter.
- Phases 3–9 are the seven user stories in priority order.
- Phase 10 closes the success criteria, documentation and delivery gates.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on an unfinished task)
- **[Story]**: the user story the task belongs to (US1–US7)
- All paths are relative to the repository root

## Path Conventions

- API layers: `apps/api/src/{domain,application,interface-adapters,frameworks}` (plan.md Project Structure; constitution III).
- Node types: `apps/api/src/interface-adapters/node-types/<type>/{manifest.ts,executor.ts}`, registered in `apps/api/src/frameworks/di/automation.module.ts`.
- Unit tests: `apps/api/test/unit/{domain,application,node-types,formulas,storage,sandbox,http}/*.spec.ts` (`pnpm --filter api test`).
- Integration and component tests: `apps/api/test/integration/{persistence,storage,workflows,sandbox,outbound}/*.spec.ts` and `apps/api/test/component/*.spec.ts` (`pnpm --filter api test:int`).
- End-to-end journeys: `apps/api/test/e2e/*.spec.ts` against Compose (`pnpm --filter api test:e2e`). Test support lives in `apps/api/test/support/` and `apps/api/test/e2e/support/`.
- **Style**: follow the `Invitation` aggregate and `IdentityAccessModule`:
  - `#private` fields, getters, a public constructor taking props, `static create`, and `version` for optimistic concurrency;
  - ports as abstract classes in `application/interfaces.ts`, and use cases built by factory providers;
  - `@Transactional()` on command handlers;
  - awaited values assigned to named variables, and guard clauses separated by blank lines;
  - standard Nest error bodies, plus `problems` on 422.

---

## Phase 1: Setup (dependencies, configuration, local services)

**Purpose**: Pinned dependencies, configuration and the Compose services that every later task relies on (DR-001, DR-003)

- [ ] T001 Add the runtime dependencies of research R22 at exact versions: `pnpm --filter api add @nestjs/workflows@0.0.2 @nestjs/http-client@0.0.2 @nestjs/idempotency@0.0.2 @nestjs/resilience@0.0.2 undici@7.30.0 ipaddr.js@2.5.0 @aws-sdk/client-s3@3.1149.0 acorn@8.19.0 luxon@3.7.2 cheerio@1.2.0 fast-xml-parser@5.11.2 marked@18.1.0 turndown@7.2.4 re2js@2.8.6`. Check that `apps/api/package.json` has no `^` or `~` and that `pnpm audit --prod --audit-level=high` reports nothing.
- [ ] T002 Finish `apps/api/package.json`:
  - add `amaro` at the newest release older than `minimumReleaseAge`, pinned exactly;
  - add the dev dependencies `testcontainers@12.2.0`, `@types/luxon` and `@types/turndown` at exact versions;
  - add the script `"workflows:migrate": "nest-workflows migrate --url \"$DATABASE_URL\""` next to `outbox:migrate` (research R2);
  - replace "pinned when added" with the chosen `amaro` version in `specs/002-workflow-builder/plan.md` (dependency table) and `specs/002-workflow-builder/research.md` (R22).
- [ ] T003 [P] Extend the layer rules in `apps/api/eslint.config.js`. Add `acorn`, `undici`, `ipaddr.js`, `@aws-sdk/*`, `luxon`, `cheerio`, `fast-xml-parser`, `marked`, `turndown`, `re2js` and `amaro` to `frameworkPackages`, so `domain` and `application` cannot import them. The new `@nestjs/*` packages are already covered.
- [ ] T004 [P] Extend the environment schema in `apps/api/src/frameworks/di/config.module.ts` (research R1, R2, R7, R9, R11–R13):
  - `ROLE` (`api` | `worker`, default `api`);
  - `WORKER_CONCURRENCY` (integer 1–100, default 10) and `RUN_CONCURRENCY_PER_WORKFLOW` (integer 1–100, default 5);
  - `DATABASE_POOL_MAX` (integer, default 10);
  - `S3_ENDPOINT` (URL), `S3_REGION` (default `garage`), `S3_BUCKET`, `S3_ACCESS_KEY_ID` and `S3_SECRET_ACCESS_KEY`;
  - `SANDBOX_URL` (URL, default `http://127.0.0.1:5050`) and `SANDBOX_TOKEN` (at least 32 characters);
  - `SECRET_KEYS`: comma-separated `v<n>:<base64>` pairs, each key exactly 32 bytes, parsed into a `Map<number, Buffer>`;
  - `SECRET_KEY_VERSION`: an integer that must be a key of `SECRET_KEYS` (`superRefine`);
  - `SIGNING_KEY`: base64, at least 32 bytes;
  - `HTTP_ALLOWED_HOSTS`: the existing `list` transform, where each entry is an exact host name or a CIDR range checked with `ipaddr.js` `parseCIDR`;
  - `PUBLIC_API_URL`: an absolute URL ending in `/api/v1`, the base of webhook and resume addresses.
- [ ] T005 [P] Add the new variables to `.env.example`, each with one comment line and a local-only placeholder value:
  - `ROLE=api`, `WORKER_CONCURRENCY=10`, `RUN_CONCURRENCY_PER_WORKFLOW=5`, `DATABASE_POOL_MAX=10`;
  - `OBJECTS_PORT=53900`, `HTTPBIN_PORT=53080`, `S3_ENDPOINT=http://127.0.0.1:53900`, `S3_REGION=garage`, `S3_BUCKET=workflow-runs`;
  - `S3_ACCESS_KEY_ID` (`GK` plus 24 hex characters), `S3_SECRET_ACCESS_KEY` (64 hex characters) and `GARAGE_RPC_SECRET` (64 hex characters);
  - `SANDBOX_URL=http://127.0.0.1:5050` and `SANDBOX_TOKEN`;
  - `SECRET_KEYS=v1:<base64 of 32 bytes>`, `SECRET_KEY_VERSION=1` and `SIGNING_KEY`;
  - `HTTP_ALLOWED_HOSTS=httpbin` and `PUBLIC_API_URL=http://127.0.0.1:53000/api/v1`.
- [ ] T006 [P] Create `infra/garage/garage.toml` for a single-node Garage v2.4.1 (research R9):
  - `metadata_dir = "/var/lib/garage/meta"`, `data_dir = "/var/lib/garage/data"`, `db_engine = "sqlite"`, `replication_factor = 1`;
  - `rpc_bind_addr = "[::]:3901"`, and `[s3_api]` with `api_bind_addr = "[::]:3900"` and `s3_region = "garage"`, path-style addressing only;
  - `rpc_secret` comes from `GARAGE_RPC_SECRET`.

  Compose and the test container mount the same file.

- [ ] T007 [P] Extend `compose.yaml` with the volumes and services below (DR-001, research R17). Pin every image by digest resolved with `docker buildx imagetools inspect`.
  - Volumes `objects-meta` (`workflow-platform-objects-meta`) and `objects-data` (`workflow-platform-objects-data`).
  - Service `objects`:
    - image `dxflrs/garage:v2.4.1@sha256:…`, command `/garage server --single-node --default-bucket`;
    - environment `GARAGE_RPC_SECRET`, plus `GARAGE_DEFAULT_ACCESS_KEY`, `GARAGE_DEFAULT_SECRET_KEY` and `GARAGE_DEFAULT_BUCKET` taken from `S3_*`;
    - `infra/garage/garage.toml` mounted read-only at `/etc/garage.toml`;
    - port `127.0.0.1:${OBJECTS_PORT:-53900}:3900`, healthcheck `["CMD", "/garage", "status"]`.

    Confirm the bootstrap flags in the Garage 2.4.1 documentation. If they are missing, add a one-shot `objects-init` service that runs `garage layout assign`, `layout apply`, `key import` and `bucket create`.

  - Service `httpbin`: `mccutchen/go-httpbin:v2.25.0@sha256:…`, port `127.0.0.1:${HTTPBIN_PORT:-53080}:8080`.
  - Service `worker` (profile `app`):
    - image `workflow-platform/api:dev` with `ROLE: worker`, the `api` environment and the new variables, with `S3_ENDPOINT: http://objects:3900` and `PUBLIC_API_URL`;
    - `read_only`, `cap_drop: [ALL]`, `no-new-privileges`, no published port;
    - `healthcheck: { disable: true }` until T097, and `stop_grace_period: 30s`, longer than the 20 s worker shutdown plus 5 s.
  - Add the new variables to `api`. `api` and `worker` depend on `objects` being healthy.
- [ ] T008 [P] Extend `.github/workflows/ci.yml`. In the `image` job, run `pnpm --filter api workflows:migrate` after `outbox:migrate`, and change the failure step to `docker compose logs --no-color api worker`.

---

## Phase 2: Foundational (execution core)

**Purpose**: The domain kernel, ports, persistence, artifact store, formula engine, parameter schemas, node registry and the durable run interpreter on `@nestjs/workflows`

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

### Tests for the domain kernel ⚠️

- [ ] T009 [P] Write `apps/api/test/unit/domain/workflow-graph.spec.ts` first (data-model WorkflowGraph; FR-007, FR-009, FR-019).
  - `problems()` reports:
    - `node-limit` for 201 nodes, `parameters-too-large` for a node whose parameters exceed 256 KB serialised, and `duplicate-node-name`;
    - `unknown-port` for a connection to an unknown node or port, and `cycle` (Kahn's algorithm; every node on the cycle);
    - `no-trigger`, and `unreachable-node` for nodes no trigger reaches;
    - `second-resume-wait` for a second node whose type reports `usesResumeAddress`.
  - `order(triggerNodeId)` is a topological order of the nodes reachable from that trigger, breaking ties by position (x, then y) and then id.
  - `upstreamOf(nodeId)` returns every transitive upstream node.
  - `renamedNodes(previous)` lists `{ id, from, to }` for renamed nodes.
  - `mapFormulas(rewrite)` returns a graph with every `{ formula }` value rewritten, nested collection values included.
- [ ] T010 [P] Write `apps/api/test/unit/domain/workflow.spec.ts` first (data-model Workflow and WorkflowVersion; FR-001, FR-003–FR-005, FR-008, FR-010).
  - `create(name, ownerId)` gives an empty draft with settings `timezone: 'UTC'`, `runTimeoutMs: 3600000` and `errorWorkflowId: null`, `latestVersion` 0 and `version` 1. Names are 1–120 characters.
  - `saveDraft(draft, actorId)` replaces the whole draft and records `draftUpdatedAt` and `draftUpdatedBy`.
  - `publish(report, actorId)` throws `DraftInvalidError` carrying the report when it has errors. Otherwise it returns the `WorkflowVersion` numbered `latestVersion + 1` and increments `latestVersion`.
  - `archive()` and `restore()` toggle `archivedAt`. `rename`, `saveDraft`, `publish` and `transferTo` on an archived workflow throw `WorkflowArchivedError`.
  - `duplicate(name, ownerId, ownedCredentialIds)` returns a workflow owned by `ownerId` whose foreign `credentialId` values are null.
- [ ] T011 [P] Write `apps/api/test/unit/domain/run.spec.ts` first (data-model Run status and Step; FR-018, FR-024).
  - Transitions:
    - `queued → running` (`start`);
    - `running → waiting` (`enterWait`) and `waiting → running` (`leaveWait`);
    - `running → succeeded | failed` (`finish`);
    - `queued | running | waiting → cancelled` (`cancel`, which sets `cancelRequestedAt`);
    - `queued | running | waiting → failed` (`fail` with kind `timeout`, `limit` or `platform`).
  - Any change of a terminal run throws `RunFinishedError`.
  - `createTest` and `createProduction` set `mode`, `versionNumber` (null for test runs), `trigger`, `depth` (0–5; 6 throws) and `actingUserId`.
  - `Step.start(attempt)` overwrites an earlier attempt of the same node, and `succeed(outputs)` and `failWith(error)` set `finishedAt`.
- [ ] T012 [P] Write `apps/api/test/unit/domain/run-id.spec.ts` and `apps/api/test/unit/domain/node-type.spec.ts` first, and extend `apps/api/test/unit/domain/user.spec.ts`.
  - `deriveRunId(key)` is deterministic and distinct for distinct keys. It is a UUID with version nibble `8` and variant `10`, built from the SHA-256 of the key (data-model Engine instances).
  - `NodeType.validate(node)` returns the problems of its `ParameterSchema` with the node id.
  - `outputsFor(parameters)` returns the fixed ports or the ports named by the rule parameter, plus the `error` port when `settings.onError` is `errorOutput`.
  - `User.canAuthor` is true for `editor` and `admin` only.

### Implementation of the domain kernel

- [ ] T013 [P] Add the domain errors of data-model "Domain errors (new)" to `apps/api/src/domain/errors.ts`:
  - `WorkflowNotFoundError`, `WorkflowVersionNotFoundError`, `RunNotFoundError`, `CredentialNotFoundError`, `WebhookEndpointNotFoundError`, `NodeNotFoundError`;
  - `WorkflowAccessDeniedError`, `CredentialAccessDeniedError`;
  - `WorkflowConflictError`, `ActivationConflictError`, `RunConflictError`, `CredentialInUseError`, `DeliveryConflictError`, `ResumeRefusedError`, `WorkflowArchivedError`, `RunFinishedError`;
  - `DraftInvalidError`, holding `report`.

  Also add the node failure classes that executors throw (research R5), subclasses of `DomainError`, each with a readonly `kind`, `nodeId`, an optional `line` and an optional `itemIndex`: `NodeUserError` (`user`), `NodeLimitError` (`limit`), `IsolationBreachError` (`isolation`) and `PlatformError` (`platform`). Their messages are built from codes and never contain credential values (FR-040).

- [ ] T014 [P] Add the props and value types to `apps/api/src/domain/interfaces.ts`:
  - workflow: `WorkflowProps`, `WorkflowVersionProps`, `WorkflowDraft`;
  - `GraphNodeProps`: `id` (UUID), `name` (1–120 characters), `type`, `typeVersion`, `parameters`, `credentialId`, `settings`, `position: [number, number]`, `note` (at most 2,000 characters), `disabled`;
  - `ConnectionProps`: `from: { node, output }`, `to: { node, input }`;
  - `ParameterValue`: `{ fixed } | { ref: { node, path } } | { formula }`;
  - `NodeSettings`: "`alwaysOutputData`, `executeOnce`, `retry` (`attempts` 1–5, `waitMs` 0–300,000), `onError` (`stop`, `continue`, `errorOutput`)", defaults false, false, 1 attempt, `stop`;
  - `WorkflowSettings`: "`timezone` (IANA), `runTimeoutMs` (1 s to 30 days, default 1 hour), `errorWorkflowId`";
  - validation: `Problem`, and `ProblemCode` with the 20 codes of FR-007;
  - runs: `RunStatus`, `RunMode`, `RunTrigger`, `RunErrorKind` (`user`, `limit`, `isolation`, `timeout`, `platform`, `cancelled`), `RunError`, `ErrorWorkflowOutcome`, `RunProps`, `StepProps`, `StepOutput` (`port`, `items`, `bytes`, `chunkStarts`, `attempt`), `FieldShape`;
  - secrets and triggers: `EncryptedSecret` (`ciphertext`, `keyVersion`), `ScheduleRegistration`, `ActivationProps`, `WebhookEndpointProps`;
  - credentials: `CredentialProps`, and `CredentialTypeName` (`httpHeader`, `httpBasic`, `httpBearer`, `httpQuery`);
  - the rest: `NodeSampleProps`, `RetentionSettingsProps`, `NodeTypeProps`, `PortDefinition`.
- [ ] T015 [P] Create `apps/api/src/domain/limits.ts` with `PlatformLimits` and `DEFAULT_LIMITS`, holding every value of spec "Platform limits".
  - Add `PLATFORM_LIMITS` to the schema in `apps/api/src/frameworks/di/config.module.ts`: optional JSON, a strict partial object of positive integers merged over `DEFAULT_LIMITS`, so operators can change any default (spec Assumptions).
- [ ] T016 Implement `apps/api/src/domain/validation-report.ts` and `apps/api/src/domain/workflow-graph.ts` until T009 passes.
  - `ValidationReport` has `errors`, `warnings`, `hasErrors` and `merge`. `unknown-field` is the only warning code.
  - `WorkflowGraph`, `GraphNode` and `Connection` take a `NodeTypeLookup` domain interface that gives ports, trigger kinds and `usesResumeAddress`.
- [ ] T017 Implement `apps/api/src/domain/node-type.ts` until T012 passes for `NodeType`.
  - The fields of data-model NodeType: `id`, `version`, `kind`, `trigger`, `category`, `displayName`, `description`, `parameters`, `credentialTypes`, `inputs`, `outputs` (ports or `{ fromParameter }`), `dataMode` (`item`, `batch`, `all`), `execution` (`step`, `orchestrated`), `effects` (`none`, `external`) and `limits.timeoutMs`.
  - Methods `validate(node)`, `outputsFor(parameters)` and `usesResumeAddress(parameters)`, which is false unless the manifest supplies it.
  - The `ParameterSchema` interface lives here: `validate(parameters): Problem[]`, `describe(): object` and `parse(resolved): unknown`.
- [ ] T018 Implement `apps/api/src/domain/workflow.ts` and `apps/api/src/domain/workflow-version.ts` in the `Invitation` style until T010 passes.
- [ ] T019 Implement `apps/api/src/domain/run.ts` and `apps/api/src/domain/step.ts` until T011 passes.
- [ ] T020 [P] Implement `apps/api/src/domain/run-id.ts` (`deriveRunId(key)` over `node:crypto`) and `canAuthor` in `apps/api/src/domain/user.ts` until T012 passes.

### Ports and policies

- [ ] T021 Declare the Automation commands, outputs and ports in `apps/api/src/application/interfaces.ts` as abstract classes (plan.md Source Code; research R3, R9, R10, R13).
  - **Repositories and queries**:
    - `WorkflowRepository`: `add`, `update` with the optimistic `version`, `getById`, `addVersion`, `getVersion`, `listVersions`;
    - `WorkflowQueries`: `list`, `getView`;
    - `ActivationRepository`, `WebhookEndpointRepository`, `CredentialRepository`, `CredentialQueries`;
    - `RunRepository`: `add` returning the existing run for a duplicate id, `update`, `getById`, `saveStep`, `listStale`;
    - `RunHistoryReader`, `NodeSampleRepository`, `RetentionSettingsRepository`.
  - **Gateways**:
    - `ArtifactStore`: `putChunk`, `getChunk`, `putJson`, `getJson`, `deleteRun`;
    - `StepData`: `writer(runId, nodeId, attempt)`, `reader(outputs)`, `page(output, offset, limit)`, `writeTriggerInput(runId, nodeId, items)` and `triggerInput(runId, nodeId)`, so use cases reach the chunk format only through this port;
    - `SecretCipher`: `encrypt`, `decrypt`, `isReadable`, `currentVersion`;
    - `Signer`: `sign`, `verify`;
    - `NodeTypeCatalog`: `get(id, version)`, `list()`, `credentialTypes()`, `etag()`;
    - `NodeExecutor`: `execute(context)`.
  - **Engine**:
    - `StepRunner`: `step(name, work, options)` with `{ attempts, backoff, retryIf, compensate }`, `sleepUntil(name, until)`, `waitForResume(name, runId, timeoutMs)` and `runChild(id, input, { wait, timeoutMs })`. `work` receives `{ idempotencyKey, attempt, signal }`;
    - `RunEngine`: `start`, `cancel`, `signal`, `status`, `delete`;
    - `ScheduleRegistry`: `sync`, `removeAll`;
    - `FormulaEngine`: `parse`, `evaluate`, `references`, `renameNode`.
  - **`NodeExecutionContext`**, which executors receive:
    - the input reader, `triggerInput()` (the attempt-0 items), a per-item parameter resolver and the upstream node outputs;
    - run metadata (`$execution`, `$workflow`), the output writer, `writeDiagnostics(text)` and a credential accessor;
    - the `StepRunner` for orchestrated nodes, `idempotencyKey(itemIndex)` and `signal`.
- [ ] T022 [P] Write `apps/api/test/unit/application/workflow.policy.spec.ts` first. Then implement `apps/api/src/application/policies/workflow.policy.ts` with `@Policy()` (research R14; FR-046):
  - `author(user)` is `user?.canAuthor`;
  - `manage(user, workflow)` is true for administrators, and for authors who own the workflow.

### Test support

- [ ] T023 Extend `apps/api/test/support/global-setup.ts` and `apps/api/test/support/setup-env.ts` for the Automation suites (research R20).
  - `apps/api/test/support/global-setup.ts`:
    - also start Garage with `GenericContainer('dxflrs/garage:v2.4.1@sha256:…')`, mounting `infra/garage/garage.toml` and using `--single-node --default-bucket` with fixed test keys;
    - run `nest-workflows migrate --url <DATABASE_URL>` after the Drizzle migrations;
    - provide the `S3_*` values.
  - `apps/api/test/support/setup-env.ts`: set `ROLE=api` and test values for `SECRET_KEYS`, `SECRET_KEY_VERSION`, `SIGNING_KEY`, `SANDBOX_URL`, `SANDBOX_TOKEN`, `PUBLIC_API_URL` and `HTTP_ALLOWED_HOSTS`.
- [ ] T024 [P] Create `apps/api/test/support/graphs.ts` and `apps/api/test/support/step-runner.ts`:
  - `graphs.ts`, with builders `graph()`, `manualTrigger()`, `node(type, parameters, settings?)`, `connect(from, to, output?, input?)`, `fixed()`, `ref()` and `formula()`;
  - `step-runner.ts`, an inline `StepRunner` fake. It runs `work` at once, records step names and attempts, applies `attempts` and `retryIf` synchronously, and resolves `sleepUntil`, `waitForResume` and `runChild` from a script.
- [ ] T025 [P] Add in-memory fakes to `apps/api/test/support/fakes.ts`:
  - `WorkflowRepository`, `RunRepository`, `NodeSampleRepository`, `CredentialQueries`, `ArtifactStore` and `RunEngine`;
  - `NodeTypeCatalog`, with the test executors `test.pass`, `test.fail` (throws a chosen node error) and `test.hang` (waits for its abort signal on attempt 1 and passes on later attempts).
- [ ] T026 Add the engine helpers to `apps/api/test/support/create-test-app.ts` and a new `apps/api/test/support/workflows.ts`.
  - In `apps/api/test/support/create-test-app.ts`, add `createTestApp({ worker: true })`, which replaces the engine clock with `ManualWorkflowClock` and enables the worker in process.
  - Create `apps/api/test/support/workflows.ts` with `drain(app)` (`WorkflowWorker.drain()`), `advance(app, ms)` and `waitForRun(app, runId, status)`.
  - Add `apps/api/test/support/test-nodes.module.ts`, which registers the test executors of T025 with `@NodeTypeExecutor`, so integration and component suites can run them through the real registry.

### Persistence

- [ ] T027 [P] Create `apps/api/src/interface-adapters/persistence/schema/workflow.ts` (data-model Tables).
  - **`workflow`**:
    - `id` uuid "primary key";
    - `name` text "not null, 1–120 characters; index on `lower(name)`";
    - `owner_id` uuid "references `user.id`; indexed";
    - `draft` jsonb "not null; graph and settings";
    - `draft_updated_at`, `draft_updated_by` "not null";
    - `latest_version` integer "not null, default 0";
    - `archived_at` "null while available";
    - `created_at` "not null";
    - `version` integer "not null, default 1; optimistic concurrency (draft revision)".
  - Add `updated_at` timestamptz, not null: the last change of name, draft, archive state or owner, which is the list order of FR-002. Add an index on (`updated_at` desc, `id` desc), and record the column in `specs/002-workflow-builder/data-model.md`.
  - **`workflow_version`**:
    - (`workflow_id`, `number`) "primary key; `workflow_id` references `workflow.id`";
    - `graph`, `settings` jsonb "not null; never updated";
    - `published_at`, `published_by` "not null".
- [ ] T028 [P] Create `apps/api/src/interface-adapters/persistence/schema/activation.ts` and `apps/api/src/interface-adapters/persistence/schema/webhook-endpoint.ts`.
  - **`activation`**:
    - `id` uuid "primary key";
    - `workflow_id` "unique; references `workflow.id`";
    - `version_number` "(`workflow_id`, `version_number`) references `workflow_version`";
    - `schedules` jsonb (ScheduleRegistration[]);
    - `webhook_node_ids` text[] "not null";
    - `activated_at`, `activated_by` "not null";
    - `version` integer "optimistic concurrency".
  - **`webhook_endpoint`**:
    - `id` text "primary key; public address part";
    - `workflow_id`, `node_id` (uuid, text) "unique together";
    - `secret_ciphertext`, `secret_key_version` "not null";
    - `created_at`, `rotated_at`;
    - `version` integer "optimistic concurrency".
- [ ] T029 [P] Create `apps/api/src/interface-adapters/persistence/schema/credential.ts` with **`credential`**:
  - `id` uuid "primary key";
  - `owner_id` "references `user.id`; unique with `lower(name)`";
  - `name` text "1–120 characters";
  - `type` text "check in (`httpHeader`, `httpBasic`, `httpBearer`, `httpQuery`)";
  - `secret_ciphertext`, `secret_key_version` "not null; never returned by the API";
  - `verified` boolean "not null";
  - `created_at`, `updated_at` "not null";
  - `version` integer "optimistic concurrency".
- [ ] T030 [P] Create `apps/api/src/interface-adapters/persistence/schema/run.ts`.
  - **`run`**:
    - `id` uuid "primary key";
    - `workflow_id` "references `workflow.id`; index (`workflow_id`, `queued_at` desc)", extended with `id` desc for the keyset of FR-043;
    - `version_number` "null for test runs";
    - `mode` "check in (`test`, `production`)";
    - `trigger_type`, `trigger_node_id` "not null";
    - `trigger_key` "source key or null; informational (deduplication is by the derived primary key)";
    - `parent_run_id` "references `run.id`; indexed", with `on delete set null` so retention can remove a parent before its children; record this in data-model.md;
    - `depth` "0 for top-level runs; at most 5";
    - `acting_user_id` "references `user.id`";
    - `status` "check in the six states; partial index where not terminal";
    - `error` "RunError or null";
    - `graph_snapshot` "draft graph and settings for test runs";
    - `error_workflow` "ErrorWorkflowOutcome or null";
    - `queued_at`, `started_at`, `finished_at`, `cancel_requested_at`;
    - `version` integer "optimistic concurrency".
  - **`step`**:
    - (`run_id`, `node_id`) "primary key; `run_id` references `run.id` on delete cascade";
    - `status` "check in (`running`, `succeeded`, `failed`)";
    - `attempts` "not null";
    - `started_at`, `finished_at`;
    - `outputs` jsonb (StepOutput[]);
    - `error` "StepError or null";
    - `diagnostics` "artifact key or null".
- [ ] T031 [P] Create `apps/api/src/interface-adapters/persistence/schema/node-sample.ts`, `retention-settings.ts` and `idempotency-key.ts` in the same directory.
  - `node-sample.ts`, table **`node_sample`**:
    - (`workflow_id`, `node_id`) "primary key; `workflow_id` references `workflow.id` on delete cascade";
    - `pinned` "items or null";
    - `fields` (FieldShape[]);
    - `fields_source` "`pin` or `test-run`";
    - `updated_at` "not null".
  - `retention-settings.ts`, table **`retention_settings`**:
    - `id` smallint "primary key, check `id = 1`; seeded by migration";
    - `retention_days`, `max_runs_per_workflow` "not null";
    - `updated_at`, `updated_by`.
  - `idempotency-key.ts`, table **`idempotency_key`**:
    - `key_hash` "primary key; hash of scope and key";
    - `fingerprint`, `owner` text;
    - `response` "stored status, headers and body, or null while in flight";
    - `expires_at` bigint "epoch milliseconds; pruned nightly".
- [ ] T032 Export the new tables from `apps/api/src/interface-adapters/persistence/schema/index.ts`, and add their row types to `apps/api/src/interface-adapters/interfaces.ts`.
  - Run `pnpm --filter api db:generate --name automation` to create `apps/api/drizzle/0002_automation.sql`.
  - Run `drizzle-kit generate --custom --name retention_settings_seed` and write the insert of `(1, 14, 10000, now(), null)` into it (FR-044 defaults).
  - Check `pnpm --filter api db:migrate` on an empty database.
- [ ] T033 [P] Write `apps/api/test/integration/persistence/workflow.repository.spec.ts` and `apps/api/test/integration/persistence/run.repository.spec.ts` first.
  - Workflows:
    - draft JSON round trip;
    - a stale `version` update throws `WorkflowConflictError`;
    - `addVersion` and `getVersion` work;
    - an unknown id throws `WorkflowNotFoundError`.
  - Runs:
    - `add` with an existing derived id returns the existing run and inserts nothing;
    - a stale update throws `RunConflictError`;
    - `saveStep` upserts by (`run_id`, `node_id`), so a later attempt overwrites;
    - `listStale(olderThan)` returns only non-terminal runs;
    - deleting a run removes its steps.
- [ ] T034 Implement `apps/api/src/interface-adapters/persistence/repositories/drizzle-workflow.repository.ts` and `apps/api/src/interface-adapters/persistence/repositories/drizzle-run.repository.ts` with their mappers until T033 passes. They use `TransactionHost.tx`; an update with a stale `version` matches no row and raises the conflict error; inserts use `on conflict do nothing returning`.
  - The mappers are `apps/api/src/interface-adapters/persistence/mappers/workflow.mapper.ts` and `apps/api/src/interface-adapters/persistence/mappers/run.mapper.ts`.

### Artifact store and step data

- [ ] T035 [P] Write `apps/api/test/integration/storage/s3-artifact.store.spec.ts` first, against the Garage container (FR-021):
  - a chunk round trip as `application/x-ndjson`, and `putJson` and `getJson`;
  - `deleteRun(runId)` removes every key under `runs/<runId>/`, across more than 1,000 objects;
  - an unreachable endpoint fails within the policy timeout with `PlatformError` and opens the breaker, so later calls fail at once.
- [ ] T036 Implement `apps/api/src/interface-adapters/storage/s3-artifact.store.ts` and its client factory until T035 passes (research R9, R24).
  - `apps/api/src/frameworks/s3/client.ts`: `new S3Client({ endpoint, region, credentials, forcePathStyle: true, requestChecksumCalculation: 'WHEN_REQUIRED', responseChecksumValidation: 'WHEN_REQUIRED', retryMode: 'standard', maxAttempts: 3 })`.
  - `apps/api/src/interface-adapters/storage/s3-artifact.store.ts` (`ArtifactStore`):
    - every call goes through a `storage` policy created once with `ResilienceService.create`: a 10 s timeout and a circuit breaker that counts only transport errors and 5xx;
    - failures raise `PlatformError`.
  - `apps/api/src/frameworks/di/storage.module.ts`.
  - Register `ResilienceModule.forRoot()` in `apps/api/src/frameworks/di/app.module.ts`.
- [ ] T037 [P] Write `apps/api/test/unit/node-types/io.spec.ts` first (research R9; FR-022).
  - The output writer:
    - closes a chunk at 500 items or 4 MiB, and puts a single larger item in its own chunk;
    - writes keys `runs/<runId>/nodes/<nodeId>/a<attempt>/<port>/<chunk>.jsonl`;
    - returns a `StepOutput` with `items`, `bytes` and `chunkStarts`;
    - throws `NodeLimitError`, naming the node and the limit, above 10,000 items or 16 MB per step.
  - The input reader:
    - iterates items chunk by chunk;
    - `all()` refuses more than 16 MB;
    - `page(offset, limit)` binary-searches `chunkStarts` and reads at most two chunks.
- [ ] T038 Implement `apps/api/src/interface-adapters/node-types/io/output-writer.ts`, `apps/api/src/interface-adapters/node-types/io/input-reader.ts` and `apps/api/src/interface-adapters/node-types/io/limits.ts` until T037 passes, and `apps/api/src/interface-adapters/node-types/io/step-data.ts`, which implements the `StepData` port over them and `ArtifactStore`.

### Formula engine

- [ ] T039 [P] Write `apps/api/test/unit/formulas/acorn-formula.engine.spec.ts` first (FR-015, research R10).
  - **Templates**: they mix text and `{{ … }}` segments; a template of a single segment returns the value with its type.
  - **Allowed syntax**: literals except regular expressions, template literals, member and optional-chain access, unary, binary, logical and conditional operators, and array and object expressions.
  - **Variables**:
    - `$json`, `$input.all()`, `.first()`, `.last()` and `.item`;
    - `$('Node name').all()`, `.first()`, `.last()` and `.item` (the item at the same position);
    - `$now` and `$today`: Luxon `DateTime` in the workflow time zone;
    - `$execution.id`, `.mode`, `.startedAt`, `.resumeUrl`, and `$workflow.id`, `.name`, `.version`.
  - **Calls**: allow-listed methods of strings, numbers, arrays, plain objects and `DateTime` work; every other call fails.
  - **`parse()` errors**:
    - `formula-syntax`, with the position, for functions, arrow functions, assignment, update, `new`, `this`, tagged templates, regular expression literals and `delete`;
    - `formula-scope` for unknown identifiers, and for `$response`, `$pageCount` and `$request` outside the pagination scope.
  - **Safety**: access to `__proto__`, `constructor` or `prototype` fails, and no function value escapes as a result.
  - **Bounds**: an evaluation above the step budget or 100 ms, or with a result above 1 MB, throws `NodeUserError` naming the parameter.
  - **References**: `references()` returns the node names used in `$('…')`. `renameNode(formula, from, to)` rewrites only `$('from')` arguments, at the parser's positions, and keeps the quote style.
- [ ] T040 Implement `apps/api/src/interface-adapters/formulas/acorn-formula.engine.ts` until T039 passes. It never uses `node:vm` or `new Function`, and its inputs are JSON clones.
  - The engine is an own tree-walking interpreter over `acorn` `parseExpressionAt` (`FormulaEngine`).
  - `apps/api/src/interface-adapters/formulas/allowed-members.ts` and `apps/api/src/interface-adapters/formulas/luxon-helpers.ts`.

### Parameters and node type registry

- [ ] T041 [P] Write `apps/api/test/unit/node-types/parameters.spec.ts` first (FR-013, FR-015, research R8).
  - `param(z.string())` accepts `{ fixed }`, `{ ref: { node, path } }` and `{ formula }`, and nothing else.
  - `describe()` returns JSON Schema 2020-12 from `z.toJSONSchema(schema, { target: 'draft-2020-12', io: 'input', unrepresentable: 'throw' })`, with `title`, `description`, `default`, `x-options`, `x-widget`, `x-acceptsReference`, `x-acceptsFormula` and `x-showWhen` taken from `.meta()`.
  - `validate()` maps `safeParse` issues of the draft values to problems with code `invalid-parameter` and the parameter path, for example `body.fields.0.value`.
  - `parse(resolved)` validates resolved plain values against the same schema, applies the defaults of omitted parameters, and throws `NodeUserError` naming the parameter path.
- [ ] T042 Implement `apps/api/src/interface-adapters/node-types/parameters.ts` until T041 passes:
  - `ZodParameterSchema`, implementing the domain `ParameterSchema`;
  - `param()`, which builds the `ParameterValue` union, and `collection()` for nested sub-parameters;
  - the metadata helpers `options()`, `widget()` and `showWhen()`.
- [ ] T043 [P] Write `apps/api/test/unit/application/resolve-parameters.spec.ts` first (FR-015; edge cases).
  - `{ ref: { node: '$item', path } }` reads the current item, and `{ ref: { node: <id>, path } }` reads the same-position item of that upstream node.
  - A missing path, or a node that has not run in this run, resolves to `undefined`.
  - Formulas are evaluated per item through `FormulaEngine`, with the run metadata and the workflow time zone.
  - Nested collection values are resolved recursively, and the result is passed to the node type's `ParameterSchema.parse`.
- [ ] T044 Implement `apps/api/src/application/use-cases/resolve-parameters.ts`, the helper `ExecuteNodeStep` uses, until T043 passes.
- [ ] T045 [P] Write `apps/api/test/unit/node-types/registry.spec.ts` first.
  - `NodeTypeRegistry` collects every class decorated with `@NodeTypeExecutor(manifest)` through `DiscoveryService`.
  - `get(id, version)` returns the manifest and the executor. An unknown type or version raises `PlatformError` (rolling update edge case; research R2).
  - `list()` returns every offered type version with its JSON Schema.
  - `etag()` is stable across calls and changes when a manifest changes.
- [ ] T046 Implement `apps/api/src/interface-adapters/node-types/node-type.decorator.ts` (`DiscoveryService.createDecorator`) and `apps/api/src/interface-adapters/node-types/registry.ts` (`NodeTypeCatalog`) until T045 passes.

### Durable execution

- [ ] T047 Create `apps/api/src/frameworks/di/workflows-infra.module.ts` (research R2).
  - `WorkflowsModule.forRootAsync({ inject: [ConfigService], useFactory })`:
    - `worker: false` when `ROLE` is `api`;
    - `{ concurrency: WORKER_CONCURRENCY, shutdownTimeout: '20s' }` when it is `worker`;
    - `retry: { attempts: 1 }`.
  - Provide `PostgresWorkflowStore` as `new PostgresWorkflowStore({ executor: fromDrizzle(db) }, storage)`, as `apps/api/src/frameworks/di/outbox.module.ts` provides the outbox store.
  - Set `max: DATABASE_POOL_MAX` on the pool in `apps/api/src/frameworks/di/database.module.ts`.
- [ ] T048 Rewrite `apps/api/src/main.ts` for the two roles (research R1; DR-002). The factory is chosen from `process.env.ROLE`, which the config schema also validates.
  - `ROLE=api` keeps the HTTP bootstrap, created with `bodyParser: false` (see T049).
  - `ROLE=worker` uses `NestFactory.createApplicationContext(AppModule, { bufferLogs: true })` with `useLogger`, `enableShutdownHooks()` and no listener.
- [ ] T049 Replace the global body parser with per-route limits. Write `apps/api/src/interface-adapters/http/middleware/body-limits.middleware.ts`, applied by `AppModule.configure` in `apps/api/src/frameworks/di/app.module.ts`.
  - JSON up to 100 kB by default.
  - 5 MB for `PUT /workflows/:id/draft` (FR-009).
  - 1 MB for `POST /runs` and `PUT /workflows/:id/samples/:nodeId` (FR-021, FR-025).
  - A raw body up to 1 MB, kept as `req.rawBody`, for `/webhooks/:endpointId` and `/resume/:token` (FR-027, FR-030).
  - A larger body answers 413.

  Create the test app with `bodyParser: false` in `apps/api/test/support/create-test-app.ts`, and keep the 001 component suites green.

- [ ] T050 [P] Write `apps/api/test/unit/application/retry-policy.spec.ts` first (research R5; FR-016, FR-021). `nodeStepOptions(settings)` returns:
  - `attempts: max(userAttempts, 3) + 2`;
  - a `retryIf` that:
    - never retries `limit` or `isolation`;
    - retries `platform` while the attempt is below 3, with exponential back-off from 1 s;
    - retries `user` while the attempt is below the user's attempts, waiting `retry.waitMs`.
- [ ] T051 Implement `apps/api/src/application/use-cases/retry-policy.ts` until T050 passes.
- [ ] T052 [P] Write `apps/api/test/unit/application/execute-run.spec.ts` first, with the inline `StepRunner` (FR-012, FR-018, FR-019, FR-022, FR-024; research R3, R4).
  - **Steps and order**:
    - `register-run` is the first step: it sets the run `running` and returns the plan;
    - nodes run in `WorkflowGraph.order` from the run's trigger node, each as step `node:<nodeId>`;
    - nodes the firing trigger does not reach never run.
  - **Skipping and inputs**:
    - a node none of whose inputs received items is skipped without a Step row, so its downstream nodes see no items;
    - `alwaysOutputData` makes it emit one empty item instead;
    - a node with several inputs runs once every connected upstream node has finished or been skipped, if at least one input received items.
  - **Settings**: `disabled` passes the input items through on `main`, and `executeOnce` passes only the first input item.
  - **Failure and limits**:
    - a node error with `onError: stop` ends the run `failed` with the node id, kind and message, and nothing downstream runs;
    - step outputs above 256 MB in total fail the run with kind `limit`.
  - **Completion and graphs**:
    - `finish-run` writes `succeeded`;
    - a test run reads `graph_snapshot`, and a production run reads its version's graph;
    - an `orchestrated` node receives the `StepRunner` instead of being wrapped in a step.
- [ ] T053 [P] Write `apps/api/test/unit/application/execute-node-step.spec.ts` first (research R3, R5, R9).
  - **Inputs and parameters**:
    - upstream outputs are read through `StepData` per connected input, and a trigger node reads `triggerInput()`;
    - parameters are resolved per item with `resolveParameters` and parsed by the node type's schema.
  - **Execution**: the executor is called by `dataMode`: once per item for `item`, in batches for `batch`, and once for `all`.
  - **Outputs and Step row**:
    - outputs are written under the current attempt;
    - the Step row is written `running`, then `succeeded` with outputs, or `failed` with `{ kind, message, line?, itemIndex? }`;
    - the step returns `{ outputs }`.
  - **Keys and errors**:
    - the idempotency key of item `i` is `run-<runId>:node:<nodeId>:<i>`;
    - an unknown node type version raises `PlatformError`.
- [ ] T054 Implement `apps/api/src/application/use-cases/execute-run.ts` until T052 passes. Node steps use `nodeStepOptions`, and `register-run` registers the compensation described in T058.
- [ ] T055 Implement `apps/api/src/application/use-cases/execute-node-step.ts` until T053 passes.
- [ ] T056 Implement `apps/api/src/interface-adapters/workflows/workflow-context.step-runner.ts`, the `StepRunner` over the engine context (research R3, R5, R18).
  - `step(name, work, options)` calls `ctx.step` with `{ attempts, backoff, retryIf, compensate }` and passes `{ idempotencyKey, attempt, signal }` to `work`.
  - Errors:
    - a `StepFailedError` becomes `NodeUserError`, `NodeLimitError`, `IsolationBreachError` or `PlatformError` again, chosen by the cause's `name`;
    - limit and isolation breaches are thrown inside `NonRetryableStepError`.
  - Each node step opens one span `node.execute` with `run.id`, `node.id`, `node.type`, `attempt` and `items.out`, and no item data or credentials.

  `sleepUntil`, `waitForResume` and `runChild` throw "not supported" until T173.

- [ ] T057 Implement `apps/api/src/interface-adapters/workflows/workflow-client.run-engine.ts` (`RunEngine`).
  - `start(runId, workflowId, { timeoutMs })` calls `client.start('run', { runId, workflowId }, { id: 'run-<runId>', timeout, transaction: txHost.tx })`.
  - `cancel`, `status` (`getStatus`) and `delete`.
- [ ] T058 Implement `apps/api/src/interface-adapters/workflows/run.workflow.ts` (research R4, R7).
  - Decorator: `@Workflow('run', { version: 1, concurrency: { limit: Number(process.env.RUN_CONCURRENCY_PER_WORKFLOW ?? 5), key: (input) => input.workflowId } })`.
  - `run(ctx, input)` calls `ExecuteRun.execute(input.runId, new WorkflowContextStepRunner(ctx))`.
  - The `register-run` compensation sets `cancelled` when the engine reason is `WorkflowCancelledError`. Otherwise it sets `failed`, with kind `timeout` for a run timeout and `platform` for anything else.
- [ ] T059 [P] Write `apps/api/test/unit/application/reconcile-runs.spec.ts` first (research R4; FR-018).
  - Non-terminal runs unchanged for 2 minutes are compared with `RunEngine.status` and projected:
    - engine `failed` with a timeout becomes `failed` `timeout`;
    - other `failed`, `compensation_failed` and a missing instance become `failed` `platform`;
    - `cancelled` becomes `cancelled`;
    - `pending`, `running` and `suspended` leave the row unchanged.
  - The same `projectRun` function serves read repair.
- [ ] T060 Implement `apps/api/src/application/use-cases/reconcile-runs.ts` and `apps/api/src/interface-adapters/workflows/maintenance.workflow.ts` until T059 passes. The maintenance workflow is a declared schedule that runs every minute and calls `ReconcileRuns`.
- [ ] T061 Create `apps/api/src/frameworks/di/automation.module.ts`, shaped like `IdentityAccessModule`, and import it with `WorkflowsInfraModule` and `StorageModule` in `apps/api/src/frameworks/di/app.module.ts`.
  - Bind the repositories to their ports with `useExisting`.
  - Bind `AcornFormulaEngine` as `FormulaEngine`, `NodeTypeRegistry` as `NodeTypeCatalog` (with `DiscoveryModule`) and `WorkflowClientRunEngine` as `RunEngine`.
  - Provide `PlatformLimits`: `DEFAULT_LIMITS` merged with `PLATFORM_LIMITS`.
  - Build `ExecuteRun`, `ExecuteNodeStep` and `ReconcileRuns` with factory providers.
  - Register `RunWorkflow` and `MaintenanceWorkflow`.
- [ ] T062 Write `apps/api/test/unit/http/domain-error.filter.spec.ts` first, then map the new errors explicitly in `apps/api/src/interface-adapters/http/filters/domain-error.filter.ts` (data-model Domain errors). Unmapped errors keep answering 500.
  - 404: `WorkflowNotFoundError`, `WorkflowVersionNotFoundError`, `RunNotFoundError`, `CredentialNotFoundError`, `WebhookEndpointNotFoundError`, `NodeNotFoundError`.
  - 403: `WorkflowAccessDeniedError`, `CredentialAccessDeniedError`.
  - 409: `WorkflowConflictError`, `ActivationConflictError`, `RunConflictError`, `CredentialInUseError`, `DeliveryConflictError`, `ResumeRefusedError`, `WorkflowArchivedError`, `RunFinishedError`.
  - 422: `DraftInvalidError`, answered as `UnprocessableEntityException` with `problems`.
  - 503: `PlatformError`, which is how storage being unavailable reaches readers (FR-021).
- [ ] T063 Write `apps/api/test/integration/workflows/run-engine.spec.ts` on the real PostgreSQL store, with `ManualWorkflowClock` and `drain()` (research R20).
  - `start` inside a rolled-back transaction leaves no instance and no row.
  - A run of three test executors ends `succeeded` with three Step rows.
  - Concurrency (FR-023):
    - with `RUN_CONCURRENCY_PER_WORKFLOW=5`, the sixth run of a workflow stays `queued` while a run of another workflow executes;
    - queued runs start oldest first.
  - Ending (FR-018, FR-024):
    - a run timeout ends `failed` with kind `timeout`;
    - the maintenance sweep repairs a row whose compensation was lost, within 2 minutes;
    - `cancel` ends `cancelled` and starts no further node.
  - **Crash test** (FR-020, SC-002): two app instances share one database and one clock. Close the first while `test.hang` runs, advance past the 30 s lease and drain the second. The nodes before the hanging one keep `attempts: 1`, the hanging node shows `attempts: 2`, and the run succeeds.

**Checkpoint**: the run interpreter executes test graphs durably; unit and integration suites pass; user story work can begin

---

## Phase 3: User Story 1 - Build a workflow and test-run it (Priority: P1) 🎯 MVP

**Goal**: An editor creates a workflow, saves a draft graph with a validation report, starts a test run with items, and reads the run, its steps and their outputs. Others can read but not change.

**Independent Test**:

1. Create Manual Trigger → Edit Fields → If and save it.
2. Start a test run with three items. It succeeds, each node reports its item count, and the If node routes the items to the expected branches.
3. Read the outputs page by page.
4. Another editor can read the workflow but not change or run it (quickstart Scenario 1).

### Tests for User Story 1 ⚠️

- [ ] T064 [P] [US1] Write `apps/api/test/component/workflows.spec.ts` first (FR-001–FR-005, FR-046; US1 scenarios 1, 10, 11).
  - **Create**: an editor creates a workflow (201: empty draft, `revision` 1, the caller is the owner); a viewer gets 403.
  - **List and read**: every signed-in user lists it and reads it with `canManage`.
    - The list is newest change first, `limit` defaults to 25 (at most 100) and returns `nextCursor`.
    - `search` matches the name case-insensitively, `owner` filters, and archived workflows are hidden unless `archived=true`.
  - **Rename**: the owner and an administrator can rename it; another editor gets 403.
  - **Archive**: archive and restore answer 204; an archived workflow refuses renames and draft saves with 409.
  - **Duplicate**: another editor duplicates it and owns the copy.
  - **Transfer**: an administrator transfers it to an editor, who can then save the draft. A transfer to a viewer or a suspended user answers 400.
  - Unknown ids answer 404.
- [ ] T065 [P] [US1] Write `apps/api/test/component/drafts.spec.ts` first (FR-006–FR-009; US1 scenarios 2 and 8; SC-011).
  - **Save**: `PUT /workflows/{id}/draft` round-trips the graph and settings and returns `{ revision, validation }`. An invalid graph is saved, and its report lists problems with stable codes: `cycle`, `no-trigger`, `unreachable-node`, `duplicate-node-name`, `unknown-node-type`, `invalid-parameter`, `unknown-port`.
  - **Conflicts**: a stale revision answers 409 and changes nothing; another editor's save answers 403.
  - **Limits**: 201 nodes give `node-limit`, more than 256 KB of parameters give `parameters-too-large`, and a request above 5 MB answers 413.
  - **Renames**: renaming a node rewrites `$('old')` in other nodes' formulas.
  - **Reads**: `GET /workflows/{id}` returns the draft, revision, report, activation, latest version and samples in one call. `GET /node-types` answers 304 to its `ETag`.
  - **Samples**: pinning more than 100 items or more than 1 MB is refused, and unpinning answers 204.
- [ ] T066 [P] [US1] Write `apps/api/test/component/runs.spec.ts` first, with the worker drained in process (FR-017–FR-019, FR-021, FR-024, FR-025; US1 scenarios 3–7 and 9; edge cases).
  - **Start**: `POST /runs` with a draft revision and three items answers 202 `{ runId }`. After draining, the run is `succeeded` with a step per executed node.
  - **Read**: `GET /runs/{id}` returns the status, the step that is `running` while one runs, and per step the status, attempts, item count, bytes, duration and error. A matching `If-None-Match` answers 304 without a body.
  - **Output**: step output pages keep production order with `offset` and `limit` (at most 100). An unknown run or node answers 404.
  - **Failure**: a node whose formula fails ends the run `failed`, naming the node and the parameter, and downstream nodes have no step.
  - **Cancel**: cancelling a queued or running run gives `cancelled` with no new step; a finished run answers 409.
  - **Refusals**: a non-owner gets 403; a stale revision answers 409; an invalid draft answers 422 with `problems`; more than 1,000 items answer 400.
  - **Samples and fields**: a pinned sample replaces the node's execution. After a test run, `GET /workflows/{id}` lists the field shapes of every node.
  - **Isolation from drafts**: saving the draft during a test run does not change that run.
  - **Storage**: with object storage stopped, the step output answers 503 while `GET /runs/{id}` answers 200.
- [ ] T067 [P] [US1] Write `apps/api/test/unit/application/validate-draft.spec.ts` first (FR-007, FR-014, FR-015, FR-042). One problem of each code:
  - `unknown-node-type` (an unknown type or version) and `invalid-parameter`;
  - `missing-credential`, `foreign-credential` and `credential-type-mismatch`;
  - `unknown-node-reference` (a `ref` or `$('…')` to an unknown node) and `not-upstream-reference` (a node that is not upstream);
  - `formula-syntax` and `formula-scope`;
  - `invalid-error-workflow` (the workflow itself, or an unknown or archived workflow);
  - an `unknown-field` warning for a `ref` path missing from the referenced node's known fields;
  - the graph codes of T009, merged in.
- [ ] T068 [P] [US1] Write `apps/api/test/unit/application/save-draft.spec.ts` and `apps/api/test/unit/domain/node-sample.spec.ts` first.
  - `SaveDraft`:
    - checks `WorkflowPolicy.manage`;
    - refuses a stale revision with `WorkflowConflictError`;
    - rewrites formulas for renamed nodes through `FormulaEngine.renameNode`;
    - stores the draft and returns `{ revision, validation }`.
  - `FieldShape.from(items)`: dot paths with types from the first 20 items, at most 500 paths.
  - `NodeSample.pin(items)`: refuses more than 100 items or 1 MB.
- [ ] T069 [P] [US1] Write `apps/api/test/unit/node-types/conditions.spec.ts` and `apps/api/test/unit/node-types/if.spec.ts` first (catalogue If; FR-014).
  - **Operators**:
    - text: equals, not equals, contains, not contains, starts with, ends with, matches, is empty, is not empty;
    - number: equals, not equals, greater, greater or equal, less, less or equal;
    - date: equals, before, after, comparing ISO strings and Luxon `DateTime`;
    - boolean: is true, is false;
    - list: contains, not contains, length equals, longer than, shorter than, is empty;
    - object: is empty, is not empty, has key;
    - any value: exists, does not exist.
  - **Combining**: conditions are joined by AND or OR, and text comparison can be case-insensitive.
  - **`matches`**: runs on `re2js`. A pattern with a backreference or lookaround, invalid syntax, or more than 1,000 characters is the validation problem `invalid-regex`.
  - **If**: matching items leave through `true` and the rest through `false`.
- [ ] T070 [P] [US1] Write `apps/api/test/unit/node-types/edit-fields.spec.ts` first (catalogue Edit Fields).
  - **Mapping mode**: sets typed fields (string, number, boolean, array, object) with dot notation that creates nested objects, and renames and removes fields.
  - **JSON mode**: builds each item from a template evaluated per item.
  - **Other input fields**: all, none, selected, or all but selected are kept.
  - Values may be field references or formulas.
- [ ] T071 [P] [US1] Write `apps/api/test/unit/node-types/manual-trigger.spec.ts` and `apps/api/test/unit/node-types/no-op.spec.ts` first.
  - Manual Trigger outputs the attempt-0 items written by the run start, unchanged.
  - No Operation passes its input through.
- [ ] T072 [P] [US1] Write `apps/api/test/integration/persistence/workflow.queries.spec.ts` and `apps/api/test/integration/persistence/node-sample.repository.spec.ts` first.
  - Keyset paging over (`updated_at` desc, `id` desc) with an opaque cursor, the `lower(name)` search, and the owner and archived filters.
  - `getView` joins the owner and draft editor names, the activation and the samples.
  - The sample upsert keeps the pinned items while known fields change.

### Implementation for User Story 1

- [ ] T073 [P] [US1] Implement `apps/api/src/domain/node-sample.ts`, which holds `NodeSample` and `FieldShape.from(items)`, until its part of T068 passes.
- [ ] T074 [P] [US1] Implement `apps/api/src/interface-adapters/node-types/conditions.ts`, the shared condition operators with `re2js` compiled and cached per pattern, until T069 passes. Patterns compile through `RE2JS.compile` after `RE2JS.translateRegExp`, and a pattern that fails to compile becomes `invalid-regex` in the node's schema `superRefine`.
- [ ] T075 [US1] Implement `apps/api/src/interface-adapters/node-types/{manual-trigger,edit-fields,if,no-op}/` until T069, T070 and T071 pass.
  - `apps/api/src/interface-adapters/node-types/manual-trigger/{manifest.ts,executor.ts}`: `kind: 'trigger'`, `trigger: 'manual'`, output `main`.
  - `apps/api/src/interface-adapters/node-types/edit-fields/{manifest.ts,executor.ts}`.
  - `apps/api/src/interface-adapters/node-types/if/{manifest.ts,executor.ts}`: outputs `true` and `false`.
  - `apps/api/src/interface-adapters/node-types/no-op/{manifest.ts,executor.ts}`.

  Every manifest has version 1 and a zod schema with `.meta()` form keywords.

- [ ] T076 [US1] Implement `apps/api/src/interface-adapters/persistence/queries/drizzle-workflow.queries.ts` and the other US1 persistence adapters until T072 passes.
  - `drizzle-workflow.queries.ts` implements `WorkflowQueries`.
  - `apps/api/src/interface-adapters/persistence/repositories/drizzle-node-sample.repository.ts` with its mapper.
  - `apps/api/src/interface-adapters/persistence/queries/drizzle-credential.queries.ts`: `findByIds` and `ownedIds(ownerId)` for validation and duplication. The credential table is empty until US3.
  - `apps/api/src/interface-adapters/persistence/queries/drizzle-run-history.reader.ts` (`RunHistoryReader.getRun`, with its steps).
- [ ] T077 [US1] Implement `apps/api/src/application/use-cases/validate-draft.ts` until T067 passes. It merges the `WorkflowGraph.problems`, the `NodeType.validate` results, formula parse problems and references from `FormulaEngine`, credential checks through `CredentialQueries`, error-workflow checks through `WorkflowRepository`, and `unknown-field` warnings from `NodeSampleRepository`.
- [ ] T078 [US1] Implement the workflow use cases in `apps/api/src/application/use-cases/` until T068 passes. Each command loads the aggregate and calls `WorkflowPolicy.manage`, which throws `WorkflowAccessDeniedError`.
  - `create-workflow.ts`, `rename-workflow.ts`, and `save-draft.ts` (returns the report from `ValidateDraft`).
  - `archive-workflow.ts` and `restore-workflow.ts`.
  - `duplicate-workflow.ts`, which keeps only credentials from `CredentialQueries.ownedIds(caller)` (FR-004).
  - `transfer-workflow.ts`, whose target must be an active editor or administrator, else 400.
  - `get-workflow.ts` and `list-workflows.ts`.
- [ ] T079 [US1] Implement `apps/api/src/application/use-cases/pin-node-sample.ts`, `apps/api/src/application/use-cases/unpin-node-sample.ts` and `apps/api/src/application/use-cases/list-node-types.ts` (catalogue and `etag`).
- [ ] T080 [US1] Implement the run use cases in `apps/api/src/application/use-cases/`.
  - `start-manual-run.ts`, for a test run of the draft at the named revision (FR-017, FR-025):
    - refuse a stale revision (409) and a draft with errors (422 `DraftInvalidError`);
    - choose the Manual Trigger, or `triggerNodeId` when there are several;
    - insert the run `queued` with `graph_snapshot` and `actingUserId` set to the owner;
    - write the items as attempt 0 of the trigger node with `StepData.writeTriggerInput`;
    - call `RunEngine.start` with `runTimeoutMs` in the request transaction, as the last call.
  - `cancel-run.ts` (FR-024): sets `cancelled`, then calls `RunEngine.cancel` in the same transaction, as the last call.
  - `get-run.ts`: repairs a stale row with `projectRun`.
  - `get-step-output.ts`: reads one page through `StepData.page`.
- [ ] T081 [US1] Extend `apps/api/src/application/use-cases/execute-node-step.ts` for test runs (FR-015, FR-021).
  - A node with a pinned sample outputs the pinned items without executing.
  - Each executed node's known fields (`FieldShape.from` of its first 20 output items) are stored with `fieldsSource: 'test-run'` unless the node is pinned.
- [ ] T082 [P] [US1] Create the HTTP input types in `apps/api/src/interface-adapters/http/dto/` and `apps/api/src/interface-adapters/http/pipes/`.
  - `apps/api/src/interface-adapters/http/dto/draft.schema.ts`: `z.strictObject` schemas mirroring the contract's `Graph` (at most 200 nodes and 1,000 connections), `Node`, `Connection`, `ParameterValue`, `NodeSettings` and `WorkflowSettings`.
  - `apps/api/src/interface-adapters/http/pipes/zod-validation.pipe.ts`, which answers 400 with the issue paths.
  - class-validator DTOs in `apps/api/src/interface-adapters/http/dto/workflow.dto.ts` (create, rename, duplicate, transfer, samples with `Items100`) and `apps/api/src/interface-adapters/http/dto/run.dto.ts` (`StartRun` with `target` and `Items1000`).
- [ ] T083 [P] [US1] Create the presenters in `apps/api/src/interface-adapters/http/presenters/`, matching the contract schemas.
  - `apps/api/src/interface-adapters/http/presenters/workflow.presenter.ts`: `Workflow` and `WorkflowSummary`.
  - `apps/api/src/interface-adapters/http/presenters/run.presenter.ts`: `Run` and `Step`, plus a weak `ETag` hashed from the presented body.
  - `apps/api/src/interface-adapters/http/presenters/node-type.presenter.ts`: `NodeType`.
- [ ] T084 [US1] Implement the US1 controllers in `apps/api/src/interface-adapters/http/controllers/`.
  - `apps/api/src/interface-adapters/http/controllers/workflows.controller.ts`: `GET`/`POST /workflows`, `GET`/`PATCH /workflows/:id`, `PUT /workflows/:id/draft`, `POST /workflows/:id/{archive,restore,duplicate,transfer}`, `PUT`/`DELETE /workflows/:id/samples/:nodeId`.
  - `apps/api/src/interface-adapters/http/controllers/runs.controller.ts`: `POST /runs`, `GET /runs/:runId` with `ETag`, `Cache-Control: no-cache` and 304, `POST /runs/:runId/cancel`, `GET /runs/:runId/steps/:nodeId/output`.
  - `apps/api/src/interface-adapters/http/controllers/node-types.controller.ts`: `GET /node-types` with `ETag` and 304.

  Reads use `@Can.Anyone()`, and commands use `@Can(WorkflowPolicy, 'author')` and `@Transactional()` (research R14). Add Swagger decorators that match `contracts/openapi.yaml`.

- [ ] T085 [US1] Register the US1 use cases (factory providers), repositories, queries, controllers and node types in `apps/api/src/frameworks/di/automation.module.ts`, and add `WorkflowPolicy` to `AuthorizationModule.forRoot({ policies })`, so that T064, T065 and T066 pass.
- [ ] T086 [P] [US1] Create `specs/002-workflow-builder/examples/orders-draft.json` for quickstart Scenario 1: Manual Trigger → Edit Fields (`net = {{ $json.total * 0.8 }}`) → If (`total > 50`), with fixed UUID node ids.
- [ ] T087 [US1] Write `apps/api/test/e2e/build-and-test-run.spec.ts`, with helpers in `apps/api/test/e2e/support/automation.ts` (DR-004). Against the Compose stack, with the `worker` container executing:
  - create a workflow, save `orders-draft.json` and test-run it with three items;
  - poll with `If-None-Match` until `succeeded`;
  - read the `true` and `false` outputs of the If node;
  - check that a viewer cannot start a run.

**Checkpoint**: User Story 1 works on its own; it is the MVP

---

## Phase 4: User Story 2 - Transform data with custom code (Priority: P2)

**Goal**: A Code node runs JavaScript, TypeScript or Python, once for all items or once per item, with the same helpers in every language. The code runs isolated in the go-judge sidecar, and its console output is kept as diagnostics.

**Independent Test**:

1. Manual Trigger → Code, doubling a field, in each language, run with five items, gives the same output.
2. Network access, host file reads, endless loops and excessive memory each fail the node with a named cause, while the platform stays available (quickstart Scenario 2).

### Tests for User Story 2 ⚠️

- [ ] T088 [P] [US2] Write `apps/api/test/unit/node-types/code.spec.ts` first, with a fake `CodeSandboxGateway` (FR-032–FR-034; research R11).
  - **Status mapping**:
    - `Accepted` leads to validation of the result;
    - `Nonzero Exit Status`, `Time Limit Exceeded`, `Memory Limit Exceeded`, `Output Limit Exceeded`, `Dangerous Syscall`, `File Error`, and `Signalled` (unless the worker aborted the call) are user errors that are never retried;
    - `Internal Error`, HTTP 5xx and connection failures are `PlatformError`.
  - **Modes and limits**:
    - "run once for each item" splits the items into invocations below 8 MB of input and concatenates the outputs in input order;
    - "run once for all items" with more than 8 MB of input fails as a user error.
  - **TypeScript**: a syntax error fails before any sandbox call, and transpiled code is cached by source hash.
  - **Diagnostics**: at most 64 KB, stored at `runs/<runId>/nodes/<nodeId>/diagnostics.txt`, with the key on the Step row.
- [ ] T089 [P] [US2] Write `apps/api/test/unit/sandbox/typescript.transpiler.spec.ts` first. `amaro` `transformSync(src, { mode: 'strip-only' })` keeps line numbers, and an unsupported construct (`enum`) is reported with its line.
- [ ] T090 [P] [US2] Write `apps/api/test/integration/sandbox/code-node.spec.ts` first, against the real sandbox image started privileged by `testcontainers` (FR-032–FR-034; SC-005; quickstart Scenario 2).
  - **Same output in every language**:
    - the same script in JavaScript, TypeScript and Python gives the same items in both modes;
    - the helpers work: `$input.all()`, `.first()`, `$json`, `$('Node').all()` and `.first()`, `$now`, `$execution`, `$workflow`, and Python `_input`, `_json`, `_('Node')`, `_now`, `_items` and `_item`;
    - the preinstalled `luxon`, `lodash`, `dateutil` and `pendulum` load, and `require('fs')` is refused.
  - **Results and diagnostics**:
    - a single object is wrapped in a list, while BigInt, NaN and non-object results fail;
    - a thrown error reports its line and item index;
    - `console.log` and `print` output becomes diagnostics, capped at 64 KB.
  - **Refusals**, each failing the node as a user error that is not retried:
    - `fetch('http://example.com')` or a raw `connect()`, and `open('/etc/passwd')`;
    - `while (true) {}`, a 1 GB allocation, 64 threads, and output above 16 MB.
- [ ] T091 [P] [US2] Write `apps/api/test/component/code-node.spec.ts` first, with the fake gateway. A test run with a Code node returns its outputs, and `GET /runs/{id}` shows the step's `diagnostics`. With the gateway unreachable, the node fails with kind `platform` after 3 attempts.

### Implementation for User Story 2

- [ ] T092 [P] [US2] Create the sandbox image `apps/api/sandbox/Dockerfile` (research R11; DR-003), built on one Debian trixie base pinned by digest.
  - **Contents**:
    - the go-judge v1.13.2 static binary;
    - Node.js 24.21.0 from `node:24.21.0-trixie-slim`;
    - CPython 3.14 slim-trixie, with the standard library precompiled.
  - **Libraries**:
    - `apps/api/sandbox/js/package.json` and its lockfile, with `luxon` 3.7.2 and `lodash` 4.18.1, installed by `npm ci`;
    - `apps/api/sandbox/py/requirements.txt`, with `python-dateutil` 2.9.0.post0 and `pendulum` 3.2.0 hashes, installed with `--require-hashes --only-binary=:all:`.
  - **Configuration**:
    - `apps/api/sandbox/mount.yaml`: a read-only bind of `/opt/sandbox` and a 16 MB tmpfs;
    - an entrypoint with `-http-addr=127.0.0.1:5050`, `-auth-token` from `SANDBOX_TOKEN`, a log level above info, `-src-prefix` pointing at an empty directory, `-mount-conf`, and never `-net-share`.
- [ ] T093 [P] [US2] Write `apps/api/sandbox/harness/harness.cjs` and `apps/api/sandbox/harness/harness.py` (research R11).
  - `harness.cjs`:
    - loads `module.exports = async function ($input, $json, $, require) { … }` from the copied-in `code.cjs`;
    - offers `$input.all()`, `$input.first()`, `$json`, `$('Node name').all()` and `.first()`, `$now` (Luxon), `$execution` and `$workflow`;
    - offers a `require` limited to the preinstalled libraries, and a console capped to stderr.
  - `harness.py`: wraps the parsed body into a function with `ast`, keeping line numbers, run as `python3 -I -S -B -X utf8`. It offers `_input.all()`, `_input.first()`, `_json`, `_('Node name').all()`, `_now`, `_execution`, `_workflow`, `_items` and `_item`.
  - Both read `{ items, nodes, run, mode }` from stdin and validate that the result is a list of plain JSON objects. Each writes `{ ok, items }` or `{ ok: false, error: { kind, message, line, itemIndex } }` to fd 3 and exits 0.
- [ ] T094 [US2] Implement `apps/api/src/interface-adapters/sandbox/go-judge.gateway.ts` and `apps/api/src/interface-adapters/sandbox/typescript.transpiler.ts` until T089 passes and the gateway part of T090 passes.
  - The `CodeSandboxGateway` abstract class in `apps/api/src/interface-adapters/interfaces.ts`.
  - The gateway:
    - one `POST /run` per invocation, with `files` = [stdin JSON, stdout and stderr collectors (64 KB together), the `result` collector on fd 3];
    - `copyIn` holds the user code;
    - limits: `cpuLimit` 10 s, `clockLimit` 30 s, `memoryLimit` 256 MB (Node gets `--max-old-space-size` of about 0.75 of it) and `procLimit` 32;
    - every call goes through a `sandbox` resilience policy: a 35 s timeout and a breaker that counts only transport failures and 5xx, with no retry of its own.
  - The transpiler wraps `amaro` and caches results by source hash.
- [ ] T095 [US2] Implement `apps/api/src/interface-adapters/node-types/code/{manifest.ts,executor.ts}` until T088 passes.
  - Parameters: `language` (`javascript`, `typescript`, `python`), `mode` (`runOnceForAllItems`, `runOnceForEachItem`) and `code` (fixed only).
  - `effects: 'none'`.
  - The upstream nodes named in `$('…')` or `_('…')` literals are passed in `nodes`, within the 8 MB input limit.
- [ ] T096 [US2] Register the Code node, the gateway (`SANDBOX_URL`, `SANDBOX_TOKEN`) and the transpiler in `apps/api/src/frameworks/di/automation.module.ts`, so that T091 passes.
- [ ] T097 [US2] Add the service `sandbox` to `compose.yaml` (DR-001, DR-006).
  - Build from `apps/api/sandbox`, as image `workflow-platform/sandbox:dev`, in profile `app`.
  - `network_mode: service:worker`, `privileged: true`, `cgroup: host`, `/sys/fs/cgroup` mounted read-write, `security_opt: [seccomp=unconfined, apparmor=unconfined]`, and `SANDBOX_TOKEN`.
  - Replace the worker's disabled healthcheck with a `node -e` probe of `${SANDBOX_URL}/version` that sends the token, so the worker is not ready while the sandbox does not answer.
- [ ] T098 [P] [US2] Extend `.github/workflows/ci.yml`. Build `apps/api/sandbox/Dockerfile`, scan it with Trivy (CRITICAL and HIGH, exit code 1) with the action pinned by digest, and run the sandbox integration suite, including the `connect()` refusal, as a required step.
- [ ] T099 [US2] Write `apps/api/test/e2e/code-node.spec.ts`. The three-language script of quickstart Scenario 2 gives equal outputs through the Compose sidecar, and `fetch('http://example.com')` fails with a named cause.

**Checkpoint**: User Stories 1 and 2 work on their own

---

## Phase 5: User Story 3 - Call HTTP APIs with stored credentials (Priority: P3)

**Goal**:

- Encrypted, write-only credentials of the four generic HTTP types.
- An HTTP Request node behind the connect-time SSRF guard.
- Declarative pagination with cycle detection and per-page retries.

**Independent Test**:

1. Create a bearer credential, call httpbin with it for two items, and check the output.
2. The secret appears in no response, output or log.
3. Loopback, private and metadata destinations are refused, including through redirects and DNS.
4. Each pagination preset collects every record without a formula (quickstart Scenarios 3 and 3b).

### Tests for User Story 3 ⚠️

- [ ] T100 [P] [US3] Write `apps/api/test/unit/domain/credential.spec.ts` and `apps/api/test/unit/storage/aes-gcm.secret-cipher.spec.ts` first (FR-039, FR-040; research R13).
  - **`Credential`**: `create` sets `verified = true`; `rename`; `replaceSecret`; names are 1–120 characters.
  - **Cipher**:
    - AES-256-GCM round trip under `SECRET_KEY_VERSION`;
    - a ciphertext under an older configured version still decrypts;
    - a missing key version is reported by `isReadable(...) === false`;
    - a tampered ciphertext fails.
- [ ] T101 [P] [US3] Write `apps/api/test/component/credentials.spec.ts` first (FR-039–FR-042, FR-046; US3 scenarios 1, 5, 6).
  - **Owners**:
    - editors create the four types, validated per type as in the contract's `CredentialSecret`;
    - reads return the name, type, owner, dates and `unreadable`, and never a secret field;
    - `GET /credentials/{id}` lists `usedBy`.
  - **Administrators**:
    - list every credential (metadata only) and filter by `owner`;
    - get 403 on rename and secret replacement, and can delete.
  - **Others**: a viewer gets 403, and another editor gets 403 on someone else's credential.
  - **Deletion**: deleting a credential referenced by an active version answers 409. The test inserts the activation row directly.
  - **Validation**: a foreign credential in a draft gives `foreign-credential`, and publishing is refused.
- [ ] T102 [P] [US3] Write `apps/api/test/integration/outbound/guarded-agent.spec.ts` first (FR-038; SC-006; research R12).
  - **Refused before connecting**:
    - `127.0.0.1`, `[::1]`, `10.0.0.1`, `172.16.0.1`, `192.168.0.1`, `169.254.169.254`, `[::ffff:127.0.0.1]`, `0.0.0.0`, `224.0.0.1`, `[fc00::1]` and `[fe80::1]`;
    - a host name that resolves to a mix of public and private addresses, through a stubbed `lookup`;
    - a redirect to a private address.
  - **Allowed**: an allow-listed host name and an address inside an allow-listed CIDR pass, on any port.
  - **Errors**:
    - a resolution failure is a network error, not an isolation breach;
    - IP literals are classified without `lookup`;
    - an invalid TLS certificate fails;
    - every refusal is `IsolationBreachError` and never retried.
- [ ] T103 [P] [US3] Write `apps/api/test/integration/outbound/http-request.spec.ts` first, against a local fixture server on the allow-list (FR-035, FR-036; US3 scenarios 2, 3, 4, 7).
  - **Requests**:
    - methods GET, POST, PUT, PATCH, DELETE, HEAD and OPTIONS;
    - query parameters and headers;
    - bodies: none, JSON, form-urlencoded, and raw with a content type;
    - each credential type applied as a header, `Authorization: Basic`, `Authorization: Bearer` or a query parameter.
  - **Responses**:
    - the format is automatic (JSON for `application/json` and `+json`), JSON or text;
    - status and headers are included when asked;
    - a non-success status fails the node with the status and a body excerpt of at most 1 KB, unless every status counts as success.
  - **Limits**:
    - the timeout (default 30 s, at most 5 minutes) gives kind `limit`, and so does a response above 10 MB;
    - at most 5 redirects are followed, and the credential is dropped on a cross-origin redirect.
  - **Idempotency key**: off by default. `Idempotency-Key`, or the renamed header, carries `run-<runId>:node:<nodeId>:<itemIndex>`, identical across attempts.
  - **Batching and URLs**:
    - batches of N with an interval;
    - `ftp:` and `file:` URLs, and URLs with user info, are refused.
- [ ] T104 [P] [US3] Write `apps/api/test/unit/node-types/link-header.spec.ts` and `apps/api/test/unit/node-types/pagination.spec.ts` first, with a fake transport (FR-037; research R23; data-model pagination parameters).
  - **Link header**: the RFC 8288 reader takes the first `rel="next"` target, quoted or unquoted, among several links.
  - **Defaults**: `missingNext` completes cursor and next-link pagination, and `emptyRecords` completes the rest.
  - **Completion conditions**: `falseField`, `totalField`, `statusCodes` (whose page is not output) and `formula`.
  - **Records**:
    - a missing `records` path counts as an empty page;
    - an empty object body has no records when no path is set.
  - **Output**: `records` gives one item per record, and `pages` gives one item per page, or `{ body, headers, statusCode }` when the full response is included.
  - **Page limit**: `maxPages` with `onMaxPages` set to `stop` or `fail`. `intervalMs` is waited between pages only.
  - **Parameters**: page number start and step; offset stepped by `records`; a body dot path for GraphQL variables.
  - **Variables**: `$response`, `$pageCount` and `$request` (without credential values) in formulas.
  - **Repeats**: a repeated request signature fails with "pagination did not advance".
  - **Retries**: 429, 502, 503, 504 and connection errors are retried 3 times per page, waiting `Retry-After` up to 60 s, and then fail as `NodeUserError`.
  - **Partial output**: it is discarded when the node fails.
  - **Validation**: `parameters` mode without parameters, `missingNext` without a cursor or next link, and an offset stepped by `records` without a `records` path each give `invalid-parameter`.
- [ ] T105 [P] [US3] Write `apps/api/test/integration/outbound/http-request-pagination.spec.ts` first, against a local fixture API (US3 scenarios 8–13; quickstart Scenario 3b).
  - Each preset collects every record without a formula: cursor in the body or a header, page number, offset by records, and next link in the body or in `Link`.
  - Repeated and cyclic (A, B, A) cursors fail.
  - A 429 with `Retry-After: 2` is retried for that page only.
  - A next link to another origin is requested without the credential, and a next link to `127.0.0.1` is refused with kind `isolation`.
  - `+json` bodies are parsed.
  - More than 10,000 records fail with the step limit.
- [ ] T106 [P] [US3] Write `apps/api/test/unit/application/execute-node-step.credentials.spec.ts` first (FR-040, FR-042; edge cases).
  - A node's credential is decrypted only while that node runs, and only when it is owned by the run's acting user.
  - A missing credential fails the node with a user error naming it. So does a foreign one.
  - An unreadable credential fails with a user error that asks for the secret to be entered again.
  - No message contains the secret.

### Implementation for User Story 3

- [ ] T107 [P] [US3] Implement `apps/api/src/domain/credential.ts` in the `Invitation` style until its part of T100 passes.
- [ ] T108 [P] [US3] Implement `apps/api/src/interface-adapters/storage/aes-gcm.secret-cipher.ts` until its part of T100 passes.
  - `SecretCipher` over `node:crypto`, with a 12-byte random IV, the auth tag stored with the ciphertext, keys from `SECRET_KEYS` and new ciphertexts under `SECRET_KEY_VERSION`.
  - Register it in `apps/api/src/frameworks/di/storage.module.ts`.
  - At startup, log how many credentials and webhook endpoints each key version holds (FR-040).
- [ ] T109 [P] [US3] Create `apps/api/src/interface-adapters/node-types/credential-types.ts`, the credential type catalogue.
  - The types `httpHeader`, `httpBasic`, `httpBearer` and `httpQuery`, each with a zod secret schema that follows the contract's `CredentialSecret` (names at most 200 characters, values at most 8,192 characters) and an `apply(request, secret)` strategy.
  - Serve them as `credentialTypes` from `GET /node-types` through `apps/api/src/application/use-cases/list-node-types.ts`.
- [ ] T110 [US3] Implement `apps/api/src/interface-adapters/persistence/repositories/drizzle-credential.repository.ts` and extend the credential queries.
  - The repository and `apps/api/src/interface-adapters/persistence/mappers/credential.mapper.ts`, with optimistic `version`.
  - Extend `apps/api/src/interface-adapters/persistence/queries/drizzle-credential.queries.ts` with:
    - `list(owner?)`;
    - `get(id)` with `usedBy`, the workflows whose draft or active version references the credential;
    - `isReferencedByActiveVersion(id)`, which joins `activation` and `workflow_version`.
- [ ] T111 [US3] Implement the credential use cases and their policy in `apps/api/src/application/`.
  - `policies/credential.policy.ts`: `manage(user, credential)` is true for the owner; administrators may read metadata and delete.
  - `use-cases/create-credential.ts`, `update-credential.ts` (rename or replace the secret, owner only), `delete-credential.ts` (`CredentialInUseError` while an active version references it), `list-credentials.ts` and `get-credential.ts`.
- [ ] T112 [US3] Implement `apps/api/src/interface-adapters/http/controllers/credentials.controller.ts` with its DTO and presenter.
  - `apps/api/src/interface-adapters/http/dto/credential.dto.ts`, validating the secret by type.
  - `apps/api/src/interface-adapters/http/presenters/credential.presenter.ts`, which never includes the secret and includes `unreadable`.
  - The controller: `GET`/`POST /credentials`, `GET`/`PATCH`/`DELETE /credentials/:credentialId`.

  Register the policy and controller so that T101 passes.

- [ ] T113 [US3] Extend `apps/api/src/application/use-cases/execute-node-step.ts` with the credential accessor until T106 passes.
- [ ] T114 [P] [US3] Implement `apps/api/src/application/use-cases/reencrypt-secrets.ts` (research R13). It re-encrypts up to 200 credentials per minute whose key version is older than `SECRET_KEY_VERSION`, with optimistic `version` checks, and is called from `apps/api/src/interface-adapters/workflows/maintenance.workflow.ts`. Write `apps/api/test/unit/application/reencrypt-secrets.spec.ts` first.
- [ ] T115 [P] [US3] Extend the pino redaction in `apps/api/src/frameworks/pino/http-logger.ts` with `*.secret`, `*.password`, `*.token` and `*.value` under credential bodies (research R13). Test it in `apps/api/test/unit/logging/http-logger.spec.ts`.
- [ ] T116 [US3] Implement `apps/api/src/frameworks/undici/outbound-agent.ts` and `apps/api/src/frameworks/di/outbound-http.module.ts` until T102 passes.
  - The agent: an undici `Agent` whose `connect` is `buildConnector({ lookup: guardedLookup, timeout: 10_000 })`.
    - IP-literal hosts are classified directly.
    - `guardedLookup` resolves with `all: true` and refuses when any address has an `ipaddr.process(ip).range()` other than `unicast`, unless `HTTP_ALLOWED_HOSTS` lists the host or contains the address.
    - A refusal raises `ESSRF`.
  - The module: `@nestjs/http-client` with this dispatcher, `retry: false`, `maxResponseSize` 10 MiB, no proxy and TLS verification on.
- [ ] T117 [US3] Implement `apps/api/src/interface-adapters/node-types/http-request/{manifest.ts,executor.ts}` until T103 passes (FR-035, FR-036).
  - The parameters of FR-035 and FR-036; `credentialTypes` lists all four types; `effects: 'external'`; `dataMode: 'batch'`.
  - Redirects use `redirect: 'manual'`, at most 5 hops. Each hop re-checks the scheme, applies the 301, 302 and 303 method rules and drops credentials on an origin change.
  - A `Content-Length` pre-check and a decoded-size counter enforce the 10 MB limit.
  - The node timeout is `AbortSignal.timeout(timeoutMs)` combined with the step signal.
  - `ESSRF` maps to `IsolationBreachError`.
  - Error messages never include request headers, credential values or query strings.
- [ ] T118 [US3] Implement `apps/api/src/interface-adapters/node-types/http-request/pagination.ts` and `apps/api/src/interface-adapters/node-types/http-request/link-header.ts` until T104 and T105 pass (research R23).
  - `pagination.ts` holds the loop, the request-signature set, completion and the formula scope.
  - The `http-page` policy, created once with `ResilienceService.create`. Its back-off reads `Retry-After` (capped at 60 s) and falls back to exponential back-off.
  - The `pagination` zod schema mirrors `specs/002-workflow-builder/contracts/http-request-pagination.schema.yaml`, and its JSON Schema output is compared with that file in `apps/api/test/unit/node-types/http-request.schema.spec.ts`.
- [ ] T119 [US3] Register `OutboundHttpModule`, the HTTP Request node, the credential adapters, `CredentialPolicy` and `ReencryptSecrets` in `apps/api/src/frameworks/di/automation.module.ts` and `apps/api/src/frameworks/di/app.module.ts`.
- [ ] T120 [US3] Write `apps/api/test/e2e/http-request.spec.ts` (DR-004; quickstart Scenarios 3 and 3b).
  - A bearer credential, then `GET http://httpbin:8080/bearer` for two items, gives `authenticated: true`.
  - `GET /credentials/{id}` has no secret, and `docker compose logs api worker` does not contain the token.
  - The page-number preset over `/anything` gives `args.page` values 1, 2 and 3.
  - `http://169.254.169.254/latest/meta-data` and `http://httpbin:8080/redirect-to?url=http://127.0.0.1/` fail with kind `isolation`.

**Checkpoint**: User Stories 1–3 work on their own

---

## Phase 6: User Story 4 - Route, combine and reshape items with core nodes (Priority: P4)

**Goal**: The remaining 17 core nodes of the catalogue, each with every documented mode and option (SC-009)

**Independent Test**: For each core node, a workflow feeds it a fixed set of items, and the output matches the node's documented behaviour.

### Tests for User Story 4 ⚠️

Each test file is written first and holds literal expectations for every mode and option of the spec's "Core node catalogue" row.

- [ ] T121 [P] [US4] Write `apps/api/test/unit/node-types/switch.spec.ts`.
  - Ordered rules send each item to the first matching output, or to every matching output when that option is on.
  - The fallback is none, an extra output, or output 0, and outputs can be named.
  - `outputsFor` returns the dynamic ports.
  - A `matches` rule uses `re2js`.
- [ ] T122 [P] [US4] Write `apps/api/test/unit/node-types/merge.spec.ts`.
  - Append takes 2–10 inputs.
  - Combine by matching fields offers keep matches, keep non-matches, keep everything, enrich input 1 and enrich input 2, and multiple matches give every pair.
  - Combine by position can include unpaired items.
  - All combinations is the cartesian product.
  - Choose one input outputs input 1 or input 2.
  - Field clashes prefer input 1, prefer input 2, or add the suffixes `_1` and `_2`.
  - When one input is empty, append outputs the other input and the combine modes output nothing (edge case).
- [ ] T123 [P] [US4] Write `apps/api/test/unit/node-types/filter.spec.ts` and `apps/api/test/unit/node-types/stop-and-error.spec.ts`.
  - Filter keeps the items that match conditions joined by AND or OR.
  - Stop and Error throws `NodeUserError` with the configured message, fixed or from a formula.
- [ ] T124 [P] [US4] Write `apps/api/test/unit/node-types/rename-keys.spec.ts`.
  - Pairs rename keys, with dot notation.
  - Regular-expression mode takes a pattern and a replacement, applies at the top level or at any depth, and can ignore case, using `re2js`.
  - A backreference or lookaround gives `invalid-regex`.
- [ ] T125 [P] [US4] Write `apps/api/test/unit/node-types/aggregate.spec.ts` and `apps/api/test/unit/node-types/split-out.spec.ts`.
  - Aggregate collects selected fields into lists, with renamed outputs, merged lists, and missing or null values kept; or it collects all item data into one list field.
  - Split Out turns a list field into items, keeping no other fields, all of them, or selected ones, with a destination field name.
- [ ] T126 [P] [US4] Write `apps/api/test/unit/node-types/summarize.spec.ts`.
  - Grouped by fields, it computes count, count unique, sum, average, minimum, maximum, append, and concatenate with a separator.
  - Output fields are named like `sum_amount`.
  - Without group fields, it outputs one item.
- [ ] T127 [P] [US4] Write `apps/api/test/unit/node-types/sort.spec.ts`, `apps/api/test/unit/node-types/limit.spec.ts` and `apps/api/test/unit/node-types/remove-duplicates.spec.ts`.
  - Sort orders by several fields, ascending or descending and aware of numbers, text and dates; or randomly, using `crypto.randomInt`.
  - Limit keeps the first or last N items.
  - Remove Duplicates compares all fields, all fields except some, or selected fields, and keeps the first occurrence.
- [ ] T128 [P] [US4] Write `apps/api/test/unit/node-types/compare-datasets.spec.ts`.
  - Key field pairs split the items into four outputs: `inA`, `same`, `different` (with the differing fields of both inputs) and `inB`.
  - An option compares loosely ("3" equals 3).
  - Multiple matches include all matches, or only the first.
- [ ] T129 [P] [US4] Write `apps/api/test/unit/node-types/date-time.spec.ts`.
  - Operations: add and subtract durations, extract year, month, week, day, hour, minute or second, format (presets and custom Luxon formats), round down or up to a unit, get the current date with or without time, and the time between two dates in chosen units.
  - The time zone is the workflow's or one set on the node.
  - Daylight-saving transitions are handled.
- [ ] T130 [P] [US4] Write `apps/api/test/unit/node-types/crypto.spec.ts`.
  - Hashes MD5, SHA-1, SHA-256, SHA-384, SHA-512, SHA3-256, SHA3-384 and SHA3-512 in hex or base64, checked against known vectors.
  - Random values: UUID v4, hex, base64, or ASCII of a given length.
  - HMAC and signing are absent (spec Assumptions).
- [ ] T131 [P] [US4] Write `apps/api/test/unit/node-types/html.spec.ts`, `apps/api/test/unit/node-types/xml.spec.ts` and `apps/api/test/unit/node-types/markdown.spec.ts`.
  - **HTML**:
    - a template rendered with HTML-escaped formula values;
    - extraction by CSS selector, returning text, HTML, an attribute or a value, optionally as an array with trimming;
    - conversion of items to an HTML table.
  - **XML**: JSON to XML and XML to JSON, with entities not processed, so an XXE payload stays literal.
  - **Markdown**: Markdown to HTML (GFM tables) and HTML to Markdown (ATX headings, fenced code).
- [ ] T132 [P] [US4] Write `apps/api/test/component/core-nodes.spec.ts`, which runs workflows through the engine (FR-014, FR-015, FR-019; US4 scenarios 1–6; edge cases).
  - A node with no input items is skipped, and so are the nodes after it, unless "always output data" is set.
  - Merge waits for both branches.
  - Field references and formulas resolve per item. A missing field is empty, and so is a reference to a node that has not run.
  - A formula that fails fails the node, naming the parameter.
  - A disabled node passes its items through.
  - Stop and Error ends the run `failed` with its message.
  - An invalid `matches` pattern in If, Filter or Switch gives `invalid-regex`.

### Implementation for User Story 4

Each node is `apps/api/src/interface-adapters/node-types/<type>/{manifest.ts,executor.ts}` with a version-1 zod schema and form metadata, implemented until its test passes.

- [ ] T133 [P] [US4] Implement `apps/api/src/interface-adapters/node-types/switch/` until T121 passes. It reuses `conditions.ts`, and its outputs come from the rules parameter.
- [ ] T134 [P] [US4] Implement `apps/api/src/interface-adapters/node-types/merge/` until T122 passes. The number of inputs comes from the parameters, and the data mode is `all`.
- [ ] T135 [P] [US4] Implement `apps/api/src/interface-adapters/node-types/filter/` and `apps/api/src/interface-adapters/node-types/stop-and-error/` until T123 passes.
- [ ] T136 [P] [US4] Implement `apps/api/src/interface-adapters/node-types/rename-keys/` until T124 passes.
- [ ] T137 [P] [US4] Implement `apps/api/src/interface-adapters/node-types/aggregate/` and `apps/api/src/interface-adapters/node-types/split-out/` until T125 passes.
- [ ] T138 [P] [US4] Implement `apps/api/src/interface-adapters/node-types/summarize/` until T126 passes.
- [ ] T139 [P] [US4] Implement `apps/api/src/interface-adapters/node-types/sort/`, `apps/api/src/interface-adapters/node-types/limit/` and `apps/api/src/interface-adapters/node-types/remove-duplicates/` until T127 passes.
- [ ] T140 [P] [US4] Implement `apps/api/src/interface-adapters/node-types/compare-datasets/` until T128 passes. It has inputs `a` and `b`, and outputs `inA`, `same`, `different` and `inB`.
- [ ] T141 [P] [US4] Implement `apps/api/src/interface-adapters/node-types/date-time/` with `luxon` until T129 passes.
- [ ] T142 [P] [US4] Implement `apps/api/src/interface-adapters/node-types/crypto/` with `node:crypto` until T130 passes.
- [ ] T143 [P] [US4] Implement `apps/api/src/interface-adapters/node-types/{html,xml,markdown}/` until T131 passes (research R16).
  - `html/`, with `cheerio` `load()` only and never `fromURL`.
  - `xml/`, with `fast-xml-parser` (`processEntities: false`, `htmlEntities: false`) and input capped at 16 MB.
  - `markdown/`, with `marked` and `turndown`.
- [ ] T144 [US4] Register the 17 node types in `apps/api/src/frameworks/di/automation.module.ts` until T132 passes. Check that `GET /node-types` lists the 17 new types and that every schema converts with `unrepresentable: 'throw'`.

**Checkpoint**: User Stories 1–4 work on their own; the transform catalogue is complete

---

## Phase 7: User Story 5 - Publish a version and run it automatically (Priority: P5)

**Goal**:

- Immutable numbered versions and a single activation.
- Schedules through the engine, kept in sync by the outbox.
- Webhook endpoints with stable addresses, token or signature authentication, a uniform 404, and delivery deduplication through `@nestjs/idempotency`.

**Independent Test**:

1. Publish and activate a workflow scheduled every minute and a webhook workflow.
2. One run starts per minute, and one per webhook call, against the published version.
3. Draft edits do not change the runs until the next publish (quickstart Scenario 4).

### Tests for User Story 5 ⚠️

- [ ] T145 [P] [US5] Write `apps/api/test/unit/domain/activation.spec.ts` and `apps/api/test/unit/domain/webhook-endpoint.spec.ts` first (data-model Activation, ScheduleRegistration, WebhookEndpoint; FR-011, FR-026, FR-027).
  - `Activation.activate(version, catalog)` derives:
    - one `ScheduleRegistration` per rule, with `scheduleId` `wf.<workflowId>.<nodeId>.<rule>`;
    - `every` for intervals of at least one minute, and `cron` with `tz` for months, weekdays and cron expressions;
    - `webhookNodeIds`.
  - `WebhookEndpoint.create` gives a 43-character base64url id of 32 random bytes. `rotate(secret)` sets `rotatedAt`.
- [ ] T146 [P] [US5] Write the unit tests `apps/api/test/unit/application/publish-workflow-version.spec.ts`, `apps/api/test/unit/application/activate-workflow-version.spec.ts` and `apps/api/test/unit/application/transfer-and-archive.spec.ts` first (FR-005, FR-010, FR-011).
  - **Publish**: a stale revision gives 409, an invalid draft gives `DraftInvalidError`, and the next number is used.
  - **Activate**:
    - a missing, unreadable or foreign credential refuses activation with problems;
    - a new activation replaces the previous one and enqueues the outbox message `activation` in the same transaction.
  - **Archive**: deactivates.
  - **Transfer**: deactivates when the version uses the previous owner's credentials, and records the reason in the log.
- [ ] T147 [P] [US5] Write `apps/api/test/component/publish.spec.ts` first (FR-010, FR-012, FR-017; US5 scenarios 1, 2, 7).
  - `POST /workflows/{id}/versions` with the revision answers 201 `{ number }`, and the draft stays editable.
  - `GET /versions` lists versions newest first, and `GET /versions/{n}` returns the graph.
  - A draft with a cycle, no trigger, an unknown type, invalid parameters or a foreign credential answers 422 with `problems`. Credential rows are inserted directly, so the suite does not need US3.
  - `POST /runs` with `target.version` runs that version's graph after the draft has changed.
  - Activating a newer version ends the previous activation.
- [ ] T148 [P] [US5] Write `apps/api/test/component/activation.spec.ts` first (FR-011, FR-027, FR-046).
  - `PUT /activation` and `DELETE /activation` answer 200 and 204, and archiving deactivates.
  - Activation answers 422 when a referenced credential was deleted (rows inserted directly).
  - `GET /workflows/{id}/webhooks` returns `url`, `methods`, `authentication` and `secret` to the owner and administrators, and 403 to others.
  - Rotation changes the secret and keeps the URL. Webhook endpoints survive new drafts, versions and activations.
- [ ] T149 [P] [US5] Write `apps/api/test/component/ingress-webhooks.spec.ts` first (FR-027; US5 scenarios 4–6; edge cases; quickstart Scenario 4).
  - **Accepted calls**:
    - token mode answers 202 `{ runId }` after the run is recorded;
    - signature mode verifies `sha256=` + hex HMAC-SHA256 of `<timestamp>.<raw body>`.
  - **Uniform 404**: the same 404 body answers each of these:
    - a timestamp 6 minutes old;
    - a missing or wrong token;
    - an unknown, inactive or archived endpoint;
    - a method not configured;
    - an endpoint whose secret is unreadable.
  - **Size**: a body above 1 MB answers 413.
  - **Deliveries with `x-delivery-id`**:
    - a repeat returns the same `runId` with `Idempotent-Replayed: true`;
    - a different body gives 422 `IDEMPOTENCY_KEY_REUSED`;
    - a concurrent duplicate gives 409 with `Retry-After`;
    - a malformed id gives 400;
    - a forged call never affects the genuine delivery.
  - **Run input**: the run's input item has `method`, `path`, `headers` without the secret headers, `query` and `body`.
- [ ] T150 [P] [US5] Write `apps/api/test/integration/persistence/idempotency.store.spec.ts` first. It runs `idempotencyStoreContract({ concurrent: true })` from `@nestjs/idempotency` against the Drizzle store (research R24).
- [ ] T151 [P] [US5] Write `apps/api/test/integration/workflows/schedules.spec.ts` first, with the real store and `ManualWorkflowClock` (FR-026; US5 scenario 3; SC-003; research R6).
  - `ScheduleRegistry.sync` upserts one schedule per rule with `overlap: 'skip'` and `missed: 'skip'`, and removes stale schedules.
  - The outbox `activation` handler calls `sync`.
  - An occurrence starts exactly one run, whose id is derived from the occurrence id, with `version` set.
  - An occurrence due while the previous run of the same rule is active is skipped; another rule still fires.
  - Missed occurrences are not replayed.
  - Europe/Kyiv times that do not exist are skipped, and repeated times run once.
  - Maintenance restores a schedule deleted behind its back within one minute (FR-011).
  - Deactivation removes the schedules.

### Implementation for User Story 5

- [ ] T152 [P] [US5] Implement `apps/api/src/domain/activation.ts` and `apps/api/src/domain/webhook-endpoint.ts` until T145 passes.
- [ ] T153 [US5] Implement `apps/api/src/interface-adapters/persistence/repositories/drizzle-activation.repository.ts` and `apps/api/src/interface-adapters/persistence/repositories/drizzle-webhook-endpoint.repository.ts`, both with optimistic `version`.
  - Their mappers are `apps/api/src/interface-adapters/persistence/mappers/activation.mapper.ts` and `apps/api/src/interface-adapters/persistence/mappers/webhook-endpoint.mapper.ts`.
- [ ] T154 [P] [US5] Implement `apps/api/src/interface-adapters/persistence/drizzle-idempotency.store.ts` (`IdempotencyStore`: `acquire`, `complete`, `release`, `extend`, `prune`) over `idempotency_key` until T150 passes.
- [ ] T155 [US5] Implement the version use cases in `apps/api/src/application/use-cases/`: `publish-workflow-version.ts`, `list-workflow-versions.ts` and `get-workflow-version.ts`. Extend `apps/api/src/application/use-cases/start-manual-run.ts` with `target.version`, for a production run of that version.
- [ ] T156 [US5] Implement the activation use cases in `apps/api/src/application/use-cases/` until T146 passes.
  - `activate-workflow-version.ts` and `deactivate-workflow.ts`, each with an outbox message `activation` in the transaction.
  - `sync-workflow-schedules.ts`.
  - Extend `archive-workflow.ts` to deactivate.
  - Extend `transfer-workflow.ts` to deactivate when the version uses credentials the new owner does not own.
- [ ] T157 [US5] Implement the webhook use cases in `apps/api/src/application/use-cases/`.
  - `list-webhook-endpoints.ts`, which decrypts the secrets for owners and administrators.
  - `rotate-webhook-secret.ts`.
  - Extend `save-draft.ts` to create a `WebhookEndpoint` the first time a Webhook node is saved (FR-027).
  - Extend `apps/api/src/application/use-cases/reencrypt-secrets.ts` to webhook endpoints.
- [ ] T158 [US5] Implement `apps/api/src/interface-adapters/workflows/workflow-client.schedule-registry.ts` and `apps/api/src/interface-adapters/workflows/activation-outbox.handler.ts`.
  - The registry implements `ScheduleRegistry` with `upsert`, and `remove` for stale ids with the prefix `wf.<workflowId>.`.
  - The outbox handler calls `SyncWorkflowSchedules` for each `activation` message.
  - Extend `apps/api/src/application/use-cases/reconcile-runs.ts`, or add `reconcile-schedules.ts` called by maintenance, to compare schedules with activations.
- [ ] T159 [US5] Implement `apps/api/src/interface-adapters/workflows/scheduled-trigger.workflow.ts` and `apps/api/src/application/use-cases/start-scheduled-run.ts` (research R6).
  - The workflow:
    - its step `register-run` calls `StartScheduledRun`;
    - `StartScheduledRun` inserts the run with an id derived from the occurrence id and writes the trigger output `{ timestamp, scheduledAt, timezone }` as attempt 0;
    - the workflow then calls `executeChild('run', { runId, workflowId }, { id: 'run-<runId>', timeout })`.
- [ ] T160 [US5] Implement `apps/api/src/interface-adapters/http/guards/webhook-ingress.guard.ts`, `apps/api/src/application/use-cases/start-webhook-run.ts` and `apps/api/src/interface-adapters/http/controllers/ingress.controller.ts` until T149 passes (research R6, R24).
  - The guard:
    - loads the endpoint, the activation and the node's methods and authentication mode from the version;
    - compares in constant time with `timingSafeEqual`, and checks a 5-minute timestamp skew;
    - throws the same `NotFoundException` for every refusal.
  - `StartWebhookRun`:
    - inserts the run with `deriveRunId('webhook:<endpointId>:<deliveryId>')`, or a random id without a delivery id, with `ON CONFLICT DO NOTHING`;
    - only for a new run, writes the request item as attempt 0 and starts it in the transaction.
  - The controller route `@All('webhooks/:endpointId')`:
    - `@Public()`, `@UseGuards(WebhookIngressGuard)` and `@Transactional()`;
    - `@Idempotent({ keyFrom: { header: 'x-delivery-id' }, scope: (req) => req.params.endpointId, fingerprint: rawBody, storeIf: (status) => status >= 200 && status < 300, ttl: '7d', lockTtl: '30s' })`;
    - answers 202.
- [ ] T161 [P] [US5] Implement `apps/api/src/interface-adapters/node-types/schedule-trigger/` and `apps/api/src/interface-adapters/node-types/webhook/`.
  - Schedule Trigger: rules for every N minutes, hours, days, weeks or months at a time, and cron, with an optional time zone; intervals below one minute are invalid.
  - Webhook: methods GET, POST, PUT, PATCH and DELETE, `authentication` set to `token` or `signature`; its output removes the secret headers.

  Write `apps/api/test/unit/node-types/schedule-trigger.spec.ts` and `apps/api/test/unit/node-types/webhook.spec.ts` first.

- [ ] T162 [US5] Add the routes `GET`/`POST /workflows/:id/versions`, `GET /workflows/:id/versions/:number`, `PUT`/`DELETE /workflows/:id/activation`, `GET /workflows/:id/webhooks` and `POST /workflows/:id/webhooks/:nodeId/secret` to `apps/api/src/interface-adapters/http/controllers/workflows.controller.ts`. Create `apps/api/src/interface-adapters/http/presenters/version.presenter.ts`.
- [ ] T163 [US5] Create `apps/api/src/frameworks/di/idempotency.module.ts` and register the US5 pieces in `apps/api/src/frameworks/di/automation.module.ts` until T147, T148 and T151 pass.
  - `IdempotencyModule` uses `DrizzleIdempotencyStore`; import it in `apps/api/src/frameworks/di/app.module.ts` before `ResilienceModule`.
  - Register the US5 use cases, repositories, the outbox handler, `ScheduledTriggerWorkflow`, the ingress controller and the two trigger nodes.
  - Redact `req.headers["x-webhook-token"]` and `req.headers["x-webhook-signature"]` in `apps/api/src/frameworks/pino/http-logger.ts`.
- [ ] T164 [US5] Write `apps/api/test/e2e/publish-and-trigger.spec.ts` (DR-004; quickstart Scenario 4).
  - Publish and activate.
  - Webhook calls in token mode and signature mode, a redelivery, a 422 for a different body, and a 404 without the secret.
  - A Schedule Trigger every minute produces a run with `version: 1` within 2 minutes.
  - A draft edit does not change the next runs, and `DELETE /activation` stops them.

**Checkpoint**: User Stories 1–5 work on their own

---

## Phase 8: User Story 6 - Wait, call sub-workflows and handle errors (Priority: P6)

**Goal**:

- Durable waits by time or by a signed resume call.
- Sub-workflows with exactly-once calls and cancellation propagation.
- Node retry and on-error settings.
- Error workflows.

**Independent Test**:

1. A two-minute Wait survives a worker restart, and a resume call continues a waiting run.
2. A caller receives the sub-workflow's last-node output.
3. A node with three retries runs three times.
4. A failed run starts its error workflow once (quickstart Scenarios 5 and 6).

### Tests for User Story 6 ⚠️

- [ ] T165 [P] [US6] Write `apps/api/test/unit/application/execute-run.errors.spec.ts` first (FR-016; US6 scenarios 3 and 4).
  - Retry on fail with N attempts and `waitMs` runs a user error N times.
  - A limit or isolation breach runs once.
  - `onError: continue` passes the node's input items on.
  - `onError: errorOutput` sends the failed items through the `error` port, each with `error: { kind, message }`.
- [ ] T166 [P] [US6] Write `apps/api/test/unit/node-types/wait.spec.ts` first (FR-030; US6 scenarios 1 and 2; edge cases).
  - **Time modes**: an interval or a date computes the deadline in a step, then `sleepUntil`. The run is `waiting` in between and the items continue unchanged.
  - **Resume mode**:
    - `waitForResume` honours the optional maximum wait, after which the run continues or fails as configured;
    - each output item carries the call's body under `resume`;
    - `usesResumeAddress` is true.
  - **Run timeout**: a wait longer than the remaining run timeout fails at the timeout.
- [ ] T167 [P] [US6] Write `apps/api/test/unit/node-types/execute-workflow.spec.ts` first (FR-028, FR-031; US6 scenarios 5 and 7; edge cases).
  - **Calls**:
    - the node calls once with all items or once per batch of N;
    - calls run in windows of 20;
    - child ids are `<parentRunId>/<nodeId>/<batch>/a<attempt>`.
  - **Modes**: "wait for completion" outputs the children's last-node items; "continue at once" outputs the input items.
  - **Failures and retries**:
    - a failed, timed-out or cancelled child fails the node with the child run id and its reason;
    - a retry re-runs only the batches that did not succeed.
  - **Limits**:
    - depth 6 fails with the depth limit;
    - more than 1,000 calls per execution or 4,000 per run fail with the limit named.
  - **Targets**: an archived or unpublished target fails as not found.
- [ ] T168 [P] [US6] Write `apps/api/test/unit/application/start-error-run.spec.ts` first (FR-029; US6 scenario 6; edge cases).
  - A failed production run, including a timeout or a limit breach, starts the error run once, with the id `deriveRunId('error:<failedRunId>')`.
  - The error run's input holds the failed run id, the workflow, the node and the message.
  - No error run starts for cancelled runs, test runs or error runs.
  - An archived, unpublished or inactive error workflow records `errorWorkflow: { skipped: 'unavailable' }`.
- [ ] T169 [P] [US6] Write `apps/api/test/unit/storage/hmac.signer.spec.ts` first. `sign(runId)` gives `<runId>.<base64url HMAC-SHA256>`, `verify` uses constant time, and a token with a changed run id fails.
- [ ] T170 [P] [US6] Write `apps/api/test/integration/workflows/waits-and-children.spec.ts` first, with the real store, `ManualWorkflowClock` and two app instances (FR-020, FR-024, FR-030, FR-031; SC-002).
  - **Waits**:
    - a timed wait survives closing the first instance and continues on the second at the deadline;
    - a resume signal sent before the run reaches its Wait resumes it when it gets there;
    - a second signal is refused, and so is a signal after the run ends.
  - **Cancellation**:
    - cancelling a waiting run ends it `cancelled` without resuming;
    - cancelling a parent cancels the children it waits for (`parentClose: 'cancel'`), while "continue at once" children keep running.
  - **Crashes**:
    - a crash between child starts never starts a call twice;
    - a crash in the middle of a Wait never waits again from the start.
  - **Error workflows**: one starts once for a timed-out run, through the compensation, and for a run repaired by the sweep.
- [ ] T171 [P] [US6] Write `apps/api/test/component/resume.spec.ts` first (FR-030; quickstart Scenario 5).
  - `POST /resume/{token}` answers 202, and the run continues with the body.
  - A bad signature gives 404.
  - Another call after the accepted one gives 409, and the run keeps the first body.
  - Repeating the accepted call with the same `Idempotency-Key` returns the original 202.
  - With the header-credential option, a call without the credential's value gives 404.
  - A body above 1 MB gives 413.
  - A finished, timed-out or cancelled run gives 409.
  - `{{ $execution.resumeUrl }}` resolves to `${PUBLIC_API_URL}/resume/<token>`.

### Implementation for User Story 6

- [ ] T172 [P] [US6] Implement `apps/api/src/interface-adapters/storage/hmac.signer.ts` (`Signer`, with `SIGNING_KEY`) and register it in `apps/api/src/frameworks/di/storage.module.ts` until T169 passes.
- [ ] T173 [US6] Complete `apps/api/src/interface-adapters/workflows/workflow-context.step-runner.ts` and `apps/api/src/interface-adapters/workflows/workflow-client.run-engine.ts` (research R3, R6).
  - In `apps/api/src/interface-adapters/workflows/workflow-context.step-runner.ts`:
    - `sleepUntil` is `ctx.sleepUntil`;
    - `waitForResume` is `ctx.waitForSignal('wait:<nodeId>', 'run.resume', { key: runId, timeout })`;
    - `runChild` is `executeChild` with `parentClose: 'cancel'` when waiting, or `startChild` with `parentClose: 'abandon'`, with id `run-<childRunId>`.
  - In `apps/api/src/interface-adapters/workflows/workflow-client.run-engine.ts`, add `signal('run.resume', { key: runId, id: 'resume-<runId>', payload })`, which returns `created`.
- [ ] T174 [US6] Extend `apps/api/src/application/use-cases/execute-run.ts` and `apps/api/src/application/use-cases/execute-node-step.ts` with `onError: continue` and `errorOutput` (data-model PortDefinition `error`) until T165 passes.
- [ ] T175 [US6] Implement `apps/api/src/interface-adapters/node-types/wait/{manifest.ts,executor.ts}` (`execution: 'orchestrated'`) until T166 passes.
  - The steps `wait:<nodeId>:enter` and `wait:<nodeId>:leave` set `waiting` and `running`.
  - The resume body is read from the key carried in the signal payload.
  - An optional `headerCredentialId` refers to one of the owner's `httpHeader` credentials.
- [ ] T176 [US6] Implement `apps/api/src/application/use-cases/resume-run.ts`, `apps/api/src/interface-adapters/http/guards/resume.guard.ts` and the resume route until T171 passes.
  - `ResumeRun`:
    - verify the token, else 404;
    - refuse a finished run with 409;
    - store the body at `runs/<runId>/resume/<callId>.json`;
    - signal, turning `created: false` into `ResumeRefusedError`.
  - The guard: when the run's resume Wait requires a header credential, compare its value in constant time, and answer 404 on a mismatch.
  - The route `POST /resume/:token` in `apps/api/src/interface-adapters/http/controllers/ingress.controller.ts`, with `@Public()`, `@Idempotent({ required: false, scope: (req) => runIdFrom(req.params.token) })` and an answer of 202.
  - `$execution.resumeUrl` is set in the run metadata used by formulas and Code node helpers.
- [ ] T177 [US6] Implement `apps/api/src/interface-adapters/node-types/execute-workflow-trigger/` and `apps/api/src/interface-adapters/node-types/execute-workflow/` until T167 passes.
  - Execute Workflow Trigger: accepts all caller items or declared input fields.
  - Execute Workflow (`execution: 'orchestrated'`):
    - the step `node:<id>:prepare` writes the batch inputs and inserts the child runs with derived ids and `depth + 1`;
    - `runChild` runs per batch in windows of 20;
    - the step `node:<id>:collect` concatenates the last-node output references;
    - the user's retry attempts are counted by the executor.
- [ ] T178 [US6] Implement `apps/api/src/application/use-cases/start-error-run.ts` and `apps/api/src/interface-adapters/node-types/error-trigger/` until T168 passes.
  - `StartErrorRun` is called from `finish-run`, from the `register-run` compensation and from `ReconcileRuns`.
  - The Error Trigger outputs the failed run, workflow, node and error message.
- [ ] T179 [US6] Register the Wait, Execute Workflow, Execute Workflow Trigger and Error Trigger nodes, `ResumeRun`, `StartErrorRun`, the resume guard and the signer in `apps/api/src/frameworks/di/automation.module.ts` until T170 passes.
- [ ] T180 [US6] Write `apps/api/test/e2e/wait-and-recovery.spec.ts` (DR-004; quickstart Scenarios 5 and 6; SC-002).
  - A two-minute Wait, then `docker compose restart worker`; the run succeeds after the wait.
  - Resuming through `$execution.resumeUrl`.
  - A production run whose middle Code node sleeps 20 s: `docker compose kill worker`, then `up -d worker`. Within 60 s, the run continues; the earlier steps keep `attempts: 1`, the Code node shows `attempts: 2`, and the run succeeds.

**Checkpoint**: User Stories 1–6 work on their own

---

## Phase 9: User Story 7 - Review run history and keep it bounded (Priority: P7)

**Goal**: Paged, filterable run lists, an administrator-only retention policy, and a nightly retention job that removes rows, artifacts and engine instances.

**Independent Test**:

1. Produce runs, then list and filter them.
2. Set retention to one day and five runs, then trigger the job.
3. Only the allowed runs and their outputs remain, and active runs are untouched (quickstart Scenario 7).

### Tests for User Story 7 ⚠️

- [ ] T181 [P] [US7] Write `apps/api/test/unit/domain/retention-settings.spec.ts` first (FR-044). The defaults are 14 days and 10,000 runs, and `update(days, max, actorId)` validates "1–3650 days and 1–1,000,000 runs".
- [ ] T182 [P] [US7] Write `apps/api/test/component/history.spec.ts` first (FR-043; US7 scenario 1).
  - `GET /workflows/{id}/runs` returns runs newest queued first, with status, trigger type, version, start and end.
  - The `status` filter works.
  - Paging with `nextCursor` neither repeats nor skips a run while new runs are queued.
  - An unknown workflow gives 404.
- [ ] T183 [P] [US7] Write `apps/api/test/component/retention.spec.ts` first (FR-044, FR-046; US7 scenario 4).
  - An administrator reads and changes the policy (200).
  - Editors and viewers get 403.
  - Values outside the ranges give 400.
- [ ] T184 [P] [US7] Write `apps/api/test/integration/workflows/retention.spec.ts` first (FR-045; US7 scenarios 2 and 3; research R19).
  - **Removed**: finished runs older than the period, and finished runs beyond the per-workflow maximum (window function), in batches of 200. Their `runs/<id>/` objects, Step and Run rows and engine instances (`delete('run-<id>')`) go with them.
  - **Kept**: queued, running and waiting runs, whatever their age.
  - **Continuation**: past the batch limit, the job continues in a new instance.
  - **Housekeeping**:
    - `purge({ olderThan })` removes old trigger and maintenance instances;
    - the idempotency store's `prune()` and the outbox inbox `prune()` run.
- [ ] T185 [P] [US7] Write `apps/api/test/integration/persistence/run-history.spec.ts` first (SC-010). With 10,000 runs of one workflow, listing a page and paging a step output each return within 2 s. Record the timings in the test output.

### Implementation for User Story 7

- [ ] T186 [P] [US7] Implement `apps/api/src/domain/retention-settings.ts` until T181 passes.
- [ ] T187 [US7] Implement `apps/api/src/interface-adapters/persistence/repositories/drizzle-retention-settings.repository.ts` and extend `apps/api/src/interface-adapters/persistence/queries/drizzle-run-history.reader.ts`.
  - The reader gains `list(workflowId, { status, cursor, limit })`: a keyset on (`queued_at` desc, `id` desc) with an opaque cursor, and `selectForRetention`, a window function per workflow.
- [ ] T188 [US7] Implement `apps/api/src/application/policies/settings.policy.ts` and the history and settings use cases.
  - `SettingsPolicy.manage(user)` is true for administrators.
  - In `apps/api/src/application/use-cases/`: `list-runs.ts`, `get-retention-settings.ts` and `update-retention-settings.ts`.
- [ ] T189 [US7] Implement `apps/api/src/application/use-cases/apply-retention.ts` and `apps/api/src/interface-adapters/workflows/retention.workflow.ts` until T184 passes.
  - The retention workflow is a declared schedule nightly at 03:00 UTC.
- [ ] T190 [US7] Create `apps/api/src/interface-adapters/http/controllers/settings.controller.ts` and add the run list route to `apps/api/src/interface-adapters/http/controllers/workflows.controller.ts`.
  - The settings controller (`GET`/`PUT /settings/retention`, `@Can(SettingsPolicy, 'manage')`) and `apps/api/src/interface-adapters/http/dto/retention.dto.ts`.
  - Add `GET /workflows/:id/runs` to `apps/api/src/interface-adapters/http/controllers/workflows.controller.ts`.
- [ ] T191 [US7] Register `SettingsPolicy`, the US7 use cases, the repository, `RetentionWorkflow` and the controller in `apps/api/src/frameworks/di/automation.module.ts` until T182, T183 and T185 pass.

**Checkpoint**: All user stories work on their own

---

## Phase 10: Polish & Cross-Cutting Concerns

**Purpose**: Success criteria that span stories, architecture documents (research R21), contract conformance and the delivery gates

- [ ] T192 [P] Update `docs/architecture/01-domain.md` (R21):
  - `WebhookEndpoint` becomes an aggregate;
  - workflow ownership and `NodeSample` are added;
  - `Run` gains `mode` and `depth`.
- [ ] T193 [P] Update `docs/architecture/02-system.md` (R21): Garage, the `workflows:migrate` release step, the KEDA query (documented as unstable), pool sizing, the worker and sandbox sidecar, and the gateway rate limits.
- [ ] T194 [P] Update `docs/architecture/03-api.md` (R21):
  - the modules `WorkflowsInfraModule`, `StorageModule`, `OutboundHttpModule`, `IdempotencyModule` and `ResilienceModule` (policies `http-page`, `sandbox`, `storage`);
  - the ports `FormulaEngine`, `Signer`, `NodeSampleRepository` and `WebhookEndpointRepository`;
  - the controllers, and the `ROLE` bootstrap.
- [ ] T195 [P] Update `docs/architecture/04-execution.md` with every item of research R21:
  - the status projection replaces `events$`, and queued rows are inserted with the start;
  - the scheduled-trigger workflow, and concurrency keyed by a function of the input;
  - the timeout includes queued time, and the retry accounting;
  - waits and children go through `StepRunner`, and the resume signal id is per run;
  - status rows replace `setStatus`, and retention uses `delete(id)`;
  - signals serialise behind a global lock.
- [ ] T196 [P] Update `docs/architecture/05-node-types.md` (R21): `execution` and `effects` in manifests, zod parameters served as JSON Schema, Python and the shared Code node contract, and the HTTP Request node with pagination and its formula scope.
- [ ] T197 [P] Update `docs/architecture/06-security.md` (R21):
  - SSRF controls, and credential and webhook secrets with key rotation and loss;
  - the uniform webhook 404, delivery deduplication, and signed resume addresses with the optional header credential;
  - object-level checks, and gateway rate limits.
- [ ] T198 [P] Update `apps/api/README.md`:
  - the two roles and the new scripts (`workflows:migrate`);
  - the new environment variables;
  - the Docker requirements for the sandbox (privileged containers, user namespaces, cgroup v2);
  - how to run the integration suites with Garage and the sandbox image.
- [ ] T199 [P] Write `apps/api/test/component/openapi.spec.ts`. It compares the generated `/api/v1/docs-json` with `specs/002-workflow-builder/contracts/openapi.yaml`: the same paths, methods and status codes. Fix the Swagger decorators of the Automation controllers until it passes.
- [ ] T200 [P] Write `apps/api/test/e2e/performance.spec.ts` (SC-001). A test run of a 10-node workflow processing 100 items finishes, with readable step outputs, within 10 s of the start request.
- [ ] T201 [P] Write `apps/api/test/e2e/concurrency.spec.ts` (SC-008), run with `docker compose --profile app up -d --scale worker=2`.
  - Setup: 10 workflows, each Manual Trigger → Edit Fields → If → Code → HTTP Request to httpbin, with 10 runs started at once on each.
  - All 100 runs end within 5 minutes, and none is lost or duplicated.
  - Sampling the engine state every second, no workflow ever has more than 5 runs executing.
- [ ] T202 Create `apps/api/scripts/scan-secrets.ts` and run it in CI after the end-to-end journeys (SC-007). It searches for the known test secrets of every suite in:
  - the recorded API responses;
  - `docker compose logs api worker`;
  - the `nest_workflows` journal tables;
  - every object under `runs/`;
  - the `run` and `step` rows, including errors;
  - the outbox and `idempotency_key` tables.

  It fails on any match. Add the step to `.github/workflows/ci.yml`.

- [ ] T203 Extend the `image` job in `.github/workflows/ci.yml` so that `docker compose --profile app up -d --wait` starts `worker` and `sandbox` too, and the end-to-end journeys of every story run against them.
- [ ] T204 Run `specs/002-workflow-builder/quickstart.md` Scenarios 1–7 and its image and security gates against the Compose stack. Fix any divergence in the code, or in the quickstart when the code is right.
- [ ] T205 Run the final verification and record it in `specs/002-workflow-builder/tasks.md`:
  - `pnpm lint`, `pnpm check-types`, `pnpm --filter api test`, `pnpm --filter api test:int` and `pnpm --filter api test:e2e` all pass with no skipped tests;
  - Trivy finds no critical or high issues in `workflow-platform/api:dev` and `workflow-platform/sandbox:dev`;
  - `pnpm audit --prod --audit-level=high` is clean, and `apps/api/package.json` has only exact versions.

  - `GET /node-types` lists 29 types (quickstart Scenario 1).

  Record the results, the measured SC-001, SC-008 and SC-010 timings, and any deviations in a "Results" section.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies.
- **Foundational (Phase 2)**: depends on Setup and blocks every user story.
- **User Story 1 (Phase 3)**: depends on Foundational. It is the MVP and the base the other stories build on: workflows, drafts, test runs and run reads.
- **User Stories 2, 3, 4, 5 and 7**: each depends only on US1. They can proceed in parallel.
- **User Story 6 (Phase 8)**: depends on US5, because Execute Workflow, error workflows and the resume ingress need published, active versions and the ingress controller. Its worker-kill journey (T180) also uses the Code node from US2.
- **Polish (Phase 10)**: depends on every story it measures. T201 needs US2 and US3, and T203 needs US2 and US6.

### User Story Dependencies

```text
Setup → Foundational → US1 ─┬─ US2 ─────────────┐
                            ├─ US3              │
                            ├─ US4              ├─→ Polish
                            ├─ US5 ──→ US6 ←────┘
                            └─ US7
```

### Within Each User Story

- Tests are written first and must fail before the implementation.
- Domain before persistence, persistence before use cases, use cases before controllers. Module registration and the end-to-end journey come last.
- `automation.module.ts`, `workflows.controller.ts`, `execute-run.ts` and `execute-node-step.ts` are shared files: tasks that edit them are never marked [P], and stories that run in parallel serialise their edits to them.

### Parallel Opportunities

- **Setup**: T003, T004, T005, T006, T007 and T008 run in parallel after T001 and T002.
- **Foundational**:
  - the four domain test tasks and T013, T014 and T015;
  - the five schema tasks;
  - the store, IO, formula, parameter, resolution and registry test tasks;
  - T024 and T025.
- **US1**: all nine test tasks, then T073, T074, T082, T083 and T086.
- **US4**: the 12 test tasks and the 11 node implementation tasks, which are independent folders.
- **Across stories**: once US1 is done, US2, US3, US4, US5 and US7 can be staffed in parallel.

---

## Parallel Example: User Story 1

```bash
# Tests first, together:
Task: "T064 Write apps/api/test/component/workflows.spec.ts"
Task: "T065 Write apps/api/test/component/drafts.spec.ts"
Task: "T066 Write apps/api/test/component/runs.spec.ts"
Task: "T067 Write apps/api/test/unit/application/validate-draft.spec.ts"
Task: "T069 Write conditions.spec.ts and if.spec.ts"

# Independent implementation files, together:
Task: "T073 Implement apps/api/src/domain/node-sample.ts"
Task: "T074 Implement node-types/conditions.ts"
Task: "T082 Create draft.schema.ts, the zod pipe and DTOs"
Task: "T083 Create the workflow, run and node-type presenters"
```

## Parallel Example: User Story 4

```bash
Task: "T122 Write merge.spec.ts"      then "T134 Implement merge/"
Task: "T128 Write compare-datasets.spec.ts" then "T140 Implement compare-datasets/"
Task: "T129 Write date-time.spec.ts" then "T141 Implement date-time/"
Task: "T131 Write html, xml and markdown specs" then "T143 Implement html/, xml/, markdown/"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup.
2. Complete Phase 2: Foundational. This is the critical path; its crash test (T063) must pass before any story.
3. Complete Phase 3: User Story 1.
4. **Stop and validate**: run quickstart Scenario 1 and T087.
5. Demo the editor loop through the API: create, save, test-run, read outputs.

### Incremental Delivery

1. Setup and Foundational give the durable execution core.
2. US1 adds building and test runs (the MVP).
3. US2 adds the Code node, the escape hatch for any transformation.
4. US3 adds HTTP Request with credentials and pagination, the outbound reach.
5. US4 adds the full core node catalogue.
6. US5 adds publishing, schedules and webhooks, making automations run on their own.
7. US6 adds waits, sub-workflows and error handling.
8. US7 adds history and retention.
9. Phase 10 adds the success criteria, documentation and delivery gates.

### Parallel Team Strategy

1. The team completes Setup and Foundational together.
2. One developer takes US1 while the others prepare the US2 sandbox image (T092, T093) and the US4 node tests.
3. After US1:
   - Developer A: US2, then US6.
   - Developer B: US3.
   - Developer C: US4.
   - Developer D: US5, then US7.
4. US6 starts when US5 is merged.

---

## Notes

- Tests precede the implementation in every phase (constitution VI; DR-004). Each test task names the FR, scenario or decision it covers.
- `checklists/review-gate.md` is reviewer-owned; no task changes its checkboxes.
- Data-model refinements made by these tasks (`workflow.updated_at`, `run.parent_run_id` on delete set null) are written back to `data-model.md` in T027 and T030.
- `apps/web` is not modified (DR-005).
- Commit after each task or logical group with the repository's commit conventions. `master` changes only through pull requests.
