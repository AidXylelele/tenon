# Workflow Platform

Platform for building automations (workflows). pnpm workspaces monorepo with
a strict UI / API split: the apps are fully independent and share no code.

| App                    | Description                                           |
| ---------------------- | ----------------------------------------------------- |
| [`apps/api`](apps/api) | NestJS modular monolith — the application API         |
| [`apps/web`](apps/web) | Next.js UI; its server is a Backend for Frontend only |

## Requirements

- Node.js `>=24.15` (see [`.nvmrc`](.nvmrc))
- pnpm `12.8.1` — enable with `corepack enable pnpm`

## Getting started

```sh
nvm use
corepack enable pnpm
pnpm install
pnpm dev        # api on :3000, web on :3001
```

## Commands

Root scripts run the task in every app via `pnpm -r`.

| Command            | Description                         |
| ------------------ | ----------------------------------- |
| `pnpm dev`         | Run all apps in watch mode          |
| `pnpm build`       | Build all apps                      |
| `pnpm lint`        | Lint all packages                   |
| `pnpm check-types` | Type check all packages             |
| `pnpm test`        | Unit tests (Vitest)                 |
| `pnpm test:e2e`    | E2E tests                           |
| `pnpm format`      | Format the repository with Prettier |

Run a task for a single app with `pnpm --filter api <task>` (or `cd apps/api`).

## Conventions

- **Commits** follow [Conventional Commits](https://www.conventionalcommits.org),
  enforced by commitlint in the `commit-msg` hook, e.g. `feat(api): add workflow module`.
- **Pre-commit**: lint-staged runs ESLint `--fix` and Prettier on staged files.
- **Apps are self-contained**: each has its own dependencies, `tsconfig`, ESLint
  and test config. Only repo tooling (Prettier, husky, lint-staged, commitlint)
  lives in the root.
- **TypeScript** is pinned to 6.0.x: TypeScript 7 has no stable JS API yet, which
  typescript-eslint and the Nest CLI depend on.
