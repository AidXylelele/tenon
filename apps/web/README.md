# web

Tenon's console. A Next.js app whose server reads and writes through the api; the browser never calls the api. The workflow editor runs the language server in a Web Worker.

## Run

It reads `API_URL` and `SESSION_COOKIE_SECURE` from the root `.env` (see the root README); keep `SESSION_COOKIE_SECURE=false` only for plain http on a local machine. Then `pnpm dev` (port 3001). `pnpm build` and `pnpm start` serve the production build.

## Test

`pnpm test`, `pnpm lint` and `pnpm check-types`. `pnpm test:coverage` measures coverage against a floor per folder (`vitest.config.mts`): 75 % for each operation, 85 % for the libs that have one.

`pnpm test:e2e` builds the Playground and runs the Playwright smoke tests against it in Playwright's own Chromium. Install it once with `pnpm exec playwright install chromium --only-shell`; on CI, `pnpm exec playwright install chromium --with-deps --only-shell`.

## Playground

`pnpm storybook` opens the Playground (Storybook) of features and libs on port 6006; `pnpm build-storybook` builds it into `storybook-static`.
