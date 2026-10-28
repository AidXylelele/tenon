# Quickstart: Workflow Engine

Runnable checks that prove the feature end to end. Endpoints: [contracts/openapi.yaml](contracts/openapi.yaml). Behaviour: [architecture.md](architecture.md). Criteria: [spec.md](spec.md).

## Prerequisites

1. Install the packages listed in research R21 (`pnpm --filter api add …`). The user runs this step.
2. Start the local stack with `docker compose up -d`. It runs PostgreSQL, the SMTP capture service and go-judge. go-judge uses a custom image pinned by digest, needs privileged mode, has no network, and provides Node.js and Python 3 in its rootfs.
3. Apply the migrations:
   ```bash
   pnpm --filter api db:migrate          # application tables
   pnpm --filter api outbox:migrate      # nest_outbox
   pnpm --filter api engine:migrate      # nest_workflows (nest-workflows migrate, added in S0)
   ```
4. Set the environment (see `.env.example`):
   - `SECRETS_KEY` (32 bytes, base64);
   - `SANDBOX_URL` (go-judge);
   - `OUTBOUND_ALLOW_LIST` (empty by default);
   - the role flags `HTTP`, `ENGINE_WORKER` and `OUTBOX_RELAY`.
5. Run two processes, so that the checks also exercise several workers:
   ```bash
   HTTP=on ENGINE_WORKER=on OUTBOX_RELAY=on pnpm --filter api dev
   HTTP=off ENGINE_WORKER=on OUTBOX_RELAY=on PORT=0 pnpm --filter api start
   ```
6. Sign in as the seeded administrator (feature 001) and keep the session cookie.

## Scenarios

| #   | Do                                                                                                                                                                     | Expect                                                                                                         |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| 1   | `POST /api/v1/workflows/check` with a document that has a schema error, a flow directive to a missing task and a bad jq expression                                     | 200 with `valid: false` and three problems, each with a JSON Pointer (FR-002, FR-003)                          |
| 2   | `POST /api/v1/workflows` with the CTK `do.feature` document, then the same document again, then different content under the same version                               | 201, then 200, then 409 (FR-004)                                                                               |
| 3   | `POST /api/v1/workflows/default/do/instances` twice with `Idempotency-Key: k1`                                                                                         | The same instance both times. It ends `completed` with `colors = [red, green, blue]` (US2, SC-010).            |
| 4   | Publish a workflow with a `run: script` task: Python that prints `{"total": 42}`, with `output.as: ${ fromjson }`. Start it.                                           | Completed with `{ total: 42 }`. A second script that opens a socket fails inside the sandbox (FR-012, SC-012). |
| 5   | A `run: shell` task with `return: all`, running `exit 3`                                                                                                               | Completed with `{ code: 3, stdout: "", stderr: "" }`; a non-zero exit is not a fault (FR-012)                  |
| 6   | Publish a workflow with `wait: { minutes: 1 }`, start it, kill both processes during the wait, then restart them                                                       | The instance resumes and completes (US7, FR-020)                                                               |
| 7   | Listen for `com.example.order.paid` correlated on `.data.orderId`, then post the wrong order, the right order, and the right order again to `/api/v1/events`           | Exactly one event is consumed, and the duplicate is acknowledged (US7, SC-007)                                 |
| 8   | Create a webhook for `com.example.form.submitted`, turn on a workflow with a matching `schedule.on`, and post JSON to the webhook URL                                  | 202 at once and one instance, with the body at `$workflow.input[0].data.body` (US5, SC-008)                    |
| 9   | Subscribe a local receiver (allow-listed) to `io.serverlessworkflow.workflow.completed.v1`. Stop the receiver for 5 minutes while instances complete, then restart it. | Every event arrives once the receiver is back, and any repeat carries the same `id` (US6, SC-009)              |
| 10  | Turn on a workflow with `schedule: { every: PT1M }` across both processes for 5 minutes, then turn it off                                                              | Exactly 5 instances, and none after it is turned off (US4)                                                     |
| 11  | Suspend, resume and cancel a long instance, then cancel a finished one                                                                                                 | The phases follow User Story 9, and the last request gives 409 (FR-017)                                        |
| 12  | Create the secret `basic`, then run a call that authenticates with it                                                                                                  | The receiver gets the credential, the records show it masked, and the list shows only the name (US8, SC-011)   |
| 13  | `GET /api/v1/conformance`                                                                                                                                              | The subset of FR-011 and the recorded contradiction (ER-001, FR-032)                                           |

## Test suites

```bash
pnpm --filter api test        # domain (sociable) and use cases (solitary, with fakes)
pnpm --filter api test:int    # repositories, store, engine rounds, outbox handlers, gateways and component tests on PostgreSQL; go-judge through Testcontainers
pnpm --filter api test:ctk    # the 21 CTK scenarios over HTTP, with the public hosts stubbed by undici MockAgent
pnpm --filter api test:e2e    # Compose journeys, including fault injection (SC-003) and scale-out (SC-004)
```

All suites must pass with zero tests skipped. The only CTK scenario expected not to pass is the recorded contradiction (FR-032).
