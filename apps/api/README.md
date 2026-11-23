# api

The Tenon API: a NestJS application that publishes Open Workflow definitions, runs their instances
on a durable engine, and serves the console, the webhooks and the events that start them.

## Processes

One image runs two processes, each from its own root module:

- **API** (`dist/frameworks/main.js`, `ApiModule`) serves HTTP: the console's REST API, the webhooks, the events,
  the health checks (`/api/v1/health/live`, `/api/v1/health/ready`) and the OpenAPI document. It starts, signals and
  reads workflows and writes the outbox, but runs no workflow and relays no message; its only scheduled job prunes
  the expired idempotency keys.
- **Worker** (`dist/frameworks/worker.js`, `WorkerModule`) is a standalone application with no network listener.
  It runs the workflows, relays the outbox (mail, event dispatch, subscriptions), keeps the AsyncAPI receivers and
  purges the finished workflow instances and the outbox inbox.

Each process validates only the variables its modules read: the API needs no `SMTP_*` or `SANDBOX_*`.
The health checks report the API process itself and check no other system.

The first administrator is a data seed of the migrations: on a database without an administrator, the
`first_administrator` migration adds one with the address in the `tenon.admin_email` setting, which the `migrate`
service passes from `ADMIN_EMAIL` through `PGOPTIONS`.

### Scaling the workers

Workers scale horizontally: `WORKER_REPLICAS` in `.env` sets how many compose starts
(`docker compose up --wait --scale worker=4` changes it at once). Replicas share the work through the database:
instances and outbox messages are leased with `FOR UPDATE SKIP LOCKED`, each scheduled job runs on one worker per
tick (`@OnOneInstance`), and each AsyncAPI receiver is held by one worker under a lock with a fencing token.

### Known limits

- PostgreSQL connections: the API's pool plus `WORKER_REPLICAS` times the worker's pool
  (`API_DATABASE_POOL_SIZE`, `WORKER_DATABASE_POOL_SIZE`) must stay within `max_connections` less a reserve for
  migrations and administration.
- A workflow the API starts reaches a worker at the worker's next poll, within its poll interval (100 ms), and a
  message the API writes to the outbox reaches the relay at its next poll (1 s).
- The AsyncAPI receivers spread over the workers by whoever takes a receiver's lock first, not evenly.
- The API stays at one replica until the rate limiter's storage is shared between replicas.
- A worker has no health check: a worker that hangs without exiting is restarted only when it dies, and its leases
  move to the other workers then.
- A run whose program this build of the interpreter cannot rebuild is cancelled at its next turn.
- Effects are at-least-once: a worker that dies after its request reached the server but before the step's result
  is journaled repeats the effect with the same `Idempotency-Key`, and receivers deduplicate by it.
- After a worker crashes, its instances are taken over by another worker when their lease expires (120 s).
- A broker publish that timed out may still be delivered after the SDK reconnects: the MQTT and NATS clients buffer
  the publishes made while offline.
- Telemetry from a run of the sources needs `start` or `start:worker`: the `dev` scripts do not preload the
  instrumentation.
- A run belongs to a period by its start: a run cancelled or failed before it began has no start time and is in no
  period's counts and in no list filtered by a start window.
- The runs list counts its total up to 10,000 and says when there are more (`exact: false`); a page starting beyond
  the first 10,000 runs is a bad request. Counts with their previous period and failing workflows span at most 92
  days. Counts, failing workflows and the order by duration read every run of the window: at 1,000,000 runs they stay
  under 50 ms for a day, and take about 0.1 s for a week and 0.4 s for 30 days with the previous period.
- Missed starts are counted from the moment a workflow's schedule was turned on; after a change of the schedule's
  timing the occurrences of the earlier timing in the window are counted against the new one.

## Structure

`src/` follows Clean Architecture (R. C. Martin, 2012): a layer imports only the layers inside it — `frameworks` →
`interface-adapters` → `application` → `domain` — and each layer groups its folders one way.

