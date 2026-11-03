# web

The workflow platform's console: Next.js 16 (App Router, Turbopack).

- **A Backend for Frontend.** The Next.js server reads the API in Server Components, writes through Server Actions, and holds the session. The browser never calls the API.
- **No rules of its own.** Business rules live in the API; the console shows its answers.
- **Spec.** Design and decisions: [specs/003-web-console](../../specs/003-web-console/plan.md).

## Layout

| Path                     | Tier   | What                                                          |
| ------------------------ | ------ | ------------------------------------------------------------- |
| `src/app`                | entry  | Pages and layouts, each rendering one module                  |
| `src/spaces/shell`       | module | The frames: root, signed-out, console                         |
| `src/spaces/identity`    | module | Sign-in, recovery, account, invitations (feature 001)         |
| `src/spaces/automation`  | module | Workflows, builder, runs, integrations (feature 002)          |
| `src/libs/data-access`   | lib    | The only API client (server-only)                             |
| `src/libs/ui`            | lib    | The design system: shadcn/ui (Radix, nova) and its composites |
| `src/libs/live`          | lib    | Route refresh while something is in flight                    |
| `src/libs/document-text` | lib    | YAML and JSON text with positions; JSON Pointers              |
| `src/libs/routing`       | lib    | Route segments and search parameters                          |

shadcn components are added with `pnpm dlx shadcn@4.23.0 add <name>`; `components.json` points them into `src/libs/ui`.

## Environment

Copy [`.env.example`](.env.example) to `.env.local`:

| Key                     | Meaning                                                                                      |
| ----------------------- | -------------------------------------------------------------------------------------------- |
| `API_URL`               | Where the console's server reaches the API                                                   |
| `SESSION_COOKIE_SECURE` | `false` only for plain http on a local machine; otherwise the cookie is `__Host-` and Secure |

## Scripts

| Command            | Description                                         |
| ------------------ | --------------------------------------------------- |
| `pnpm dev`         | Dev server on port `3001`                           |
| `pnpm build`       | Production build (`output: 'standalone'`)           |
| `pnpm start`       | Serve the production build                          |
| `pnpm test`        | Unit and component tests (Vitest + Testing Library) |
| `pnpm lint`        | ESLint (`eslint-config-next`)                       |
| `pnpm check-types` | Generate route types and type check                 |

The journeys of each story: [quickstart](../../specs/003-web-console/quickstart.md).
