# Data Model: Workflow Engine

This file lists the entities, fields, read models and tables as implemented. Mechanics are in [architecture.md](architecture.md), and decisions in [research.md](research.md). The Open Workflow DSL is not modelled in the domain: the runtime in `frameworks/runtime` checks and runs documents (research R1).

## 1. Bounded context and modules

There is one new bounded context, **automation**, next to **identity**, whose `User` the policies read.

| Module          | Holds                                                      |
| --------------- | ---------------------------------------------------------- |
| `workflows`     | Workflow, WorkflowVersion, CheckedDefinition, WorkflowName |
| `instances`     | WorkflowInstance                                           |
| `webhooks`      | Webhook, WebhookToken                                      |
| `secrets`       | Secret                                                     |
| `subscriptions` | Subscription                                               |

## 2. Ubiquitous language

The terms are the standard's unless marked _platform_.

| Term                   | Meaning                                                                                                                 |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Workflow               | A named automation (namespace and name) with versions, a current version, a status and an on/off switch (_platform_)    |
| Workflow version       | One immutable published document, identified by namespace, name and version                                             |
| Checked definition     | A document the runtime accepted: its identity, a fingerprint of its content, and the event types its schedule starts on |
| Instance               | One execution of a version, in the standard's phases                                                                    |
| Task record            | One execution of a task (an iteration, a retry attempt or a later visit is its own record) (_platform_)                 |
| Trigger                | What started an instance: manual, schedule, event, parent, detached or restart (_platform_)                             |
| Event                  | A CloudEvent accepted or produced by the platform, unique by source and id                                              |
| Lifecycle event        | The standard's notice of a workflow or task change                                                                      |
| Listener               | A `listen` task that waits now, with the event types it takes and when it began (_platform_)                            |
| Webhook                | A secret URL whose calls become events of one type (_platform_)                                                         |
| Subscription, delivery | An owner's request that matching events reach an endpoint, and one event's attempts to reach it (_platform_)            |
| Secret                 | A named credential owned by one user                                                                                    |

## 3. Aggregates and entities

References between aggregates are ids (Khorikov, "Link to an aggregate: reference or Id?"). A repository has one `save`, an upsert fenced by the row's `version` that raises `StaleWriteError` (research R15). Write-once aggregates use `add`. Expected refusals are `Result` values with a code (§6).

### Workflow

- **Protects:** the current version, the archived status, the on/off switch, and which version's schedule starts instances.
- **Fields:** `id`, `name` (`WorkflowName`), `status` (`active`, `archived`), `on`, `currentVersionId`, `archivedAt`, `version`, plus its events.
- **Behaviour:**
  - `register(name)`.
  - `publish({ definition, existing, publisherId, now })`. The same content under an existing identity returns that version (`republish`). Other content is `workflow.version-taken`, and an archived workflow is `workflow.archived`. A new version becomes current and, while the workflow is on, raises `workflow.schedule-changed`.
  - `archive(now)` turns the workflow off and is a no-op when it is already archived.
  - `turnOn()` refuses an archived workflow. `turnOn()` and `turnOff()` raise `workflow.schedule-changed` when they change something.
  - `startInstance(input)` refuses an archived workflow.
  - `scheduledVersionId` is the current version while the workflow is on, and none when it is off.
  - `startScheduledInstance(start)` refuses a version other than `scheduledVersionId` (`workflow.off`). It starts nothing for an `after` link while an instance the schedule started runs.
  - `restartInstance(restart)` refuses an instance that has not ended (`instance.not-ended`).

### WorkflowVersion (write-once)

- **Protects:** a published document never changes.
- **Fields:** `id`, `workflowId`, `semver`, `dsl`, `fingerprint` (SHA-256 of the canonical JSON), `document` (the JSON as published), `publisherId`, `publishedAt`, and `eventTypes`:
  - `null`: the schedule starts on no events;
  - `[]`: it starts on events of any type;
  - a list: it starts on events of those types.
- **Behaviour:** created only by `Workflow.publish`. `republish(definition)` answers the same version or `workflow.version-taken`.

**CheckedDefinition** is a value object made only by the runtime's checker. It holds `name`, `version`, `dsl`, `fingerprint`, `document` and `eventTypes`.

