# Quickstart: Workflow Builder and Core Nodes

Validation guide for the feature. Contract: [contracts/openapi.yaml](contracts/openapi.yaml). Data and
engine instances: [data-model.md](data-model.md). Decisions: [research.md](research.md).

## Prerequisites

- The prerequisites of [001 quickstart](../001-api-authentication/quickstart.md): Docker with Compose v2, pnpm 12.8.1, and Node.js 24.21.0 installed by pnpm.
- A Docker host that allows privileged containers and user namespaces for the sandbox. Docker Desktop and Linux with cgroup v2 do.
- `jq` for the examples below.

## Local stack

```bash
cp .env.example .env    # adds:
                        #   ROLE, WORKER_CONCURRENCY, RUN_CONCURRENCY_PER_WORKFLOW,
                        #   S3_* (Garage), SANDBOX_URL, SANDBOX_TOKEN,
                        #   SECRET_KEYS, SECRET_KEY_VERSION, SIGNING_KEY, HTTP_ALLOWED_HOSTS=httpbin
docker compose up -d --wait    # postgres, mailpit, objects (Garage S3 on 127.0.0.1:53900)
pnpm install --frozen-lockfile
set -a; . ./.env; set +a
pnpm --filter api db:migrate          # automation tables and the retention_settings seed
pnpm --filter api outbox:migrate
pnpm --filter api workflows:migrate   # nest-workflows migrate (schema nest_workflows)
docker compose --profile app up -d --wait --build   # api (ROLE=api), worker (ROLE=worker), sandbox (sidecar), httpbin
```

Expected:

- `docker compose ps` shows every service healthy.
- The sandbox listens only inside the worker's network namespace: `curl 127.0.0.1:5050` from the host fails.
- `GET /api/v1/health` returns 200.

Sign in as in the 001 quickstart and keep the cookie in `jar.txt`. All calls below send
`-b jar.txt -H 'content-type: application/json' -H 'origin: http://127.0.0.1:53000'`, abbreviated as `$C`.

## Scenario 1: build and test-run (US1, US4)

```bash
curl -s $C http://127.0.0.1:53000/api/v1/node-types | jq '.nodeTypes | length'      # 29
WF=$(curl -s $C -X POST http://127.0.0.1:53000/api/v1/workflows -d '{"name":"Orders"}' | jq -r .id)
curl -s $C -X PUT http://127.0.0.1:53000/api/v1/workflows/$WF/draft -d @specs/002-workflow-builder/examples/orders-draft.json
RUN=$(curl -s $C -X POST http://127.0.0.1:53000/api/v1/runs \
  -d "{\"workflowId\":\"$WF\",\"target\":{\"draft\":{\"revision\":2}},\"items\":[{\"total\":10},{\"total\":150},{\"total\":70}]}" | jq -r .runId)
curl -s -i $C http://127.0.0.1:53000/api/v1/runs/$RUN     # repeat with If-None-Match: <ETag> → 304 until it changes
curl -s $C "http://127.0.0.1:53000/api/v1/runs/$RUN/steps/<if-node-id>/output?port=true&offset=0&limit=50"
```

The example draft is Manual Trigger → Edit Fields (`net = {{ $json.total * 0.8 }}`) → If (`total > 50`). The
tasks add it under `specs/002-workflow-builder/examples/`.

Expected:

- `PUT` returns `{ revision: 2, validation: { errors: [], warnings: [] } }`.
- `POST /runs` returns 202 with `runId`.
- The run reaches `succeeded` with three steps.
- The If node's `true` port holds two items and its `false` port one.
- `GET /workflows/$WF` now lists field shapes for each node under `samples`.
- Saving with a stale `revision` returns 409.
- A draft with a cycle saves with an error in `validation` and is refused by `POST /runs` and `POST /versions` with 422.

## Scenario 2: Code node in three languages (US2)

Add a Code node per language with "run once for all items":

