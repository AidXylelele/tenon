# Tenon

Tenon is a workflow platform for the Open Workflow standard (DSL 1.1.0): a workflow is a YAML document, checked
like a program before it is published, and started by hand, through the API, on a schedule (`every`, `cron`, `after`),
by an event or by a webhook. Its interpreter runs a workflow one step at a time, and the API keeps every run durable
across restarts.

## Layout

| Path                                                   | What it is                                                     |
| ------------------------------------------------------ | -------------------------------------------------------------- |
| [`apps/api`](apps/api)                                 | NestJS API: accounts, workflows, triggers and runs             |
| [`apps/web`](apps/web)                                 | Next.js console; its server is a Backend for Frontend          |
| [`packages/interpreter`](packages/interpreter)         | The Open Workflow interpreter: compiles a document, runs steps |
| [`packages/language-server`](packages/language-server) | The workflow language server of the editor, in a web worker    |

## Install

pnpm `12.8.1` (it downloads Node.js `26.13.1`), then:

```sh
pnpm install
```

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
`http://localhost:58025`, and the traces and metrics of both apps with the api's logs at `http://localhost:58888`. The
api creates the first administrator at `ADMIN_EMAIL` with no password: set one through password recovery, whose mail
arrives in Mailpit.
`docker compose down` stops the stand; `--volumes` also deletes its data.

The migrations run as the database owner `tenon`; the api connects as `tenon_app`, which may only read and write data.
A database created before that role existed gets it only when created again (`docker compose down --volumes`).

In production the console goes behind a proxy that appends `X-Forwarded-For`; the API trusts only the console's address.

## Develop

```sh
set -a; . ./.env; set +a
pnpm build
pnpm dev
```

`pnpm dev` rebuilds the packages on change and runs the API and the console, both with the root `.env`.

## Test

```sh
pnpm build
pnpm lint
pnpm check-types
pnpm test
pnpm format:check
```

The pre-commit hook formats and lints the staged files and runs the tests they touch. The api's integration tests
need Docker: `pnpm --filter api exec vitest run --project integration`.