```
src/
├── domain/                     business rules, free of frameworks: aggregates, value objects, their enums and props
│   ├── automation/             the Open Workflow context, one folder per aggregate
│   │   ├── drafts/             Draft — a workflow's editable text before it is published
│   │   ├── instances/          WorkflowInstance and its Run — one execution's lifecycle and journal
│   │   ├── secrets/            Secret, SecretValue and the RunSecrets a run sees
│   │   ├── subscriptions/      Subscription — where accepted events are delivered
│   │   ├── webhooks/           Webhook and its WebhookToken
│   │   ├── workflows/          Workflow, WorkflowVersion, WorkflowName, CheckedDefinition
│   │   └── interfaces.ts       the JSON values the context's aggregates hold
│   ├── identity/               accounts/, invitations/, users/ — Account, Invitation and its token, User
│   ├── interfaces.ts           Result — the success or refusal of every domain decision
│   └── stale-write.error.ts    StaleWriteError — a save over a revision that changed meanwhile
├── application/                use cases (one class, `execute`), the ports they need, the query ports adapters answer
│   ├── automation/             one folder per business concept: the aggregates above and the concepts without one
│   │   ├── drafts/ instances/ secrets/ subscriptions/ webhooks/ workflows/   the use cases of each aggregate
│   │   ├── events/             accepting, dispatching and emitting CloudEvents; the event store
│   │   ├── schedules/          a schedule's occurrences and the starts on events
│   │   ├── imports/            fetching a document a definition imports
│   │   ├── host/               the host's capabilities, process platform and limits the console reads
│   │   └── enums.ts            Missing — what a use case of the context did not find
│   └── identity/               accounts/, invitations/, users/ (with Person, the name a view shows); Missing in enums.ts
├── interface-adapters/         marry a framework to the application and map both ways; one folder per mechanism or store
│   ├── api/                    the HTTP API
│   │   ├── controllers/        routes: validate, call a use case or a query, present
│   │   ├── schemas/            zod request and response schemas, also read by the OpenAPI document
│   │   ├── presenters/         response bodies and problem details from application results
│   │   ├── mappers/            HTTP values to application values: entity tags, webhook calls, subscription endpoints
│   │   ├── auth/               what @nestjs/authentication and @nestjs/authorization call: policies, the session
│   │   │                       provider, the password-recovery handler, the sessions gateway
│   │   └── pipeline/           around the routes: JSON-only middleware, throttler guard, stale-draft interceptor and
│   │                           its conditional-request exception, problem-details filter, CloudEvent decorator
│   ├── messaging/              outbox handlers, the AsyncAPI receivers' handler, event delivery to subscribers, the
│   │                           outbox topics and tracer, the contracts it needs from broker and delivery clients
│   ├── mailing/                the mail gateway, its outbox handler, its topics and templates/
│   ├── workflows/              the durable engine and the interpreter
│   │   ├── runners/            the engine's @Workflow classes (run, process, schedule, delivery) and the run tracer
│   │   ├── gateways/           application ports over the engine (engine-*), the interpreter (interpreter-*) and
│   │   │                       outbound HTTP (http-import)
│   │   ├── mappers/            domain values ↔ the interpreter's protocol, definitions and run turns
│   │   ├── run.controller.ts   the runners' way into the use cases
│   │   ├── program-calls.ts    a version's program call, its source fetched on demand
│   │   ├── *.error.ts          PermanentFault (a failure no retry mends) and IncompatibleRun
│   │   └── interfaces.ts       the contracts this group needs from framework clients, and their types
│   ├── jobs/                   scheduled jobs (idempotency pruning, retention) and their tracer
│   └── persistence/            PostgreSQL through Drizzle
│       ├── schema/             the Drizzle tables, source of the migrations in drizzle/
│       ├── repositories/       one per aggregate: load and save (upsert, optimistic lock)
│       ├── queries/            the read models the query ports ask for
│       ├── stores/             records outside aggregates and the stores the Nest libraries register
│       └── mappers/            rows ↔ domain objects
└── frameworks/                 one folder per tool, plus the processes and the composition root
    ├── main.ts, worker.ts      the two processes' entries
    ├── instrumentation.ts      the --import preload that starts OpenTelemetry first
    ├── release.ts              the build's version, read from package.json
    ├── di/                     the roots (api, worker), core and shared modules, feature modules (*-http in the API,
    │                           *-background in the worker), the interpreter thread's module, configuration, host presets
    ├── http-client/            outbound HTTP: the effect client, OpenAPI operations, authentication and OAuth tokens,
    │                           address policy, size limit, transport failures, response content, event delivery
    ├── grpc/, mcp/, a2a/       one client per effect protocol
    ├── asyncapi/               AsyncAPI documents, the client, one broker per protocol, broker connections and tracer
    ├── go-judge/               the sandbox client for script and shell processes, its limits, the image's shell platform
    ├── interpreter/            the interpreter on Piscina threads (client, tasks, thread entry), the host profile, the
    │                           effect performer
    ├── crypto/                 AES-GCM sealing of secret values
    └── opentelemetry/          the process and thread SDKs, the engine, outbox and lock metrics, the instrumentation
                                scope, the request path traces and logs redact, the shutdown
```

Each kind of file has one suffix: `*.controller.ts`, `*.presenter.ts`, `*.schema.ts`, `*.mapper.ts`, `*.policy.ts`,
`*.gateway.ts`, `*.handler.ts`, `*.run.ts`, `*.jobs.ts`, `*.tracer.ts`, `*.repository.ts`, `*.queries.ts`, `*.store.ts`,
`*.client.ts`, `*.broker.ts`, `*.metrics.ts`, `*.mail.ts`, `*.error.ts`, `*.module.ts`, `*.presets.ts`, `*.sdk.ts`,
`*.shutdown.ts`, `*.cipher.ts`, `*.tasks.ts`, `*.thread.ts`, and Nest's own `*.middleware.ts`, `*.guard.ts`,
`*.interceptor.ts`, `*.filter.ts`, `*.decorator.ts`, `*.provider.ts`. A use case is named for its action
(`publish-draft.ts`), an aggregate or value object for itself (`workflow.ts`). Each folder keeps its types in
`interfaces.ts` and its enums in `enums.ts`; an application folder keeps its ports in `ports.ts` and its query ports in
`queries.ts`.

