# api

The Tenon API: a NestJS application that publishes Open Workflow definitions and runs their instances on a durable engine.

One image runs two processes:

- **api** (`frameworks/main.ts`): HTTP for the console, webhooks, events and health; OpenAPI at `/api/v1/docs`.
- **worker** (`frameworks/worker.ts`): no listener; runs the workflows, relays the outbox, keeps the AsyncAPI receivers.

`src/` follows Clean Architecture (R. C. Martin, 2012); a layer imports only the layers inside it:

- `domain/`: aggregates and their rules. `application/`: use cases and their ports.
- `interface-adapters/`: controllers, presenters, repositories, runners and the effect gateways, which translate an effect into a protocol call and its answer back.
- `frameworks/`: the Nest composition root (`di/`), OpenTelemetry and one connection per tool, a thin wrapper around its library.

From the repository root, after `set -a; . ./.env; set +a`:

```sh
docker compose up --wait postgres mailpit go-judge
pnpm --filter "api^..." run build
PGOPTIONS="-c tenon.admin_email=$ADMIN_EMAIL" pnpm --filter api migrate
pnpm --filter api dev
pnpm --filter api dev:worker
pnpm --filter api test
pnpm --filter api exec vitest run --project integration
pnpm --filter api exec vitest run --project e2e
```
