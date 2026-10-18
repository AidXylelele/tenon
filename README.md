# Workflow Platform

Platform for building automations (workflows). pnpm workspaces monorepo with
a strict UI / API split: the apps are fully independent and share no code.

| App                    | Description                                           |
| ---------------------- | ----------------------------------------------------- |
| [`apps/api`](apps/api) | NestJS modular monolith — the application API         |
| [`apps/web`](apps/web) | Next.js UI; its server is a Backend for Frontend only |

## Requirements

- pnpm `12.8.1` (https://pnpm.io/installation); Node.js `24.21.0` is downloaded by pnpm from
  `devEngines.runtime` (see [`.nvmrc`](.nvmrc))
- Docker with Compose v2 for the local stack and the integration tests

## Getting started

```sh
pnpm install
cp .env.example .env      # set POSTGRES_PASSWORD
docker compose up -d      # PostgreSQL (127.0.0.1:55432) and Mailpit (SMTP 51025, UI http://127.0.0.1:58025)
set -a; . ./.env; set +a
pnpm --filter api db:migrate && pnpm --filter api outbox:migrate && pnpm --filter api workflows:migrate
pnpm dev                  # api on :3000, web on :3001
```

The Compose project is named `workflow-platform`; its containers, network and volumes carry that
name and all host ports bind to `127.0.0.1`. `docker compose --profile app up -d --build` adds the
API container on `127.0.0.1:53000`.

## Commands

Root scripts run the task in every app via `pnpm -r`.

| Command            | Description                         |
| ------------------ | ----------------------------------- |
| `pnpm dev`         | Run all apps in watch mode          |
| `pnpm build`       | Build all apps                      |
| `pnpm lint`        | Lint all packages                   |
| `pnpm check-types` | Type check all packages             |
| `pnpm test`        | Unit tests (Vitest)                 |
| `pnpm test:e2e`    | End-to-end tests                    |
| `pnpm format`      | Format the repository with Prettier |

Run a task for a single app with `pnpm --filter api <task>` (or `cd apps/api`).

## Conventions

- **Commits** follow [Conventional Commits](https://www.conventionalcommits.org),
  enforced by commitlint in the `commit-msg` hook, e.g. `feat(api): add workflow module`.
- **Pre-commit**: lint-staged runs ESLint `--fix` and Prettier on staged files.
- **Dependencies** are pinned to exact versions in the root and the API; `pnpm audit` and Trivy
  (lockfile and image) run in CI with zero tolerance for critical and high findings.
- **Apps are self-contained**: each has its own dependencies, `tsconfig`, ESLint
  and test config. Only repo tooling (Prettier, husky, lint-staged, commitlint)
  lives in the root.
- **TypeScript** is pinned to 6.0.x: TypeScript 7 has no stable JS API yet, which
  typescript-eslint and the Nest CLI depend on.
