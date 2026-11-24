# api

The Tenon API: a NestJS application that publishes Open Workflow definitions and runs their instances through
transactional outbox messages. One image runs two processes:

- **api** (`src/frameworks/main.ts`): HTTP for the console, webhooks, events and health; OpenAPI at `/api/v1/docs`.
- **worker** (`src/frameworks/worker.ts`): no listener; runs the workflows, relays the outbox, sends mail and keeps the
  AsyncAPI receivers.

`src/` follows Clean Architecture: `domain/` (aggregates and their rules), `application/` (use cases and their ports),
`interface-adapters/` (controllers, presenters, repositories, gateways) and `frameworks/` (the Nest composition root in
`di/`, OpenTelemetry and one connection per tool). A layer imports only the layers inside it.

## Scripts

| Script                        | What it does                                                 |
| ----------------------------- | ------------------------------------------------------------ |
| `build`                       | `nest build` into `dist`                                     |
| `dev`, `dev:worker`           | the api in watch mode; the built worker, restarted on change |
| `start`, `start:worker`       | the built api and worker with OpenTelemetry                  |
| `migrate`                     | the Drizzle migrations in `drizzle/` against `DATABASE_URL`  |
| `lint`, `check-types`, `test` | ESLint, TypeScript, the unit tests                           |

## Configuration

Each variable `X` marked as a secret may also be given as a file in `X_FILE`.

| Variable                                        | Default               | Read by | Meaning                                                  |
| ----------------------------------------------- | --------------------- | ------- | -------------------------------------------------------- |
| `DATABASE_URL` (secret)                         | required              | both    | Postgres connection                                      |
| `DATABASE_POOL_SIZE`, `DATABASE_POOL_MIN`       | `20`, `5`             | both    | the connection pool's bounds                             |
| `SECRETS_KEY` (secret)                          | required              | both    | 32 bytes in base64 that encrypt the stored secrets       |
| `WEB_BASE_URL`, `API_BASE_URL`                  | required              | both    | the console's and the api's public addresses             |
| `OUTBOUND_ALLOW_LIST`                           | empty                 | both    | private addresses and CIDRs outbound calls may reach     |
| `LEGACY_EVENT_TYPES`                            | `false`               | both    | also type lifecycle events `io.serverlessworkflow.*.v1`  |
| `INTERPRETER_RUN_THREADS`                       | one per CPU           | both    | interpreter threads for runs                             |
| `INTERPRETER_CHECK_THREADS`                     | `1`                   | both    | interpreter threads for publish checks                   |
| `LOG_LEVEL`, `NODE_ENV`                         | `info`, `development` | both    | pino's level; `development` prints logs with pino-pretty |
| `PORT`                                          | `3000`                | api     | the HTTP port                                            |
| `TRUSTED_ORIGINS`, `TRUSTED_PROXIES`            | empty                 | api     | origins the CSRF check accepts; Express's `trust proxy`  |
| `SESSION_COOKIE_SECURE`                         | `true`                | api     | `false` only for plain http on a local machine           |
| `OUTBOX_POLL_INTERVAL_MS`, `OUTBOX_CONCURRENCY` | `100`, `32`           | worker  | how often the relay polls and how many keys it handles   |
| `SANDBOX_URL`, `SANDBOX_TOKEN` (secret)         | required              | worker  | the go-judge sandbox that runs scripts                   |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_FROM`           | required              | worker  | the mail server and the sender                           |
| `SMTP_STARTTLS`                                 | `required`            | worker  | `required`, `opportunistic` or `never`                   |
| `SMTP_USER`, `SMTP_PASSWORD` (secret)           | empty                 | worker  | the mail server's credentials                            |
| `OTEL_*`                                        | the SDK's             | both    | the OpenTelemetry SDK's own variables                    |

## Run and test

From the repository root, after `set -a; . ./.env; set +a`:

```sh
docker compose up --wait postgres mailpit go-judge
pnpm --filter "api^..." run build
PGOPTIONS="-c tenon.admin_email=$ADMIN_EMAIL" pnpm --filter api migrate
pnpm --filter api dev
pnpm --filter api dev:worker
```

- `pnpm --filter api test`: unit tests (`test/unit`).
- `pnpm --filter api exec vitest run --project integration`: integration and component tests (`test/integration`,
  `test/component`) against Postgres and brokers in Testcontainers; needs Docker.
- `pnpm --filter api exec vitest run --project e2e`: journeys (`test/e2e`) against a running stand, at `API_BASE_URL`
  (default `http://127.0.0.1:53000`) and `MAILPIT_URL` (default `http://127.0.0.1:58025`). They sign in as
  `E2E_ADMIN_EMAIL` with `E2E_ADMIN_PASSWORD`, setting it through recovery the first time, and serve an endpoint the
  workflow calls through `host.docker.internal`, so the stand's `OUTBOUND_ALLOW_LIST` must hold that host's address
  (the Docker bridge gateway).
