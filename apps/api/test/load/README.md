# Load tests (Grafana k6)

k6 scripts that measure the API under load: publishing, start-to-completion of instances,
reads while instances run, and a soak. They talk to a running API over HTTP; nothing here is
part of the vitest suites.

| File              | What it does                                                                                                                    |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `publish.js`      | Scenario 1: publish throughput and latency for documents of 10, 100, 500 `set` tasks, then refused documents (422)              |
| `runs.js`         | Scenario 2: start an instance, poll `GET /instances/{id}` until it ends, repeat (`WORKFLOW=set`, `for` or `http`; `VUS`)        |
| `reads.js`        | Scenario 3: list, detail and tasks reads alone, then while `set` and 1000-item `for` instances run                              |
| `soak.js`         | Scenario 4: five minutes of mixed runs, reads and publishes; error rate and latency per minute                                  |
| `lib/common.js`   | Sign-in, headers, the workflow documents, start and poll helpers, the summary table                                             |
| `stub-server.mjs` | Local HTTP service the HTTP-call workflow calls (`?delay=<ms>` slows an answer)                                                 |
| `seed-editor.mjs` | Creates the editor the scripts sign in as (password hashed with the app's `PasswordHasher`)                                     |
| `measure.sh`      | Wraps a k6 run: PostgreSQL commits and rows (`pg_stat_database`), PostgreSQL and API CPU, top statements (`pg_stat_statements`) |

## 1. Stack

PostgreSQL from `compose.yaml` (needs a root `.env` with `POSTGRES_USER`, `POSTGRES_PASSWORD`,
`POSTGRES_DB`; never commit it), or a throwaway container that also loads `pg_stat_statements`:

```sh
docker run -d --name workflow-platform-load-postgres -p 127.0.0.1:55440:5432 \
  -e POSTGRES_USER=workflow -e POSTGRES_PASSWORD=workflow-load -e POSTGRES_DB=workflow \
  postgres:18.6-alpine3.24 -c shared_preload_libraries=pg_stat_statements -c max_connections=200
docker exec workflow-platform-load-postgres psql -U workflow -d workflow -c 'create extension pg_stat_statements'
```

From `apps/api`, with `DATABASE_URL=postgres://workflow:workflow-load@127.0.0.1:55440/workflow`:

```sh
pnpm run build
pnpm run db:migrate && pnpm run engine:migrate && pnpm run outbox:migrate
pnpm exec node test/load/seed-editor.mjs            # load-editor@example.com / load-test-password-123
node test/load/stub-server.mjs 18080 &               # the HTTP-call workflow's service
```

Start the API with the variables of `test/support/setup-env.ts`, except:

```sh
NODE_ENV=production PORT=3000 DATABASE_URL=... ENGINE_WORKER=on OUTBOX_RELAY=on \
OUTBOUND_ALLOW_LIST=127.0.0.1/32 LOG_LEVEL=info OTEL_SDK_DISABLED=true \
pnpm exec node --import ./dist/instrumentation.js dist/main.js > /tmp/api.log 2>&1 &
```

(`SMTP_FROM` contains `<` and `>`: quote it when a shell reads the variables.) go-judge and
mailpit are not needed: no scenario runs a script or sends mail.

## 2. Run

Every script reads `BASE_URL` (default `http://127.0.0.1:3000`), `ORIGIN` (a `TRUSTED_ORIGINS`
entry, default `http://127.0.0.1:3001`), `EDITOR_EMAIL`, `EDITOR_PASSWORD`, `STUB_URL`, and
`SUMMARY_JSON` (a file for the full k6 summary). Each run publishes into its own namespace
`load-<RUN_ID>`.

```sh
k6 run -e VUS=10 -e PHASE_SECONDS=30 test/load/publish.js
for w in set http for; do for v in 1 10 50; do
  k6 run -e WORKFLOW=$w -e VUS=$v -e DURATION=60 test/load/runs.js; done; done
k6 run -e READ_RATE=20 -e WRITE_RATE=5 -e LOOP_RATE=0.1 test/load/reads.js
k6 run -e SOAK_SECONDS=300 -e RUN_RATE=14 -e READ_RATE=10 test/load/soak.js
```

`runs.js` also takes `POLL_MS` (100, or 500 for `for`), `TIMEOUT_MS` and `ITEMS` (1000).
Its metrics: `run_server_ms` = `endedAt - createdAt`, `run_queue_ms` = `startedAt - createdAt`
(the wait for one of the engine's 10 slots), `run_e2e_ms` as the client saw it (poll
granularity included), and `runs_per_second` from the instances themselves (first `createdAt`
to last `endedAt`, read back in teardown).

To see what PostgreSQL and the API did during a run, wrap it:

```sh
PG_CONTAINER=workflow-platform-load-postgres API_PID=$(lsof -tiTCP:3000 -sTCP:LISTEN) \
  test/load/measure.sh k6 run -e WORKFLOW=set -e VUS=10 test/load/runs.js
```

## 3. Clean up

```sh
kill %1 %2                                   # API and stub
docker rm -f workflow-platform-load-postgres # the throwaway database and its data
```
