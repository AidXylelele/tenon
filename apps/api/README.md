# api

The Tenon API: a NestJS application that publishes Open Workflow definitions, runs their instances
on a durable engine, and serves the console, the webhooks and the events that start them.

## Run

From the repository root, with Docker and a `.env` copied from `.env.example`:

```sh
docker compose up --wait postgres mailpit go-judge
set -a; . ./.env; set +a
pnpm --filter "api^..." run build
pnpm --filter api migrate
pnpm --filter api dev
```

The API answers on `http://127.0.0.1:3000/api/v1`, with its OpenAPI document at `/api/v1/docs`.

## Test

```sh
pnpm --filter api test
pnpm --filter api exec vitest run --project integration
pnpm --filter api exec vitest run --project e2e
```

The unit tests need nothing else, the integration tests start PostgreSQL and the brokers in Docker,
and the end-to-end tests run against the whole stand, started with `docker compose up --build --wait`.
They read `API_BASE_URL` (default `http://127.0.0.1:53000`), `MAILPIT_URL` (default `http://127.0.0.1:58025`),
`E2E_ADMIN_EMAIL` (the stand's `ADMIN_EMAIL`, default `admin@example.com`) and `E2E_ADMIN_PASSWORD` (the password the
journeys give that administrator). The workflow journey serves its stub at `host.docker.internal`, so the stand's
`OUTBOUND_ALLOW_LIST` must hold the address that name has inside the api container.
