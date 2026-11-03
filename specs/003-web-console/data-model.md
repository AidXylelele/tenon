# Data Model: Web Console

The console stores nothing but the session cookie. Its models are the API's resources, read with Postel's law (unknown fields ignored), and these view models.

## Client types (`libs/data-access`)

They are written from the contracts of [001](../001-api-authentication/contracts/openapi.yaml) and [002](../002-workflow-engine/contracts/openapi.yaml).

| Group                | Types                                                                                  |
| -------------------- | -------------------------------------------------------------------------------------- |
| Session and identity | `Session`, `User`, `Role`, `Invitation`                                                |
| Workflows            | `Workflow`, `Version`                                                                  |
| Instances            | `InstanceSummary`, `Instance`, `TaskRecord`, `WorkflowError`                           |
| Events               | `CloudEvent`                                                                           |
| Integrations         | `Webhook`, `CreatedWebhook`, `Secret`, `Subscription`, `Delivery`                      |
| Conformance          | `ConformanceStatement`                                                                 |
| Paging               | `Page<T>` (`items`, `next`)                                                            |
| Refusals             | `Problem` (RFC 9457: `type`, `title`, `status`, `detail`, `errors[{pointer, detail}]`) |

Commands answer `Outcome<T> = { ok: true, value: T } | { ok: false, problem: Problem }`. Reads answer the value, or `null` for a 404.

## Draft document (`automation/__shared_context/document`)

- **`Draft`**: the document as JSON (`document`, `input`, `use`, `schedule`, `do`, and any other root property, kept untouched).
- **`TaskEntry`**: one entry of a task list, with:
  - `name`;
  - `kind` (`set`, `http`, `call`, `wait`, `emit`, `listen`, `raise`, `switch`, `for`, `fork`, `try`, `do`, `run-workflow`, `run-script`, `run-shell`, `advanced`);
  - `pointer` (RFC 6901 into the draft);
  - the task's JSON;
  - its nested lists: `do`, `try`, `catch.do`, `fork.branches`.
- **`Trigger`**: one of:
  - `manual` (no `schedule`);
  - `cron { expression }`;
  - `every { duration }`;
  - `after { duration }`;
  - `event { type }` (`schedule.on.one.with.type`);
  - `custom`, for any other `schedule`, which is kept as code.
- **`Located problem`**: the problem's pointer, resolved to a task pointer and a field key; or to the root fields (`/document`, `/schedule`, `/use`).

## Outline (`operations/workflow-document`, `operations/run-progress`)

The task tree of a version, flattened for display: depth, name, kind, pointer. On an instance `run-progress` joins it with the task records by `reference`, so each task shows its latest record's status, and the error's `instance` pointer marks the faulting task.
