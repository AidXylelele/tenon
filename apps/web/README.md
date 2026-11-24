# web

Tenon's console: a Next.js app whose server reads and writes through the api, so the browser never calls the api. The
workflow editor runs the language server in a Web Worker. `src/` follows the Web Module System: `app/` holds the pages
and layouts, `spaces/` the page modules, then `features/`, `operations/` and `libs/`, each importing only the tiers
below it.

## Scripts

| Script                  | What it does                                                                   |
| ----------------------- | ------------------------------------------------------------------------------ |
| `dev`                   | the dev server on port 3001                                                    |
| `build`, `start`        | the standalone production build, served on `PORT` (default 3001)               |
| `lint`, `check-types`   | ESLint (Next's presets), TypeScript after `next typegen`                       |
| `test`, `test:coverage` | Vitest in jsdom; coverage with a floor per folder (`vitest.config.mts`)        |
| `storybook`             | the Playground of features and libs on port 6006 (`build-storybook` builds it) |
| `test:e2e`              | builds the Playground and runs the Playwright tests in `e2e/` against it       |
| `test:e2e:production`   | builds the console and runs `e2e/production` against it and a stubbed api      |

Install Playwright's browser once with `pnpm exec playwright install chromium --only-shell`. The Playground of the
browser tests is served on `PLAYGROUND_PORT` (default 6007), the stubbed api and the console on the next two ports.

## Configuration

| Variable                | Default   | Meaning                                                             |
| ----------------------- | --------- | ------------------------------------------------------------------- |
| `API_URL`               | required  | the api's address as the console's server reaches it                |
| `SESSION_COOKIE_SECURE` | `true`    | `false` only for plain http on a local machine                      |
| `OTEL_*`                | the SDK's | the OpenTelemetry SDK's own variables, read by `instrumentation.ts` |
