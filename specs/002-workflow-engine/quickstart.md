# Quickstart: Workflow Engine

Runnable checks that prove the feature end to end. Endpoints: [contracts/openapi.yaml](contracts/openapi.yaml). Behaviour: [architecture.md](architecture.md). Criteria: [spec.md](spec.md).

## Prerequisites

1. Install the packages listed in research R18 (`pnpm install`).
2. Start the local stack with `docker compose up -d`. It runs PostgreSQL, the SMTP capture service and go-judge. go-judge is built from `docker/go-judge`, needs privileged mode, gives its processes no network, and provides Node.js and Python 3.
3. Apply the migrations:
   ```bash
   pnpm --filter api db:migrate          # application tables
   pnpm --filter api outbox:migrate      # nest_outbox
   pnpm --filter api engine:migrate      # nest_workflows (nest-workflows migrate)
   ```
4. Set the environment (see `.env.example`):
   - `SECRETS_KEY` (32 bytes, base64);
   - `SANDBOX_URL` and `SANDBOX_TOKEN` (go-judge);
   - `OUTBOUND_ALLOW_LIST` (empty by default);
   - the role flags `HTTP`, `ENGINE_WORKER` and `OUTBOX_RELAY`.
5. Run two processes, so that the checks also exercise several workers:
   ```bash
   HTTP=on ENGINE_WORKER=on OUTBOX_RELAY=on pnpm --filter api dev
   HTTP=off ENGINE_WORKER=on OUTBOX_RELAY=on PORT=0 pnpm --filter api start
   ```
6. Sign in as the seeded administrator (feature 001) and keep the session cookie.

## Scenarios

| #   | Do                                                                                                                                                                     | Expect                                                                                                                          |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `POST /api/v1/workflows/check` with a valid document, then with one whose flow directive names a missing task                                                          | 204, then a 422 problem `urn:problem:definition.invalid` whose `errors[0].pointer` names the directive (FR-002, FR-003, FR-033) |
| 2   | `POST /api/v1/workflows` with the CTK `do.feature` document as JSON, then the same document again, then different content under the same version                       | 201, then 200, then a 409 problem `urn:problem:workflow.version-taken` (FR-004)                                                 |
| 3   | `POST /api/v1/workflows/default/do/instances` twice with `Idempotency-Key: k1`                                                                                         | The same instance both times. It ends `completed` with `colors = [red, green, blue]` (US2, SC-010).                             |
| 4   | Publish a workflow with a `run: script` task: Python that prints `{"total": 42}`, with `output.as: ${ fromjson }`. Start it.                                           | Completed with `{ total: 42 }`. A second script that opens a socket fails inside the sandbox (FR-012, SC-012).                  |
| 5   | A `run: shell` task with `return: all`, running `exit 3`                                                                                                               | Completed with `{ code: 3, stdout: "", stderr: "" }`; a non-zero exit is not a fault (FR-012)                                   |
| 6   | Publish a workflow with `wait: { minutes: 1 }`, start it, kill both processes during the wait, then restart them                                                       | The instance resumes and completes (US7, FR-020)                                                                                |
| 7   | Listen for `com.example.order.paid` correlated on `.data.orderId`, then post the wrong order, the right order, and the right order again to `/api/v1/events`           | Exactly one event is consumed, and the duplicate is acknowledged (US7, SC-007)                                                  |
| 8   | Create a webhook for `com.example.form.submitted`, turn on a workflow with a matching `schedule.on`, and post JSON to the webhook URL                                  | 202 at once and one instance, with the body at `$workflow.input[0].data.body` (US5, SC-008)                                     |
| 9   | Subscribe a local receiver (allow-listed) to `io.serverlessworkflow.workflow.completed.v1`. Stop the receiver for 5 minutes while instances complete, then restart it. | Every event arrives once the receiver is back, and any repeat carries the same `id` (US6, SC-009)                               |
| 10  | Turn on a workflow with `schedule: { every: PT1M }` across both processes for 5 minutes, then turn it off                                                              | Exactly 5 instances, and none after it is turned off (US4)                                                                      |
| 11  | Suspend, resume and cancel a long instance, then cancel a finished one                                                                                                 | The phases follow User Story 9, and the last request gives 409 (FR-017)                                                         |
| 12  | Create the secret `basic`, then run a call that authenticates with it                                                                                                  | The receiver gets the credential, the records show it masked, and the list shows only the name (US8, SC-011)                    |
| 13  | `GET /api/v1/conformance`                                                                                                                                              | The subset of FR-011, with its exclusions and the two recorded contradictions (ER-001, FR-032)                                  |

## Test suites

```bash
pnpm --filter api test        # domain and use cases (with fakes)
pnpm --filter api test:int    # the runtime's checks and execution, repositories, the delivery client and component tests on PostgreSQL
pnpm --filter api test:ctk    # the 21 CTK scenarios over HTTP, with the public hosts stubbed by undici MockAgent
pnpm --filter api test:e2e    # Compose journeys; the automation journeys (SC-003, SC-004) are still open (tasks.md)
```

All suites must pass with zero tests skipped. The recorded contradiction (FR-032) runs too: its steps assert the fault the specification prescribes, with the error the kit expects in the output read from the instance's error.
