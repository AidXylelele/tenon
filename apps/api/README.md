# api

Workflow platform API: a NestJS modular monolith (ESM, SWC builder) organised in Clean
Architecture layers (`domain`, `application`, `interface-adapters`, `frameworks`; see
[docs/architecture/03-api.md](../../docs/architecture/03-api.md)).

## Scripts

| Command               | Description                                                                                            |
| --------------------- | ------------------------------------------------------------------------------------------------------ |
| `pnpm dev`            | Start in watch mode (port `3000`)                                                                      |
| `pnpm build`          | Build to `dist/` with SWC + type check                                                                 |
| `pnpm start:prod`     | Run the compiled app with the OpenTelemetry preload                                                    |
| `pnpm db:generate`    | Generate a Drizzle migration from the schema                                                           |
| `pnpm db:migrate`     | Apply the Drizzle migrations (`DATABASE_URL`)                                                          |
| `pnpm outbox:migrate` | Apply the `@nestjs/outbox` migrations (`DATABASE_URL`)                                                 |
| `pnpm test`           | Unit tests (`test/unit`), no containers                                                                |
| `pnpm test:int`       | Integration (`test/integration`) and component (`test/component`) tests on a Testcontainers PostgreSQL |
| `pnpm test:e2e`       | End-to-end journeys (`test/e2e`) against the running Compose stack (profile `app`)                     |
| `pnpm test:cov`       | Unit tests with coverage                                                                               |
| `pnpm lint`           | ESLint (type-aware, layer boundaries)                                                                  |
| `pnpm check-types`    | TypeScript type check                                                                                  |

## Local stack

From the repository root (see [`.env.example`](../../.env.example)):

```sh
cp .env.example .env                      # set POSTGRES_PASSWORD
docker compose up -d                      # PostgreSQL 127.0.0.1:55432, Mailpit SMTP 51025 / UI http://127.0.0.1:58025
set -a; . ./.env; set +a
pnpm --filter api db:migrate
pnpm --filter api outbox:migrate
pnpm --filter api dev
```

`docker compose --profile app up -d --build` also runs the API image on `127.0.0.1:53000`.

## Authentication

Sessions, password recovery and invitations are application routes under `/api/v1/auth` and
`/api/v1/invitations` (documented at `/api/v1/docs`), built on `@nestjs/authentication`,
`@nestjs/authorization` and `@nestjs/mail` (SMTP; `SMTP_STARTTLS=opportunistic` for Mailpit). The session is the HttpOnly cookie `sid`; browser
requests from another origin must be listed in `TRUSTED_ORIGINS`. Accounts are created only through
invitations; the migrations seed `admin@example.com`, who sets the first password through recovery.

## Conventions

Generate new modules with the Nest CLI (`pnpm exec nest g resource <name>`) and place the files in
the layer layout. Do not use `nest g app|library` — it converts the project to Nest's own monorepo
mode; the repository is a pnpm workspace.
