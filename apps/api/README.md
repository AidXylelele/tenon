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
- A run whose program this build of the interpreter cannot rebuild is cancelled at its next turn. A release that
  changes the interpreter's state format registers the run workflow under a new version, and has to remove the
  engine runs of the old format with `WorkflowClient.delete(id, { force: true })`, since no worker claims them.

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