```text
return $input.all().map((i) => ({ ...i, doubled: i.total * 2 }))                       # JavaScript
return $input.all().map((i: { total: number }) => ({ ...i, doubled: i.total * 2 }))      # TypeScript
return [{**i, "doubled": i["total"] * 2} for i in _input.all()]                          # Python
```

Expected:

- All three produce the same items.
- Diagnostics show console output.
- `fetch('http://example.com')`, `open('/etc/passwd')`, `while(true){}` and a 1 GB allocation each fail the node with `kind: user` (or `isolation`) and a named cause, and are not retried.

## Scenario 3: HTTP Request with a credential (US3)

```bash
CRED=$(curl -s $C -X POST http://127.0.0.1:53000/api/v1/credentials \
  -d '{"name":"httpbin token","type":"httpBearer","secret":{"token":"s3cr3t-token"}}' | jq -r .id)
```

Add an HTTP Request node `GET http://httpbin:8080/bearer` with the credential, then test-run it.

Expected:

- The step output shows `authenticated: true`.
- `GET /credentials/$CRED` has no secret field.
- `grep -r s3cr3t-token` over the API and worker logs finds nothing.
- URLs `http://127.0.0.1:53000/…`, `http://169.254.169.254/latest/meta-data`, `http://[::ffff:127.0.0.1]/` and `http://httpbin:8080/redirect-to?url=http://127.0.0.1/` each fail the node with `kind: isolation` before any connection.

## Scenario 3b: declarative pagination (US3, FR-037)

The `pagination` parameter is described in [contracts/http-request-pagination.schema.yaml](contracts/http-request-pagination.schema.yaml).

1. **Page number without formulas.** An HTTP Request node `GET http://httpbin:8080/anything` with:
   - `pagination.mode = parameters`;
   - one parameter `{ in: query, name: page, value: { pageNumber: { start: 1 } } }`;
   - `maxPages = 3`;
   - `output = pages`.

   Expected: three output items, whose echoed `args.page` values are `1`, `2` and `3`. Setting `onMaxPages = fail` fails the node with the limit named.

2. **Link header.** URL
   `http://httpbin:8080/response-headers?Link=%3Chttp%3A%2F%2Fhttpbin%3A8080%2Fresponse-headers%3Fp%3D2%3E%3B%20rel%3D%22next%22`
   with `pagination.mode = nextLink` and `nextLink = { linkHeader: next }`.

   Expected: two pages; the second page has no `Link` header, so `missingNext` completes pagination.

3. **SSRF on a next link.** A next link pointing to `http://127.0.0.1/` or `http://169.254.169.254/` fails the node with `kind: isolation`.

Expected in the integration suite (`test/integration/outbound/http-request-pagination.spec.ts`), against a local fixture API:

- Each preset (cursor in body or header, page number, offset by records, next link in body or `Link`) collects every record from `records` without a formula.
- Repeated or cyclic cursors fail with "pagination did not advance".
- A 429 with `Retry-After: 2` is retried for that page only.
- A next link to another origin is requested without the credential.
- `+json` bodies are parsed.
- Exceeding 10,000 records fails with the step limit.

## Scenario 4: publish, schedule and webhook (US5)

```bash
curl -s $C -X POST http://127.0.0.1:53000/api/v1/workflows/$WF/versions -d '{"revision":3}'    # 201 { number: 1 }
curl -s $C -X PUT  http://127.0.0.1:53000/api/v1/workflows/$WF/activation -d '{"version":1}'  # 200
curl -s $C http://127.0.0.1:53000/api/v1/workflows/$WF/webhooks | jq '.items[0]'              # url, secret
curl -s -X POST "<url>" -H "x-webhook-token: <secret>" -H 'x-delivery-id: d-1' -d '{"order":1}'    # 202 { runId }
curl -s -X POST "<url>" -H "x-webhook-token: <secret>" -H 'x-delivery-id: d-1' -d '{"order":1}'    # 202, same runId, Idempotent-Replayed: true
curl -s -X POST "<url>" -H "x-webhook-token: <secret>" -H 'x-delivery-id: d-1' -d '{"order":2}'    # 422 IDEMPOTENCY_KEY_REUSED
curl -s -X POST "<url>" -d '{}'                                                                    # 404, identical to an unknown endpoint
```