### WorkflowInstance

- **Protects:** the standard's phases, and which user requests a phase allows.
- **Fields:** `id`, `workflowId`, `versionId`, `trigger`, `starterId`, `originId` (the parent of a child, or the instance a restart comes from), `input`, `phase`, `output`, `error`, `createdAt`, `startedAt`, `endedAt`, `waiting` (a wait or a listen is in progress), `version`, plus its events.
- **Behaviour:**
  - `start` creates the instance as pending.
  - `begin(now)` takes a pending instance to running.
  - `beginWaiting()` and `endWaiting()` move between running and waiting.
  - `complete(output, now)` and `fault(error, now)` are facts the runtime reports. They are ignored once the instance has ended.
  - `suspend()` refuses anything but running or waiting (`instance.not-running`).
  - `resume()` refuses anything but suspended (`instance.not-suspended`), and returns to waiting or running.
  - `cancel(now)` refuses an ended instance (`instance.ended`).
  - `delete()` refuses an instance that has not ended (`instance.not-ended`).
  - `directive()` tells the runtime after each task: `continue`, `suspend` or `stop`.
  - `continuesSchedule` is true only for a completed instance its schedule started.
- **Events:** `instance.started`, `.suspended`, `.resumed`, `.cancelled`, `.faulted`, `.completed` and `.deleted`. The repository turns all but `deleted` into lifecycle events, and sends cancel, resume and delete to the engine through the outbox.

### Webhook

- **Protects:** the URL's token is kept only as a fingerprint, and each call becomes one event of the declared type.
- **Fields:** `id`, `name`, `eventType`, `tokenFingerprint`, `createdAt`. There is no owner; every editor manages every webhook.
- **Behaviour:**
  - `create({ name, eventType, token, now })`.
  - `receive(call, now)` gives the event: its id is the caller's `Idempotency-Key`, or a new one; its source is `/webhooks/{id}`; its type is the webhook's; its data is `{ body, query, headers }`.
- **WebhookToken** (value object): `generate()` makes 32 random bytes in base64url; `fingerprint` is the token's SHA-256.

### Secret

- **Protects:** a credential belongs to one owner, under one name.
- **Fields:** `id`, `ownerId`, `name`, `value` (plain only in memory; the repository seals it through `Cipher`), `createdAt`, `updatedAt`, `version`.
- **Behaviour:** `create(input)`, `replace(value, now)`. `CreateSecret` refuses a name its owner already keeps (`secret.name-taken`); the unique (owner, name) index backs it.

### Subscription