`test/` mirrors `src/`: `unit/` and `integration/` by `<layer>/<group>/…` (integration against PostgreSQL, the brokers
and stub servers in Docker); `component/` the composed `ApiModule` with the worker's background modules, by context
(`identity/`, `automation/`), with the specs of the whole composition at its root; `e2e/` journeys against the whole
stand (its `support/` imports nothing from `src`); `support/` the builders, fakes, harnesses and setup.

## Observability

Both processes start the OpenTelemetry `NodeSDK` from `--import ./dist/frameworks/instrumentation.js` and send
traces, metrics and logs only by OTLP to `OTEL_EXPORTER_OTLP_ENDPOINT`; the SDK reads every other setting from
the standard `OTEL_*` variables. The main thread loads the Node auto-instrumentations without the NestJS, router, DNS
and net ones; each interpreter thread starts its own SDK with only the runtime metrics, under its own
`service.instance.id`. The SDK shuts down last, after every other module has stopped.

- **Traces.** HTTP server spans carry `http.route`; a hook call shows `/api/v1/hooks/:token` as its `url.path`, and
  the health checks are not traced. Each engine execution is a root span `execute <workflow>` (consumer) with
  `tenon.workflow` and, for a run, `tenon.instance.id` and `tenon.workflow.generation`; each real step attempt is a
  span `step <kind>` inside it with `tenon.step.kind` and `tenon.step.attempt`, and an effect's step span names its
  `tenon.effect.kind`. The engine's journal writes are the PostgreSQL spans beside the step spans. A replay opens no
  span. An outbox message is processed in a root span `process <topic>` (consumer) linked to the span that added it,
  and a scheduled job's run is a span `job <name>`. A query outside any span, such as a poll, is not traced.
- **Metrics.** `tenon.workflow.executions`, `tenon.workflow.step.duration`, `tenon.workflow.compensation.failures`,
  `tenon.effect.duration`, `tenon.outbox.publish.duration`, `tenon.outbox.lag`, `tenon.outbox.failures` and
  `tenon.lock.losses`, beside the runtime, HTTP, database and interpreter metrics.
- **Logs.** Every pino record goes to stdout and by OTLP, with `trace_id` and `span_id`. A request is logged by its
  id, method, path (without the query, a hook by its route) and remote address, and its response by its status code.

Limits: a step attempt that fails carries no duration in the engine's events, so `tenon.workflow.step.duration` holds
the completed attempts and the failed ones show as error spans. An interpreter thread that is terminated, by a
cancelled task or a closing pool, loses the spans of its last batch (up to `OTEL_BSP_SCHEDULE_DELAY`, 5 s by
default) and the metric points since its last export (`OTEL_METRIC_EXPORT_INTERVAL`), since no hook runs before it
ends.

## Run

From the repository root, with Docker and a `.env` copied from `.env.example`, start the services and migrate:

```sh
docker compose up --wait postgres mailpit go-judge
set -a; . ./.env; set +a
pnpm --filter "api^..." run build
PGOPTIONS="-c tenon.admin_email=$ADMIN_EMAIL" pnpm --filter api migrate
```

Then run the API in one shell and the worker in another, each after `set -a; . ./.env; set +a`:

```sh
pnpm --filter api dev
```

```sh
pnpm --filter api dev:worker
```

`dev` compiles the sources into `dist` on every change and restarts the API; `dev:worker` runs the worker from that
`dist` and restarts it when the compiled files change, so one compiler serves both. `start` and `start:worker` run
the built processes; the repository's `pnpm dev` and `pnpm start` run both.

The API answers on `http://127.0.0.1:3000/api/v1`, with its OpenAPI document at `/api/v1/docs`.

## Test

```sh
pnpm --filter api test
pnpm --filter api exec vitest run --project integration
pnpm --filter api exec vitest run --project e2e
```

The unit tests need nothing else, the integration tests start PostgreSQL and the brokers in Docker,
and the end-to-end tests run against the whole stand, started with `docker compose up --build --wait`.
The component tests compose `ApiModule` with the worker's background modules, with the engine's worker and the outbox
relay off, and drive them by hand. The end-to-end tests read `API_BASE_URL` (default `http://127.0.0.1:53000`),
`MAILPIT_URL` (default `http://127.0.0.1:58025`), `E2E_ADMIN_EMAIL` (the stand's `ADMIN_EMAIL`, default
`admin@example.com`) and `E2E_ADMIN_PASSWORD` (the password the journeys give that administrator). The workflow
journey serves its stub at `host.docker.internal`, so the stand's `OUTBOUND_ALLOW_LIST` must hold the address that
name has inside the api and worker containers.