With a Schedule Trigger "every 1 minute", one run per minute appears in `GET /workflows/$WF/runs`, all with `version: 1`. Editing the draft does not change them until the next publish and activation. `DELETE /activation` stops new runs.

## Scenario 5: wait, resume, sub-workflow and error workflow (US6)

- **Timed wait**:
  1. A Wait of 2 minutes leaves the run `waiting`.
  2. `docker compose restart worker`.
  3. The run continues after the wait and succeeds.
- **Resume mode**:
  1. Read the resume address from a formula `{{ $execution.resumeUrl }}` or from the step output of an Edit Fields node before the Wait.
  2. `POST <resumeUrl> -d '{"approved":true}'` returns 202, and the run continues with `approved`.
  3. A second POST with another body returns 409, and the run keeps the first body. Repeating the first call with the same `Idempotency-Key` returns its original 202. With the header-credential option, a call without the credential returns 404.
- **Execute Workflow**: a published child workflow starting with Execute Workflow Trigger returns its last-node items to the caller. A workflow calling itself fails at depth 6.
- **Error workflow**: assigning an error workflow and failing a production run starts one error run with the failed run, node and message. Test runs never start it.

## Scenario 6: crash recovery (SC-002)

1. Start a production run whose middle node is a Code node sleeping 20 s.
2. While it runs, `docker compose kill worker` and then `docker compose --profile app up -d worker`.

Expected:

- Within the 30 s lease plus one poll, the run continues on the new worker.
- The steps before the Code node keep `attempts: 1`.
- The Code node shows `attempts: 2`.
- The run succeeds.

## Scenario 7: history and retention (US7)

1. `PUT /settings/retention {"retentionDays":1,"maxRunsPerWorkflow":5}` as an administrator returns 200; as an editor it returns 403.
2. Trigger the retention schedule (the test helper calls the engine schedule `retention` with `trigger`).

Expected:

- Only the newest five finished runs per workflow remain, and their `runs/<id>/` objects are gone from Garage.
- Queued, running and waiting runs are untouched.

## Automated tests

```bash
pnpm --filter api test        # unit: domain, use cases (inline StepRunner), node executors, formula engine
pnpm --filter api test:int    # PostgreSQL, Garage and sandbox containers: repositories, artifact store, engine gateways
                              #   (ManualWorkflowClock + drain, two-instance crash test), Code node in three languages,
                              #   HTTP Request with SSRF refusals; component suites through HTTP with the worker drained
docker compose --profile app up -d --wait
pnpm --filter api test:e2e    # journeys: build and test-run, HTTP Request with credential, publish and activate,
                              #   scheduled run, webhook run with deduplication, worker kill and resume
pnpm lint && pnpm check-types
```

Expected: all suites pass with no skipped tests; DR-004 journeys are present.

## Image and security gates

```bash
docker build -f apps/api/sandbox/Dockerfile -t workflow-platform/sandbox:dev apps/api/sandbox
trivy image --scanners vuln --severity HIGH,CRITICAL --exit-code 1 workflow-platform/sandbox:dev
trivy image --scanners vuln --severity HIGH,CRITICAL --exit-code 1 workflow-platform/api:dev
pnpm audit --prod --audit-level=high
grep -nE '"[\^~]' package.json apps/api/package.json && echo "ranges found" || echo "all exact"
```

Expected:

- Zero critical or high findings, and "all exact".
- The sandbox image runs go-judge with `-http-addr=127.0.0.1:5050`.
- A Code node that calls `connect()` fails, which is the CI check that the sandbox has no network.
