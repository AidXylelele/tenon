# web

Workflow platform UI: Next.js (App Router, Turbopack). The Next.js server is
used strictly as a Backend for Frontend — it aggregates and reshapes data from
`api` for rendering; business logic lives in the API.

## Scripts

| Command            | Description                                     |
| ------------------ | ----------------------------------------------- |
| `pnpm dev`         | Dev server on port `3001`                       |
| `pnpm build`       | Production build (`output: 'standalone'`)       |
| `pnpm start`       | Serve the production build                      |
| `pnpm test`        | Unit/component tests (Vitest + Testing Library) |
| `pnpm lint`        | ESLint (`eslint-config-next`)                   |
| `pnpm check-types` | Generate route types and type check             |
