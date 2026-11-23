# Tenon

Tenon is a workflow platform for the Open Workflow standard (DSL 1.1.0): a YAML workflow is checked like a program
before it is published, started by hand, through the API, on a schedule, by an event or by a webhook, and run one step
at a time, durably across restarts.

## Layout

| Path                                                   | What it is                                                     |
| ------------------------------------------------------ | -------------------------------------------------------------- |
| [`apps/api`](apps/api)                                 | NestJS API: accounts, workflows, triggers and runs             |
| [`apps/web`](apps/web)                                 | Next.js console; its server is a Backend for Frontend          |
| [`packages/interpreter`](packages/interpreter)         | The Open Workflow interpreter: compiles a document, runs steps |
| [`packages/language-server`](packages/language-server) | The workflow language server of the editor, in a web worker    |

## Install

pnpm `12.8.1` (it downloads Node.js `26.13.1`), then `pnpm install`.

## Run the stand

Docker with Compose v2. Copy `.env.example` to `.env`, write the secrets once, then start the stand:

```sh
cd docker/secrets
openssl rand -hex 32 > postgres-password
openssl rand -base64 32 > secrets-key
openssl rand -hex 32 > sandbox-token
printf 'postgres://tenon:%s@postgres:5432/tenon' "$(cat postgres-password)" > database-url
printf 'postgres://tenon_app:%s@postgres:5432/tenon' "$(openssl rand -hex 32)" > api-database-url
cd ../..
docker compose up --build --wait
```

The console answers at `http://localhost:3001`, the API at `http://localhost:53000/api/v1`, Mailpit at
`http://localhost:58025` and Grafana at `http://localhost:58888`. The `migrate` service runs as the owner `tenon` and
creates the first administrator at `ADMIN_EMAIL` with no password (set it through password recovery, in Mailpit); the
api connects as `tenon_app`, which only reads and writes data. `docker compose down` stops the stand, `--volumes` also
deletes its data. In production the console goes behind a proxy that appends `X-Forwarded-For`. The api
scales horizontally; request rate limits belong to the infrastructure gateway in front of it (such as Envoy).

## Observability

`compose.yaml` includes `compose.observability.yaml` (`docker compose up --wait otel-collector grafana` starts it alone).
The api, the worker and the console send their telemetry over OTLP to the OpenTelemetry Collector, which derives span
metrics and forwards to Tempo, Mimir and Loki (traces and logs kept 72 hours, metrics 7 days). Grafana opens on the
Tenon dashboards without sign-in on `127.0.0.1`.

## Develop

```sh
set -a; . ./.env; set +a && pnpm build && pnpm dev
```

## Test

```sh
pnpm build && pnpm lint && pnpm check-types && pnpm test && pnpm format:check
```

The pre-commit hook formats, lints and tests the staged files; the api's own tests are in [`apps/api`](apps/api).
