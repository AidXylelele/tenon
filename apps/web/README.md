# web

Tenon's console. A Next.js app whose server reads and writes through the api; the browser never calls the api. The workflow editor runs the language server in a Web Worker.

## Run

It reads `API_URL` and `SESSION_COOKIE_SECURE` from the root `.env` (see the root README); keep `SESSION_COOKIE_SECURE=false` only for plain http on a local machine. Then `pnpm dev` (port 3001). `pnpm build` and `pnpm start` serve the production build.

## Test

`pnpm test`, `pnpm lint` and `pnpm check-types`. `pnpm test:coverage` measures coverage against a floor per folder (`vitest.config.mts`): 75 % for each folder of `operations/` and 85 % for each folder of `features/`, both read from the folder listing, so a new folder is measured without editing the config; the features in `FEATURES_DELETED_IN_M5` and `FEATURES_WAITING_FOR_TESTS` are exempt until they are deleted or tested. Every folder of `libs/` gets its 85 % floor in the slice that touches it.

`pnpm test:e2e` builds the Playground and runs the Playwright smoke tests against it in Playwright's own Chromium. It serves the Playground on port 6007; set `PLAYGROUND_PORT` to another port when several worktrees run the tests at once. Install it once with `pnpm exec playwright install chromium --only-shell`; a CI job that runs these tests needs `pnpm exec playwright install chromium --with-deps --only-shell`.

## Playground

`pnpm storybook` opens the Playground (Storybook) of features and libs on port 6006; `pnpm build-storybook` builds it into `storybook-static`.
