# api

Workflow platform API: a NestJS modular monolith (ESM, SWC builder).

## Scripts

| Command            | Description                            |
| ------------------ | -------------------------------------- |
| `pnpm dev`         | Start in watch mode (port `3000`)      |
| `pnpm build`       | Build to `dist/` with SWC + type check |
| `pnpm start:prod`  | Run the compiled app                   |
| `pnpm test`        | Unit tests (`src/**/*.spec.ts`)        |
| `pnpm test:e2e`    | E2E tests (`test/**/*.e2e-spec.ts`)    |
| `pnpm test:cov`    | Unit tests with coverage               |
| `pnpm lint`        | ESLint (type-aware)                    |
| `pnpm check-types` | TypeScript type check                  |

Generate new modules with the Nest CLI (`pnpm exec nest g resource <name>`).
Do not use `nest g app|library` — it converts the project to Nest's own
monorepo mode; the repository is a pnpm workspace.
