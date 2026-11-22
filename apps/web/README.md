# web

Tenon's console. A Next.js app whose server reads and writes through the api; the browser never calls the api. The workflow editor runs the language server in a Web Worker.

## Run

It reads `API_URL` and `SESSION_COOKIE_SECURE` from the root `.env` (see the root README); keep `SESSION_COOKIE_SECURE=false` only for plain http on a local machine. Then `pnpm dev` (port 3001). `pnpm build` and `pnpm start` serve the production build.

## Test

`pnpm test`, `pnpm lint` and `pnpm check-types`.
