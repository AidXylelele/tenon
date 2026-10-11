# Research: Workflow Builder and Core Nodes

Phase 0 of the plan. Each decision names its sources: the NestJS documentation pages, the type declarations
of the installed packages (`@nestjs/workflows` 0.0.2 was read from its `dist/*.d.ts` and `.js`), and the
architecture documents in `docs/architecture`. Mismatches between those documents and the real APIs are
collected in R21; the documents are corrected by this feature.

## R1. Bounded context, modules and process roles

- **Decision**: The Automation context is assembled by `AutomationModule` (`frameworks/di/automation.module.ts`), following the shape of `IdentityAccessModule`.
  - It registers controllers, repositories, queries, the node type registry with its executors, the workflow classes, the engine gateways and the use cases. Use cases are built by factory providers.
  - New infrastructure modules: `WorkflowsInfraModule` (engine and store), `StorageModule` (S3 client, `SecretCipher`, `Signer`), and `OutboundHttpModule` (the guarded HTTP client).
  - `main.ts` reads `ROLE`:
    - `api` uses `NestFactory.create` with the HTTP listener and runs no worker;
    - `worker` uses `NestFactory.createApplicationContext` and enables the worker.

  The provider set is identical in both roles (docs/architecture/02-system.md).

- **Rationale**: One codebase, one image and one `AppModule`, as decided in 02-system.md. Role-specific behaviour is only the bootstrap and the worker option, so the API can never claim runs.
- **Alternatives considered**: A separate worker application (rejected: two codebases share the domain); worker loops in the API pods (rejected: HTTP latency and run execution would compete for the event loop, and scaling would be coupled).

## R2. Durable execution on `@nestjs/workflows`

- **Decision**: `@nestjs/workflows` 0.0.2.
  - Setup: `WorkflowsModule.forRootAsync` with `worker: false` for `api` and `{ concurrency: WORKER_CONCURRENCY, shutdownTimeout: '20s' }` for `worker`, and `retry: { attempts: 1 }` as the module default (each step sets its own).
  - Store: `PostgresWorkflowStore({ executor: fromDrizzle(db) }, storage)`, registered as in `outbox.module.ts`.
  - Migrations: a `workflows:migrate` script (`nest-workflows migrate --url "$DATABASE_URL"`) next to `db:migrate` and `outbox:migrate`, run as a release step and in CI.
  - Pool size: `pg.Pool` gets `max` from `DATABASE_POOL_MAX`; the worker role needs about twice its concurrency plus five connections.
  - Workflow classes, all registered in both roles:
    - `run`: one instance per run, input `{ runId, workflowId }`;
    - `scheduled-trigger`: one instance per schedule occurrence;
    - `maintenance`: declared schedule, every minute;
    - `retention`: declared schedule, nightly at 03:00 UTC.
  - Versioning: changing the sequence of context calls in `run` requires `@Workflow('run', { version: n + 1 })`, and the previous version stays registered until no unfinished instance of it remains. Step bodies and step options may change freely.