- **Protects:** deliveries authenticate only with a secret their owner keeps.
- **Fields:** `id`, `ownerId`, `name`, `endpoint`, `filter`, `types`, `createdAt`.
  - `endpoint` is `uri`, `scheme` (`basic`, `bearer` or none) and `secret` (a secret's name, or none).
  - `filter` is the standard's event filter, `{ with }`.
  - `types` is the event types the filter takes, or `null` for any.
- **Behaviour:**
  - `create(input)` refuses a secret not in the owner's names (`subscription.foreign-secret`).
  - `isOwnedBy(ownerId)`.

## 4. Read models

The stores write them and the queries read them. None is an aggregate.

| Read model      | Written by                                                           | Content                                                                                                                                                                                                                                                     |
| --------------- | -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `task_progress` | `TaskProgress` (the runtime's task starts and ends)                  | One row per execution: `execution`, `reference`, `name`, `status` (`running`, `completed`, `faulted`, `cancelled`, `skipped`), `input`, `output`, `error`, `startedAt`, `endedAt`. A task still running when its instance ends becomes `cancelled` (FR-015) |
| `event`         | `EventStore`                                                         | Every accepted or produced CloudEvent, once per (source, id), in acceptance order (`sequence`), with its origin (`intake`, `webhook`, `emit`, `lifecycle`) and its instance                                                                                 |
| `listener`      | `ListenerStore` (`Listen`, `Unlisten`)                               | The `listen` tasks waiting now: instance, key, event types (`null` for any), `since`                                                                                                                                                                        |
| `delivery`      | `DeliveryLog` (`MatchSubscriptions`, `DeliverEvent`, `FailDelivery`) | One row per subscription and event: `eventId`, `type`, `status` (`pending`, `delivered`, `failed`), `attempts`, `lastError`, `firstAttemptAt`, `lastAttemptAt`                                                                                              |

A `task_progress` row also has its `attempt` (which attempt of the task its retry policy counts) and, for a fault a `try` retries, `retryAt` (research R15).

The query ports are `WorkflowQueries`, `InstanceQueries`, `EventQueries`, `WebhookQueries`, `SecretQueries` and `SubscriptionQueries`.

## 5. State machines

**Instance:**

| From                                 | To                 | When                          |
| ------------------------------------ | ------------------ | ----------------------------- |
| pending                              | running            | the run begins                |
| running                              | waiting            | a wait or a listen begins     |
| waiting                              | running            | it ends                       |
| running, waiting                     | suspended          | suspend                       |
| suspended                            | running or waiting | resume                        |
| pending, running, waiting, suspended | cancelled          | cancel (awaited children too) |
| running, waiting                     | completed, faulted | the run's outcome             |

**Task record:** running → completed, faulted or cancelled; or skipped, with no phase.

**Delivery:** pending → delivered, or failed once its 36 attempts are spent.

## 6. Refusals

| Code                                                                                                                               | Owner                                                    | HTTP |
| ---------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- | ---- |
| `definition.invalid` (pointer and detail)                                                                                          | the runtime's checks                                     | 422  |
| `workflow.archived`, `workflow.version-taken`, `workflow.off`                                                                      | Workflow, WorkflowVersion                                | 409  |
| `instance.ended`, `instance.not-ended`, `instance.not-running`, `instance.not-suspended`                                           | WorkflowInstance                                         | 409  |
| `secret.name-taken`                                                                                                                | `CreateSecret`, backed by the unique (owner, name) index | 409  |
| `subscription.foreign-secret`                                                                                                      | Subscription                                             | 422  |
| `subscription.invalid` (pointer under `/filter`)                                                                                   | the runtime's filter check                               | 422  |
| `workflow.not-found`, `version.not-found`, `instance.not-found`, `webhook.not-found`, `secret.not-found`, `subscription.not-found` | the use cases (`Missing`)                                | 404  |

`StaleWriteError` is the one domain error class of this feature, for any optimistic conflict. Run-time workflow errors are the standard's error values (`type`, `status`, `instance`, `title`, `detail`) in the instance's or the task record's `error`.

## 7. Rule owners

| Rule                                                                                         | Owner                                                                         |
| -------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| The standard's schema, the subset, references, durations, cron, expression and schema syntax | the runtime's checks (`frameworks/runtime/checking`)                          |
| A version names only its publisher's secrets                                                 | the runtime's `SecretCheck`, given the publisher's names by `CheckDefinition` |
| A published document never changes; same content is the same version                         | WorkflowVersion, plus the unique (workflow, semver) index                     |
| Current version, archive, on/off, which version's schedule starts                            | Workflow                                                                      |
| One `after` chain at a time; a link only after a completed instance                          | Workflow, WorkflowInstance (`continuesSchedule`)                              |
| Phases and the requests they allow                                                           | WorkflowInstance                                                              |
| An event is accepted once per source and id                                                  | the `event` table's unique index                                              |
| `with` and `correlate` matching                                                              | the runtime's `EventFilters`                                                  |
| Only events accepted after a listen began, or after a subscription existed, reach it         | the listener and subscription queries                                         |
| A webhook call's event: type, source, id and data; no credentials                            | Webhook; the API's `WebhookCallMapper` drops `Authorization` and `Cookie`     |
| A subscription authenticates only with its owner's secret                                    | Subscription                                                                  |
| Encryption at rest                                                                           | the secret repository and queries, through `Cipher`                           |
| Masking of secret values                                                                     | the runtime (`secret-values.ts`); the delivery client                         |
| Access by role                                                                               | the `@Can` policies, one per resource                                         |

## 8. Persistence (PostgreSQL, Drizzle)

| Table               | Key columns                                                                                                                                  | Notes                                                                                                        |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `workflow`          | id, namespace, name, status, turned_on, current_version_id, archived_at, version                                                             | unique (namespace, name)                                                                                     |
| `workflow_version`  | id, workflow_id, semver, dsl, document jsonb, fingerprint, event_types text[], publisher_id, published_at                                    | unique (workflow_id, semver)                                                                                 |
| `workflow_instance` | id, workflow_id, version_id, trigger, starter_id, origin_id, input, phase, output, error, created_at, started_at, ended_at, waiting, version | indexes (created_at, id) and (workflow_id, created_at, id), ascending (research R15)                         |
| `task_progress`     | instance_id, execution, sequence, reference, name, status, input, output, error, started_at, ended_at, attempt, retry_at                     | primary key (instance_id, execution); index (instance_id, sequence); cascades with its instance              |
| `event`             | sequence, source, event_id, type, origin, instance_id, cloud_event jsonb, accepted_at                                                        | unique (source, event_id); index (instance_id, sequence)                                                     |
| `listener`          | instance_id, key, types text[], since                                                                                                        | primary key (instance_id, key); GIN on types; cascades with its instance                                     |
| `webhook`           | id, name, event_type, token_fingerprint, created_at                                                                                          | unique token_fingerprint                                                                                     |
| `secret`            | id, owner_id, name, sealed, created_at, updated_at, version                                                                                  | unique (owner_id, name); cascades with its user                                                              |
| `subscription`      | id, owner_id, name, endpoint jsonb, filter jsonb, types text[], created_at                                                                   | index owner_id; GIN on types; cascades with its user                                                         |
| `delivery`          | subscription_id, sequence, event_id, type, status, attempts, last_error, first_attempt_at, last_attempt_at, created_at                       | primary key (subscription_id, sequence); index (subscription_id, created_at); cascades with its subscription |
| `idempotency_key`   | the `@nestjs/idempotency` store contract (migration 0003)                                                                                    |                                                                                                              |

The libraries own their schemas, `nest_workflows` and `nest_outbox`, migrated by `engine:migrate` and `outbox:migrate`.

**Migrations of this feature** (`apps/api/drizzle/`):

| Migration                  | Change                                                                                     |
| -------------------------- | ------------------------------------------------------------------------------------------ |
| `0004_workflow`            | `workflow` and `workflow_version`                                                          |
| `0005_workflow_instance`   | `workflow_instance` and `task_progress`                                                    |
| `0006_event`               | `event`                                                                                    |
| `0007_instance_waiting`    | `workflow_instance.waiting`                                                                |
| `0008_listener`            | `listener`                                                                                 |
| `0009_instance_list_order` | the instance list indexes recreated ascending, the workflow index with `id` (research R15) |
| `0010_webhook`             | `webhook`                                                                                  |
| `0011_schedules`           | `workflow.turned_on` and `workflow_version.event_types`                                    |
| `0012_secrets`             | `secret`                                                                                   |
| `0013_subscriptions`       | `subscription` and `delivery`                                                              |
| `0014_task_attempts`       | `task_progress.attempt` and `retry_at`                                                     |

## 9. Building blocks and their sources (AR-001)

| Building block        | Where                                                                                                        | Source                                                                                                        |
| --------------------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| Entities              | Workflow, WorkflowVersion, WorkflowInstance, Webhook, Secret, Subscription                                   | Khorikov, "Entity vs Value Object: the ultimate list of differences"                                          |
| Value objects         | WorkflowName, CheckedDefinition, WebhookToken                                                                | Khorikov, "Value Objects: when to create one?"                                                                |
| Aggregates, set rules | One per repository; uniqueness by index                                                                      | Khorikov, "Email uniqueness as an aggregate invariant"                                                        |
| References            | By id                                                                                                        | Khorikov, "Link to an aggregate: reference or Id?"                                                            |
| Domain events         | Collected by the aggregate, written by `save` in its transaction, dispatched after commit through the outbox | Khorikov, "Domain events: simple and reliable solution"; MS Learn, "Domain events: design and implementation" |
| Expected failures     | `Result` values with codes                                                                                   | Khorikov, "Functional C#: Handling failures, input errors"                                                    |
| Repositories, CQS     | One repository per aggregate; queries into read models                                                       | Khorikov, "Types of CQRS"                                                                                     |
| Validation            | zod and the standard's schema at the boundary; invariants in the domain                                      | Khorikov, "Validation and DDD"                                                                                |
