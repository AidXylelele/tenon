# Tenon

Tenon is a workflow platform for the Open Workflow standard (DSL 1.1.0). A YAML workflow is checked like a program
before it is published, started by hand, through the API, on a schedule, by an event or by a webhook, and run one step
at a time, durably across restarts.

## Layout

| Path                                                   | What it is                                                  |
| ------------------------------------------------------ | ----------------------------------------------------------- |
| [`apps/api`](apps/api)                                 | NestJS API and worker: accounts, workflows, triggers, runs  |
| [`apps/web`](apps/web)                                 | Next.js console; its server is a Backend for Frontend       |
| [`packages/interpreter`](packages/interpreter)         | The Open Workflow interpreter: compiles a document, runs it |
| [`packages/language-server`](packages/language-server) | The workflow language server of the editor, in a web worker |
| `docker`                                               | Images and configuration of the stand's services            |

## Requirements

- pnpm `12.8.1`; it downloads Node.js `26.13.1` (`devEngines` in `package.json`).
- Docker with Compose v2 for the stand and for the api's integration tests (Testcontainers).

```sh
pnpm install
```

## Run with Docker Compose

Copy `.env.example` to `.env`, write the secrets once, then start the stand:

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

| Service | Address                         |
| ------- | ------------------------------- |
| Console | `http://localhost:3001`         |
| API     | `http://localhost:53000/api/v1` |
| Mailpit | `http://localhost:58025`        |
| Grafana | `http://localhost:58888`        |

The `migrate` service runs the migrations as the owner `tenon` and creates the first administrator at `ADMIN_EMAIL`
with no password: set it through password recovery, whose mail arrives in Mailpit. The api and the worker connect as
`tenon_app`, which only reads and writes data. `docker compose down` stops the stand; `--volumes` also deletes its data.

`compose.yaml` includes `compose.observability.yaml`: the api, the worker and the console send traces, metrics and logs
over OTLP to the OpenTelemetry Collector, which forwards them to Tempo, Mimir and Loki; Grafana opens on the Tenon
dashboards.

## Run locally

Start the stand's backing services and run the apps from source; `.env` holds the addresses for this:

```sh
set -a; . ./.env; set +a
docker compose up --wait postgres mailpit go-judge
pnpm build
PGOPTIONS="-c tenon.admin_email=$ADMIN_EMAIL" pnpm --filter api migrate
pnpm dev
```

`pnpm dev` runs the api on port 3000, the worker, the console on port 3001 and the packages' compilers in watch mode.

## Test

```sh
pnpm build
pnpm lint
pnpm check-types
pnpm test
pnpm format:check
```

`pnpm test` runs the unit tests of every package. The api's integration and end-to-end tests and the console's browser
tests are described in their READMEs. The pre-commit hook formats, lints and tests the staged files; commit messages
follow Conventional Commits.