- **Rationale**: The constitution's first-party rule and the architecture documents name this engine. Its PostgreSQL store is the platform's only stateful component besides object storage (02-system.md). Claims use `FOR UPDATE SKIP LOCKED` with lease fencing, so any number of workers is safe.
- **Alternatives considered**: A drizzle-kit custom migration generated from `PostgresWorkflowStore.migrationSql()` (rejected: every package upgrade would need a hand-written `{ from, to }` migration); BullMQ with Redis, as in n8n queue mode (rejected: a second state store, and no durable step journal, so a crash loses the run's progress).

## R3. Run interpreter

- **Decision**: The `run` workflow class is the entry adapter. It wraps the engine context in `WorkflowContextStepRunner`, which implements the `StepRunner` port, and calls the use case `ExecuteRun`.
  - `ExecuteRun.execute(runId, steps)` does the following:
    1. Step `register-run` sets the run to running and returns a compact plan: the topological order, the upstream map, the node types, the settings and the trigger output reference. The full graph is read inside this step, so `run()` performs no I/O outside the context (an engine rule).
    2. It visits nodes in topological order, one at a time.
    3. It records skipped branches without steps.
    4. Step `finish-run` writes the terminal status.
  - Each node is executed according to its manifest's `execution` mode:
    - `step`: one durable step `node:<nodeId>` that invokes the use case `ExecuteNodeStep`. That use case reads the inputs chunk by chunk, resolves parameters per item, runs the executor, writes the output chunks and the Step row, and returns `{ outputs: [{ port, items, bytes, chunkStarts, attempt }] }`.
    - `orchestrated`: the executor receives the `StepRunner` and composes durable steps, sleeps, waits and child runs itself. Wait and Execute Workflow use this mode, and so will future AI agent nodes: a model call becomes one durable step, so a crash never repeats a paid call and a step result works as a cache.
  - The `StepRunner` port exposes `step(name, work, options)`, `sleepUntil(name, until)`, `waitForResume(name, runId, timeoutMs)` and `runChild(id, input, { wait, timeoutMs })`. The work function receives `{ idempotencyKey, attempt, signal }`.
- **Rationale**: Sequential topological execution is deterministic and matches n8n's v1 execution order. A Wait or a retry back-off pauses the whole run in any case, because the engine starts no new step while one branch is suspended. Journal entries hold only references, so a 200-node graph stays near 300 entries and under 100 KB.
- **Alternatives considered**: Parallel branches with `Promise.all` (deferred: more throughput per run, but a suspension in one branch stalls the others, and the plan must name every step deterministically; throughput comes from running many runs in parallel instead); one engine workflow per node type (rejected: it multiplies instances and loses the per-run journal).

## R4. Run status projection and reconciliation

- **Decision**: The Run row is the source of truth for clients, and the steps that change state write it:
  - The command that starts a run inserts the row as `queued` in the same transaction as `RunEngine.start(..., { transaction: txHost.tx })`.
  - Step `register-run` sets `running`. Its compensation sets `cancelled` when the engine reason is `WorkflowCancelledError` and `failed` otherwise (timeout, journal limit, interruption), and starts the error workflow. Compensation runs on failure, cancel and timeout.
  - The steps around a Wait set `waiting` and then `running`.
  - Step `finish-run` writes `succeeded` or `failed`. A node failure with `onError: stop` is caught in `ExecuteRun`, which finishes the run as `failed` instead of throwing.
  - `CancelRun` sets `cancelled` and calls `cancel()` in the same request transaction (engine call last).
  - The `maintenance` workflow lists non-terminal rows older than two minutes, compares them with `getStatus()` and projects the engine state. `GET /runs/:id` repairs a stale row on read in the same way.
- **Rationale**: `WorkflowEvents.events$` is an in-process subject. It emits only in the worker that executed the instance, after the store write, so the API never sees it, and a crash between the write and the emit loses the event. 04-execution.md relied on it.
- **Alternatives considered**: Subscribing to `events$` in the worker (kept out: it is not durable and is redundant with the steps); polling the engine on every read (rejected: it couples reads to the engine schema and multiplies queries).

## R5. Retries, error categories and crash recovery

- **Decision**: Each node step gets the engine retry option `{ attempts: userAttempts + 2, backoff: { delay: userWaitMs, factor: 1 }, retryIf }`.
  - `retryIf` retries platform errors always, and user errors only while the attempt number is below the user's setting.
  - The two extra attempts absorb crashes: an attempt is recorded before the work runs, so a crash or a lost lease consumes one.
  - Executors throw named subclasses (`NodeUserError`, `NodeLimitError`, `IsolationBreachError`, `PlatformError`), because `StepFailedError` keeps only `name` and `message` of its cause.
  - Limit and isolation breaches are wrapped in `NonRetryableStepError`.
  - Idempotency keys are `run-<runId>:node:<nodeId>:<itemIndex>`. They are stable across attempts and recovery and are sent by the HTTP Request node when asked (FR-036).
  - Output chunks are written under the attempt number, so a repeated attempt never mixes with a crashed one.
- **Rationale**: FR-020 makes the node the checkpoint and accepts repeated external effects. The engine's attempt accounting would otherwise fail a node with `StepInterruptedError` after a crash when the user asked for one attempt.
- **Alternatives considered**: Per-item or per-batch checkpoints (rejected in clarification: simpler semantics were preferred); retrying user errors by default (rejected: FR-016 makes retries opt-in).

## R6. Triggers, waits and sub-workflows

- **Decision**:
  - **Manual**: `POST /runs` writes the trigger items as attempt 0 of the trigger node, inserts the Run row and starts `run-<runId>` in the request transaction.
  - **Webhook**:
    - Ingress: `ALL /webhooks/:endpointId` (public, raw body, at most 1 MB) loads the `WebhookEndpoint` and the workflow's Activation and verifies the secret in constant time, either from the `x-webhook-token` header or from the HMAC-SHA256 `x-webhook-signature` header over the raw body.
    - Deduplication: with an `x-delivery-id` header, the run id is derived from `webhook:<endpointId>:<deliveryId>`. The unique `trigger_key` and the engine's id check deduplicate, and a different `payload_hash` for a known key answers 409 (FR-027).
    - The response is 202 after the commit.
  - **Schedule**:
    - Activation writes an outbox message `activation` in the same transaction.
    - Its handler calls `ScheduleRegistry.sync(workflowId)`, which upserts one engine schedule per rule (`wf.<workflowId>.<nodeId>.<rule>`, `cron` or `every` with `tz`, `overlap: 'skip'`, `missed: 'skip'`) and removes stale ones. This is needed because `upsert` is not transactional.
    - The maintenance sweep reconciles schedules with activations.
    - Each occurrence starts `scheduled-trigger`:
      1. Its step `register-run` inserts the Run row with an id derived from the occurrence id.
      2. It then calls `executeChild(run, ..., { id: 'run-<runId>', timeout })`, so overlap skipping covers the whole run and every scheduled run gets its own timeout.
  - **Wait**:
    - Time modes: `sleepUntil` with the deadline computed in a step.
    - Resume mode: `waitForResume`, which is `waitForSignal('wait:<nodeId>', 'run.resume', { key: runId, timeout })`.
    - The resume address is `/resume/<runId>.<hmac>`, with the HMAC by the `Signer` port. It is derived, so no secret is stored, and it is stable across replays.
    - `POST /resume/:token` stores the body as `runs/<runId>/resume.json` and signals with `id: 'resume-<runId>'`, so only one call per run is accepted (FR-030).
    - A graph may contain at most one resume-mode Wait (validation error).
  - **Execute Workflow**:
    1. Step `node:<id>:prepare` writes the batch inputs and inserts child Run rows with ids derived from `<parentRunId>/<nodeId>/<batch>`.
    2. `runChild` per batch runs in windows of 20 (`executeChild`, or `startChild` with `parentClose: 'abandon'` for "continue at once").
    3. Step `node:<id>:collect` concatenates the children's last-node output references.
    - `depth` travels in the Run row, and depth 6 fails the node.
    - Each child costs two journal entries, so a run may make at most 4,000 sub-workflow calls in total (journal budget 10,000 entries) besides the 1,000 per node (FR-031).
  - **Error workflow**: started by `finish-run` or by the compensation, with a run id derived from `error:<failedRunId>`. It is never started for test runs or error runs.
- **Rationale**: These are engine-native mechanisms: the transactional `start` and `signal`, schedules with overlap and missed policies, child workflows with deterministic ids, and signals with a cursor that cannot lose a wake-up.
- **Alternatives considered**: Schedules that start `run` directly (rejected: no per-run timeout and no queued row, and overlap would cover only the instant of the start); deduplicating deliveries in the application only (rejected: the engine's id comparison already gives exactly-once starts).

## R7. Concurrency, timeouts and limits

- **Decision**:
  - **Concurrency**: `@Workflow('run', { concurrency: { limit: RUN_CONCURRENCY_PER_WORKFLOW, key: (input) => input.workflowId } })`.
    - The limit is read from `process.env` when the class is imported, because decorator options are evaluated at import time. The same variable is validated by the configuration schema at startup.
    - A slot is held only while a run executes, never while it waits (FR-023).
  - **Run timeout**: passed per run as `start({ timeout })` from the workflow settings. It counts from the start request and includes queued time, which spec FR-022 now states.
  - **Limits**: item and byte limits are enforced by the output writer, and the per-run total by `ExecuteRun`, from the step results.
- **Rationale**: These are the engine's own mechanisms. A per-workflow configurable limit would need custom scheduling on top of the engine.
- **Alternatives considered**: A `concurrencyKey` with per-key limits stored per workflow (rejected: the engine has one static per-key limit, so per-workflow values would need custom admission control).

## R8. Node type catalogue and parameter schemas

- **Decision**: `NodeType` is a domain model (docs/architecture/05-node-types.md).
  - Each type contributes `manifest.ts` (a `NodeType` instance) and `executor.ts` from `interface-adapters/node-types/<type>/`.
  - `NodeTypeRegistry` implements the `NodeTypeCatalog` port and collects them from dependency injection through a multi-provider token. Adding an integration is a new folder and one registration, with no core change.
  - Parameter schemas are written in `zod` 4.6.5 (already a dependency) as one `z.strictObject` per type version.
    - Every parameter accepts a `ParameterValue`: a fixed value, a field reference or a formula.
    - `describe()` serves `z.toJSONSchema(schema, { target: 'draft-2020-12', io: 'input', unrepresentable: 'throw' })` with form metadata in `.meta()`: `x-options`, `x-widget`, `x-acceptsReference`, `x-acceptsFormula` and `x-showWhen`.
    - `validate()` maps `safeParse` issue paths to `(nodeId, parameter)` problems.
    - At run time the resolved value is validated against the same schema.
  - The domain sees only the `ParameterSchema` interface.
  - Manifest fields:
    - `execution`: `step` or `orchestrated` (R3);
    - `effects`: `none` or `external`, which marks nodes whose repetition after a crash is visible outside (R5);
    - `credentialTypes`.

  Credential types form a catalogue of their own. The generic HTTP types now (header, basic, bearer, query parameter); OAuth2 and service types come with the integrations, through the same catalogue and an `apply` strategy per type.

- **Rationale**: One schema gives the web its forms, the API its validation and the executor its typed parameters. It is a library the codebase already validates configuration with, and no custom validation engine is written.
- **Alternatives considered**: A hand-written parameter definition language like n8n's `INodeProperties` (rejected: a custom validator with every rule re-implemented); Ajv with JSON Schema sources (rejected: a second validator, generated code with `new Function`, untyped executors); class-validator classes (rejected: static decorators, no JSON Schema export).

## R9. Data between nodes and paging

- **Decision**: Node outputs are immutable JSON Lines chunks in S3-compatible object storage, keyed `runs/<runId>/nodes/<nodeId>/a<attempt>/<port>/<chunk>.jsonl`.
  - A chunk closes at 500 items or 4 MiB, whichever comes first. A single large item gets its own chunk.
  - The Step row stores `items`, `bytes` and `chunkStarts` (the first item index of each chunk) per port.
  - `GET /runs/:id/steps/:nodeId/output?port&offset&limit` (limit at most 100) binary-searches `chunkStarts` and reads one or two chunks.
  - Executors in `item` and `batch` modes receive input chunk by chunk, so worker memory stays bounded. `all` mode receives at most the 16 MB step limit.
  - SDK: `@aws-sdk/client-s3` 3.1149.0 with `forcePathStyle` and checksums `WHEN_REQUIRED`.
  - Local and test server: Garage v2.4.1 (single node, default bucket, digest-pinned image, about 28 MB on scratch). It is AGPL-3.0, but it runs unmodified as a separate service.
- **Rationale**:
  - Step data stays out of PostgreSQL, so the database does not bloat the way n8n's `execution_data` does.
  - Workers stay stateless.
  - Paging reads at most two small objects.
  - Retention deletes by prefix.
- **Alternatives considered**:
  - One object per output with a byte-range index (rejected: objects cannot be appended, and streaming writes need 5 MiB multipart parts).
  - Storage servers:
    - MinIO (rejected: images stopped in 2025 and the repository was archived);
    - RustFS (runner-up; several advisories in 2026);
    - SeaweedFS (rejected: 194 MB image);
    - LocalStack (rejected: needs an auth token since 2026).
  - Inlining small outputs in the database (deferred as an optimisation; it would split the read path).

## R10. Formulas, field references and known fields

- **Decision**: `FormulaEngine` port, adapter `interface-adapters/formulas/` with an own tree-walking interpreter over `acorn` 8.19.0 (`parseExpressionAt`, ESTree with positions).
  - **Allowed syntax**:
    - literals (no regular expressions) and template literals;
    - identifiers restricted to `$json`, `$input`, `$('…')`, `$now`, `$today`, `$run`, `$workflow`, `$execution`, plus allow-listed global helpers;
    - member and optional-chain access to own data properties only (`__proto__`, `constructor` and `prototype` refused, and no function value ever escapes);
    - calls only to allow-listed methods of strings, numbers, arrays, plain objects and Luxon `DateTime` (`luxon` 3.7.2);
    - unary, binary, logical, conditional, array and object expressions.

    Everything else is a parse error reported by the validation report.

  - **Pagination scope**: pagination formulas of the HTTP Request node may also use `$response`, `$pageCount` and `$request` (R23). The engine evaluates them with that scope only, and validation reports these names anywhere else.

  - **Bounds**: a step budget and a deadline of 100 ms checked at every node, caps on allocating methods, no regular expressions built from user strings, and the result measured against 1 MB. Inputs are JSON clones, and `node:vm` and `new Function` are never used.
  - **Field references**: `{ ref: { node: <id>, path } }`, resolved without the interpreter. Formulas address nodes by name, and `WorkflowGraph.renameNode` rewrites `$('old')` using the parser positions.
  - **Known fields**: the shapes of a node's pinned output or latest test-run output (first 20 items, at most 500 paths) are stored in `node_sample` and returned with the draft.
- **Rationale**: The syntax is the n8n one users already know (clarification), while evaluation stays safe and fast in process. NestJS offers no expression evaluator; this custom code fills a stated gap (constitution II).
- **Alternatives considered**:
  - `@n8n/tournament` (rejected: Sustainable Use License, compiles to `new Function`, sandbox escapes in 2026);
  - `expr-eval` (rejected: abandoned, code execution and prototype pollution advisories);
  - `jsonata` (rejected: a different language, critical advisories in 2026);
  - `jexl` and `filtrex` (rejected: unmaintained or code-generating);
  - `jsep` (rejected: no source positions for the rename rewrite);
  - evaluating formulas in the code sandbox (rejected: one sandbox call per item and parameter).

## R11. Code node sandbox

- **Decision**: The Code node runs in go-judge v1.13.2, which has a default seccomp allow-list and restricted socket families since v1.13.0.
  - **Image**: our own image `apps/api/sandbox/Dockerfile`, a single Debian trixie base so glibc matches. It contains:
    - the go-judge static binary;
    - the Node.js 24.21.0 binary, from `node:24.21.0-trixie-slim`;
    - CPython 3.14 slim-trixie (3.13 has been security-only since 2026-10-01), with the standard library precompiled because the sandbox `/usr` is read-only;
    - the libraries at pinned versions: JS `luxon` 3.7.2 and `lodash` 4.18.1; Python `python-dateutil` 2.9.0.post0 and `pendulum` 3.2.0, installed with `--require-hashes --only-binary=:all:`, after confirming the CPython 3.14 wheels exist when the image is built;
    - the harnesses.

    Every base is pinned by digest and scanned by Trivy. Trivy itself and its action are pinned by digest, because of the March 2026 release compromise.

  - **Flags**:
    - `-http-addr=127.0.0.1:5050`, because as PID 1 it would otherwise bind every interface;
    - `-auth-token` from the environment, with logging above info because the token is logged at info;
    - `-src-prefix` pointing at an empty directory;
    - `-mount-conf` with a read-only bind of `/opt/sandbox` and a 16 MB tmpfs;
    - never `-net-share`, so each run gets its own network namespace with no interface up.
  - **Placement**: a sidecar of the worker pod. In Compose it uses `network_mode: service:worker` with `privileged: true`; the reduced set is host cgroup namespace, a `/sys/fs/cgroup` rw mount and seccomp/apparmor `unconfined`. In Kubernetes it is a privileged sidecar in a namespace at the `privileged` Pod Security level, on nodes with user namespaces enabled, and the worker's readiness probe calls `/version`.
  - **Request**: one `POST /run` per node execution. The harness loops over items in per-item mode; all-items mode receives the whole input, and input above the sandbox input limit (8 MB) is a user error.
    - `files[0]` is stdin with `{ items, nodes, run, mode }` as JSON.
    - `files[1]` and `files[2]` are diagnostics collectors (64 KB together).
    - `files[3]` is the `result` collector on fd 3, so the user's `console.log` or `print` can never corrupt the result.
    - Limits: `cpuLimit` 10 s, `clockLimit` 30 s, `memoryLimit` 256 MB (Node also gets `--max-old-space-size` of about 0.75 of it), `procLimit` 32 (it counts threads), and a collector `max` just above the 16 MB output cap.
  - **TypeScript**: transpiled by the worker with `amaro` `transformSync(src, { mode: 'strip-only' })`, the engine Node itself uses. Types become whitespace, so line numbers stay correct. Syntax errors fail before any sandbox call, and the result is cached by source hash. The sandbox only ever runs `node --no-strip-types harness.cjs`.
  - **Harnesses**:
    - **JavaScript** loads `module.exports = async function ($input, $json, $, require) { … }` and offers `$input.all()`, `$input.first()`, `$json`, `$('Node name').all()` and `.first()`, `$now` (Luxon), `$run`, a `require` limited to the preinstalled libraries, and a capped console to stderr.
    - **Python** wraps the parsed body into a function with `ast` (line numbers kept) and runs `python3 -I -S -B -X utf8`. It offers `_input.all()`, `_input.first()`, `_json`, `_('Node name').all()`, `_now`, `_run`, and n8n 2.x's `_items` and `_item` as aliases.
    - Both validate that the result is a list of plain JSON objects. They refuse BigInt, NaN, Infinity and non-string keys; a single object is wrapped, as n8n does. They check the size before writing `{ ok, items }` or `{ ok: false, error: { kind, message, line, itemIndex } }` to fd 3 and exit 0, so a non-zero exit always means a crash.
  - **Status mapping**:
    - `Accepted` → validate the result.
    - User errors, never retried: `Nonzero Exit Status`, `Time Limit Exceeded`, `Memory Limit Exceeded`, `Output Limit Exceeded`, `Dangerous Syscall`, `File Error` (a user-caused copy error), and `Signalled` unless the worker aborted the call (a heap OOM aborts with SIGABRT).
    - Platform errors, retried: `Internal Error`, HTTP 5xx and connection failures.
- **Rationale**: go-judge gives one contract for many languages with per-run namespaces, cgroups and seccomp, as 05-node-types.md decided. Its own overhead is about 1 ms per run, and interpreter start (about 30–70 ms) dominates, so one call per node execution keeps throughput at dozens of Code node executions per second per worker.
- **Alternatives considered**:
  - `isolated-vm` (rejected: maintenance mode, JavaScript only, in process);
  - Deno (rejected: JavaScript and TypeScript only, and its documentation recommends extra layers for untrusted code);
  - gVisor (rejected: no cgroup limits inside the sandbox);
  - Firecracker (deferred: needs KVM on every node);
  - running TypeScript with Node's type stripping inside the sandbox (rejected: 45 ms more per process, and transform mode is still experimental).
- **Risks**: the sidecar is privileged, so a sandbox escape or a kernel advisory compromises the node, and go-judge is a small project. Mitigations: the pinned v1.13.2+, the seccomp allow-list, user namespaces, no network, a read-only root, digest-pinned images scanned on every build, and a CI test that a `connect()` from user code fails.

## R12. HTTP Request node and SSRF protection

- **Decision**: First-party `@nestjs/http-client` 0.0.2 with a dedicated undici `Agent`, from `undici` 7.30.0 because Node 24's fetch rejects undici 8 dispatchers. The Agent is created in `frameworks/undici/outbound-agent.ts` and used only for automations.
  - **Connect guard**: `connect` wraps `buildConnector({ lookup: guardedLookup, timeout: 10_000 })`.
    - IP-literal hosts are classified directly, because Node never calls `lookup` for them; that was a known bypass of `request-filtering-agent`.
    - `guardedLookup` resolves with `all: true` and refuses when any address is not `ipaddr.process(ip).range() === 'unicast'` (`ipaddr.js` 2.5.0). The socket connects only to the checked addresses, so DNS rebinding has no window.
    - Hosts on the operator allow-list `HTTP_ALLOWED_HOSTS` skip the address check.
  - **Redirects**: `redirect: 'manual'`, at most 5 hops. Each hop re-checks scheme and allow-list, applies the 301, 302 and 303 method rules, and drops credentials on an origin change. Every hop goes through the same Agent, so the address check repeats.
  - **Client and Agent settings**:
    - `retry: false`: whole-node retries belong to the node settings, and per-page transient retries to the pagination loop (R23);
    - `maxResponseSize` of 10 MiB, plus a decoded-size counter and a `Content-Length` pre-check;
    - `AbortSignal.timeout(nodeTimeout)` combined with the step signal;
    - no proxies, and TLS verification always on.
  - **Errors**: an address refusal raises `ESSRF`, mapped to `IsolationBreachError` (never retried).
  - **Credentials**: applied by type: a header, `Authorization: Basic`, `Authorization: Bearer` or a query parameter.
- **Rationale**: This is the documented first-party client. The check happens at connect time on every hop and covers IPv6, mapped IPv4 and rebinding (constitution security requirements).
- **Alternatives considered**: `net.BlockList` on the Agent (rejected as the main control: `tls.connect` ignores it on Node 24.21; kept out); `@nestjs/axios` with axios (rejected: superseded, and 2026 advisories bypass the DNS lookup); `request-filtering-agent` and `ssrf-req-filter` (rejected: `http.Agent` only).

## R13. Credentials, webhook secrets and signed addresses

- **Decision**:
  - **`SecretCipher` port**: AES-256-GCM over `node:crypto`. Keys come from `SECRET_KEYS` (`v1:<base64>,v2:<base64>`), and new ciphertexts use `SECRET_KEY_VERSION`. Each ciphertext stores its key version, so keys rotate without re-encryption.
  - **Credentials**: secrets are write-only in the API. `ExecuteNodeStep` decrypts a credential only for the node that references it, after checking that it is owned by the run's acting user (the workflow owner when the run started).
  - **Webhook endpoint secrets**: encrypted with the same port. They are shown to the owner and administrators, and they rotate.
  - **`Signer` port**: HMAC-SHA256 with `SIGNING_KEY`, for the resume addresses.
  - **Pino redaction** gains `*.secret`, `*.password`, `*.token`, `req.headers["x-webhook-token"]` and `req.headers["x-webhook-signature"]`.
  - **Error messages**: produced by executors from codes. They never include request headers, credential values or URLs with query strings.
- **Rationale**: The constitution requires automation credentials to be encrypted at rest, resolved only at execution time and scoped to the owning user.
- **Alternatives considered**: A vault service (deferred: one more stateful component); hashing webhook secrets (rejected: HMAC verification needs the secret).

## R14. Authorization and ownership

- **Decision**: Access is checked at two levels.
  - **Route level** (role):
    - `@Can.Anyone()` for reads;
    - `@Can(WorkflowPolicy, 'author')` for creating and changing workflows and credentials (editor or admin);
    - `@Can(SettingsPolicy, 'manage')` for retention (admin);
    - `@Public()` for webhook and resume ingress.
  - **Object level** (ownership): the command use cases receive the actor and call `WorkflowPolicy.manage(actor, workflow)` or `CredentialPolicy.manage(actor, credential)` on the loaded aggregate. A denial throws `WorkflowAccessDeniedError` or `CredentialAccessDeniedError`, which `DomainErrorFilter` maps to 403.
  - The policies are the same `@Policy()` classes the routes use, injected into the use case factories.
- **Rationale**: `@nestjs/authorization` documents that record checks do not belong in `@Can` resolvers, because they would load the record twice and answer 403 before 404. Calling `AuthorizationService` would put a framework import into the application layer (constitution III). Calling the plain policy class keeps one decision per rule and the layering intact.
- **Alternatives considered**: An `@Can` resolver that loads the workflow (rejected: double load, wrong 403 or 404 order); `AuthorizationService.authorize` in an adapter in front of each use case (rejected: the use case would need a second port for the same decision).

## R15. HTTP contract

- **Decision**: The contract is `contracts/openapi.yaml`, designed for few, coarse calls.
  - **Editor load**: `GET /workflows/{id}` returns the draft, its revision, the validation report, the activation, the latest version and the node samples. `GET /node-types` returns node and credential types with an `ETag`.
  - **Saving**: `PUT /workflows/{id}/draft` with the revision; the response carries the new revision and the report.
  - **Publishing**: `POST /workflows/{id}/versions` with the revision. A stale revision answers 409, and an invalid draft answers 422 with the report.
  - **Runs**:
    - `POST /runs` answers `202 { runId }`;
    - `GET /runs/{id}` answers the status and all steps with an `ETag`; polling every 2 s gets 304 while nothing changed (04-execution.md);
    - lists use cursors (`nextCursor`), and step output uses `offset` and `limit`.
  - **Ingress**: webhook and resume routes are outside the cookie session.
  - **Formats**: parameter values are tagged objects (`{ "fixed": … }`, `{ "ref": … }`, `{ "formula": "…" }`), omitted parameters take defaults, and pinned samples are a separate resource, so autosave never resends them.
  - **Errors**: standard Nest bodies, plus `problems` on 422.
- **Rationale**: The editor needs two calls to open and one to save, and status polling is cheap with conditional requests. These are the "not chatty" and "no garbage" requirements of the clarification.
- **Alternatives considered**: Per-node endpoints (rejected in clarification); server-sent events for run progress (rejected: the architecture chose polling with `ETag`, and SSE needs sticky connections through the BFF).

## R16. Text-format and transform nodes

- **Decision**:
  - HTML: `cheerio` 1.2.0, `load()` only and never `fromURL`, which would bypass the outbound guard.
  - XML: `fast-xml-parser` 5.11.2 with `processEntities: false` and `htmlEntities: false`, and size-capped input.
  - Markdown to HTML: `marked` 18.1.0. HTML to Markdown: `turndown` 7.2.4.
  - Dates: `luxon` 3.7.2. Hashes and random values: `node:crypto`.
  - HTML templates are evaluated by the formula engine with HTML escaping of every substituted value; there is no template engine.

  Pure nodes are unit-tested in `test/unit/node-types`.

- **Rationale**: These libraries are small, active and MIT-licensed, and they are pinned to versions after the 2026 advisories. They are used only in their in-memory modes.
- **Alternatives considered**: Handlebars and Nunjucks (rejected: a second expression language and a history of prototype-access advisories); `xml2js` (rejected: stale); `date-fns` (rejected: a functional API that does not fit method-call formulas); Temporal (not available on Node 24.21).

## R17. Scalability and deployment

- **Decision**:
  - **API**: horizontal, behind the HPA (02-system.md).
  - **Worker**: replicas scaled by KEDA on the engine's due instances. The query reads the engine's internal columns (`wake_at`, `lease_until`, `concurrency_key`), so it is documented as unstable and re-checked whenever the store's `schemaVersion` changes.
  - **Sandbox**: one go-judge sidecar per worker pod, and the worker's step concurrency is bounded by the sandbox's parallelism.
  - **Compose**:
    - `worker`: the API image with `ROLE=worker`, profile `app`;
    - `sandbox`;
    - `objects`: Garage;
    - `httpbin`: `go-httpbin` 2.25.0, the HTTP Request test target on the allow-list.

    All of them have project-specific names, loopback-only ports and named volumes (DR-001).

  - **Grace period**: longer than the worker `shutdownTimeout` (20 s) plus Terminus' 5 s.
- **Rationale**: State lives only in PostgreSQL and object storage, so every process scales by replicas. A crashed worker's runs resume on another replica once the lease expires (30 s).
- **Alternatives considered**: A shared sandbox service (deferred: the sidecar keeps the sandbox on localhost, as 05-node-types.md requires).

## R18. Observability

- **Decision**:
  - OpenTelemetry auto-instrumentation already covers http, express, pg and undici, and adds aws-sdk.
  - Manual spans exist only in `interface-adapters/workflows`, one per node step (`node.execute`), with the attributes `run.id`, `node.id`, `node.type`, `attempt` and `items.out`. They carry no item data and no credential.
  - Pino logs carry the trace identifiers.
  - Metrics are deferred to the observability feature.
- **Rationale**: Constitution VIII: telemetry at the edges, through `OTEL_*` configuration only.
- **Alternatives considered**: Spans in the use cases (rejected by the constitution).

## R19. Retention and maintenance

- **Decision**:
  - **`retention`** (nightly): `ApplyRetention` selects finished runs older than the period or beyond the per-workflow maximum (a window function) in batches of 200. Per batch it deletes the artifacts by prefix, the Step and Run rows, and the engine instances `run-<id>` with `delete(id)`. After the loop it calls `purge({ olderThan })` for trigger and maintenance instances. Past the batch limit it continues in a new instance.
  - **`maintenance`** (every minute): reconciles stale runs (R4) and schedules (R6).
- **Rationale**: `purge` is global and age-only, so the per-workflow maximum needs per-instance deletes.
- **Alternatives considered**: Object storage lifecycle rules (deferred: they would not delete the database rows).

## R20. Test strategy

- **Decision**: The constitution's layer mapping, applied to this feature:

  | Layer                                  | Location                                     | What it covers                                                                                                                                                                                                                                                                                            |
  | -------------------------------------- | -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
  | Domain                                 | `test/unit/domain`                           | Workflow, WorkflowGraph validation (cycles, reachability, rename rewrite), Run state machine, Activation, Credential, WebhookEndpoint and NodeType, with real objects                                                                                                                                     |
  | Use cases                              | `test/unit/application`                      | In-memory fakes of the ports and an inline `StepRunner` fake; covers the `ExecuteRun` traversal, skips, onError and limits                                                                                                                                                                                |
  | Pure node executors and formula engine | `test/unit/node-types`, `test/unit/formulas` | Fixed items in, literal expectations out                                                                                                                                                                                                                                                                  |
  | Integration                            | `test/integration/`                          | Repositories and queries on PostgreSQL; the S3 artifact store on Garage (GenericContainer); the engine gateways on the real PostgreSQL store with `ManualWorkflowClock` and `drain()`; the Code node on the real sandbox container; the HTTP Request node against a local server, including SSRF refusals |
  | Component                              | `test/component/`                            | The whole app in process with the worker drained in process; the sandbox replaced by a fake gateway (an unmanaged dependency), PostgreSQL and Garage real                                                                                                                                                 |
  | End-to-end                             | `test/e2e/`                                  | Journeys against Compose, including killing the worker container in the middle of a run                                                                                                                                                                                                                   |

  The crash test uses two app instances on one database and clock: close the first while a step hangs, advance the clock past the lease, drain the second, and assert that completed nodes did not run again.

- **Rationale**: Constitution VI and docs/architecture testing rules.
- **Alternatives considered**: The engine's in-memory store for component tests (rejected: it cannot join transactions, so atomic run creation would be untested).

## R21. Architecture document corrections

This feature updates `docs/architecture`:

- **01-domain.md**:
  - `WebhookEndpoint` becomes an aggregate, so the address stays stable across activations.
  - Workflow ownership and `NodeSample` are added.
  - `Run` gains `mode` and `depth`.
- **03-api.md**:
  - modules `WorkflowsInfraModule`, `StorageModule` and `OutboundHttpModule`;
  - ports `FormulaEngine`, `Signer`, `NodeSampleRepository` and `WebhookEndpointRepository`;
  - controllers;
  - the `ROLE` bootstrap.
- **04-execution.md**:
  - the projection replaces `events$` (R4);
  - queued rows are inserted with the start;
  - the scheduled trigger workflow (R6);
  - concurrency is keyed by a function of the input (R7);
  - the timeout includes queued time;
  - retry accounting (R5);
  - waits and children through `StepRunner` (R3);
  - the resume signal id per run;
  - status rows replace `setStatus` progress;
  - retention uses `delete(id)`;
  - signals serialise behind a global lock.
- **05-node-types.md**:
  - `execution` and `effects` in the manifest;
  - parameters as zod schemas served as JSON Schema;
  - Python and the shared contract for the Code node (R11);
  - the HTTP Request node, including its declarative pagination and the pagination formula scope (R23).
- **06-security.md**: SSRF controls, credential and webhook secrets, signed resume addresses, and object-level checks.
- **02-system.md**: Garage, the `workflows:migrate` release step, the unstable KEDA query and the pool sizing.

## R22. Dependencies added (exact pins)

| Package               | Version                         | Use                                                   |
| --------------------- | ------------------------------- | ----------------------------------------------------- |
| `@nestjs/workflows`   | 0.0.2                           | Durable execution                                     |
| `@nestjs/http-client` | 0.0.2                           | HTTP Request node                                     |
| `undici`              | 7.30.0                          | Guarded outbound Agent                                |
| `ipaddr.js`           | 2.5.0                           | Address classification                                |
| `@aws-sdk/client-s3`  | 3.1149.0                        | Artifact store                                        |
| `acorn`               | 8.19.0                          | Formula parser                                        |
| `luxon`               | 3.7.2                           | Dates in formulas and the Date & Time node            |
| `cheerio`             | 1.2.0                           | HTML node                                             |
| `fast-xml-parser`     | 5.11.2                          | XML node                                              |
| `marked`              | 18.1.0                          | Markdown node                                         |
| `turndown`            | 7.2.4                           | Markdown node                                         |
| `amaro`               | exact version pinned when added | TypeScript strip-only transpilation for the Code node |
| `testcontainers`      | 12.2.0 (dev)                    | Garage and sandbox containers                         |

Sandbox image: go-judge v1.13.2, Node.js 24.21.0, CPython 3.14, `luxon` 3.7.2, `lodash` 4.18.1, `python-dateutil` 2.9.0.post0, `pendulum` 3.2.0. Compose test target: `mccutchen/go-httpbin` 2.25.0. Object storage: `dxflrs/garage` v2.4.1. All images are pinned by digest.

Every version is re-checked with `pnpm audit` and Trivy when it is added; `minimumReleaseAge` applies.

## R23. HTTP Request pagination

- **Decision**: Declarative pagination in the HTTP Request node (FR-037), with n8n parity plus fixes for its known gaps. The basis is n8n 2.43's `requestWithAuthenticationPaginated` and the `HttpRequestV3` description, read at commit `45938389`.
  - **Parameter shape**: `pagination` is a zod `strictObject` in the node schema, rendered by the web as a form with these fields:
    - `mode`: `off`, `parameters` or `nextLink`;
    - `parameters[]`: each with `in` (`query`, `header` or `body`), `name` (a dot path for `body`), and `value`, one of `{ pageNumber: { start, step } }`, `{ offset: { start, step | 'records' } }`, `{ cursor: { body: path } | { header: name } }` or `{ formula }`;
    - `nextLink`: one of `{ body: path }`, `{ header: name }`, `{ linkHeader: 'next' }` or `{ formula }`;
    - `completeWhen[]`: any of `emptyRecords`, `missingNext`, `{ falseField: path }`, `{ totalField: path }`, `{ statusCodes }` or `{ formula }`;
    - `records`: a path;
    - `output`: `records` or `pages`;
    - `maxPages`: 1–1,000, default 100;
    - `onMaxPages`: `stop` or `fail`;
    - `intervalMs`: 0–60,000.

    Defaults complete on `missingNext` for cursor and next-link modes and on `emptyRecords` otherwise, so the common cases need no formula.

  - **Loop**, in `interface-adapters/node-types/http-request/pagination.ts`, for each input item:
    1. Build request 1 from the configured request and the presets' start values. Cursors and next links are absent on request 1.
    2. Send it through the guarded agent (R12), applying the credential only when the origin equals the original request's origin.
    3. Parse JSON for `application/json` and every `+json` type.
    4. Write the page's records, or the page, to the output writer as it arrives.
    5. Evaluate completion.
    6. Derive the next request, with `$pageCount` incremented after storing and `$request` set to the request just sent, its credential values removed.
    7. Wait `intervalMs`.
  - **Guards**:
    - a set of request signatures (method, URL, query, body hash) catches repeats and cycles and fails with "pagination did not advance";
    - a missing cursor or next link completes pagination instead of falling back to the original request;
    - the page limit is always on;
    - 429, 502, 503, 504 and connection errors are retried per page up to 3 times, with exponential back-off honouring `Retry-After` (capped at 60 s);
    - other errors fail the node, discarding the partial output by abandoning the attempt's chunks (R9).
  - **Durability**: the whole pagination for all items runs inside the node's single step; the node is the checkpoint (FR-020). Items paginate one at a time unless batching is configured, so memory stays bounded by one page plus the chunk writer.
  - **Link header**: parsed by a small RFC 8288 reader, taking the first `rel="next"` target, quoted or unquoted, among several links.
- **Rationale**: Ready-made choices cover the styles the n8n research found most common: page number, offset and limit, cursor in body or header, next URL in body, the RFC 8288 `Link` header, and `hasMore` or total flags. Users can therefore paginate without formulas, which the no-code goal requires. Formulas keep n8n's flexibility for unusual APIs, with the same variable names, so n8n recipes transfer. The guards remove the failure modes n8n users report:
  - restart loops after the last page;
  - non-consecutive cycles;
  - whole-node re-runs for one 429;
  - unreachable nested cursors;
  - unparsed `+json` bodies;
  - memory growth from holding every page.
- **Alternatives considered**:
  - Copying n8n exactly: two modes and expressions only (rejected: every API would need formulas, and the known loops would be kept).
  - Pagination as a separate "Paginate" node or a loop in the graph (rejected: graphs are acyclic, and it splits one request's configuration in two).
  - A checkpoint per page (rejected by the clarification that makes the node the checkpoint; revisit with integration nodes if long paginations prove costly).
  - A third-party Link header parser (rejected: parsing `rel="next"` from RFC 8288 needs a few lines, and the available packages are unmaintained).
