# Data Model: Workflow Engine

The design follows the DDD steps in order: language, event storming, use cases, aggregates, rule owners, model. Mechanics are in [architecture.md](architecture.md) and decisions in [research.md](research.md). Every element exists because a requirement needs it (research R20). The critics' second-round fixes are applied (R22).

## 1. Bounded context and modules

There is one new bounded context, **automation**, next to **identity**, whose `Actor` it uses. The modules follow business capability:

| Module      | Content                                                                                                                                                                                |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `language`  | The standard's semantics: the document model and its factory, each task kind's progress decisions, event filters, and the work and results the decisions exchange. Value objects only. |
| `workflows` | Publication and activation: Workflow, WorkflowVersion                                                                                                                                  |
| `instances` | Execution: WorkflowInstance with its tasks, origins, limits and lifecycle events                                                                                                       |
| `events`    | Events in and out: Event, Correlation, Webhook, Subscription, Delivery                                                                                                                 |
| `secrets`   | Secret, SecretValues                                                                                                                                                                   |

## 2. Ubiquitous language

The terms are the standard's unless marked _platform_.

| Term                                         | Meaning                                                                                                                                                                                                             |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Workflow                                     | A named automation (namespace + name) with versions, a current version, an active schedule and an on/off state (_platform_)                                                                                         |
| Workflow version                             | One immutable published DSL document                                                                                                                                                                                |
| Definition                                   | Our model of a document, built by its factory together with the list of every problem found                                                                                                                         |
| Task                                         | `do`, `for`, `fork`, `switch`, `try`, `set`, `raise`, `call`, `emit`, `wait`, `listen`, `run` (workflow, script, shell)                                                                                             |
| Task reference                               | A JSON Pointer such as `/do/0/tryGetPet/try/0/getPet`                                                                                                                                                               |
| Stages                                       | `if`, input schema, `input.from`, the work, `output.as`, output schema, `export.as`, export schema                                                                                                                  |
| Workflow / task instance                     | One execution, in the standard's phases. A skipped task is recorded with no phase.                                                                                                                                  |
| Round (_platform_)                           | The instance hands out work, the outside computes it, and the instance records the results                                                                                                                          |
| Work (_platform_)                            | Four kinds the domain cannot compute: **evaluation** (jq expression, template or pattern match), **validation** (JSON Schema), **service call** (HTTP or OpenAPI), **process run** (script or shell in the sandbox) |
| Origin (_platform_)                          | Who started an instance: a user, a recurring schedule, an `after` chain, a trigger, or a parent task                                                                                                                |
| Schedule, epoch (_platform_)                 | `every`, `cron`, `after`, `on`, or none. The epoch changes whenever the active schedule changes.                                                                                                                    |
| Event                                        | A CloudEvent accepted or produced by the platform, unique by source and id                                                                                                                                          |
| Event filter                                 | The standard's `with` attributes and `correlate` keys                                                                                                                                                               |
| Correlation                                  | One consumption context of a `listen` task or of a schedule's `on`                                                                                                                                                  |
| Lifecycle event                              | The standard's notice of a workflow or task change                                                                                                                                                                  |
| Webhook, subscription, delivery (_platform_) | As in the spec                                                                                                                                                                                                      |
| Secret                                       | A named credential owned by a user                                                                                                                                                                                  |

## 3. Event storming

| Command                                | Aggregate                                                 | Domain events (outbox)                                                                                                                                       | Reaction                                                                                                                                        |
| -------------------------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Publish, turn on, turn off             | Workflow                                                  | RecurringScheduleSet, RecurringScheduleCleared, NextStartDue                                                                                                 | RegisterRecurringStarts, RemoveRecurringStarts, StartScheduledInstance                                                                          |
| Start instance                         | WorkflowInstance                                          | — (the run starts in the same transaction)                                                                                                                   | —                                                                                                                                               |
| Advance (a round)                      | WorkflowInstance; produced Events in the same transaction | ListenStarted, ListenEnded, SubWorkflowRequested, CancelRequested, ProcessDetached, SubWorkflowEnded, NextStartDue; EventAccepted (from the produced Events) | StartCorrelation, EndCorrelation, StartSubWorkflow, CancelInstance, RunDetachedProcess, CompleteSubWorkflow, StartScheduledInstance, RouteEvent |
| Suspend, resume, cancel                | WorkflowInstance                                          | ListenEnded, CancelRequested, plus lifecycle Events                                                                                                          | as above                                                                                                                                        |
| Accept event (intake, webhook)         | Event                                                     | EventAccepted                                                                                                                                                | RouteEvent                                                                                                                                      |
| Route event                            | — (fan-out through the `EventOffers` port)                | —                                                                                                                                                            | OfferEvent, OfferTrigger, OfferDelivery                                                                                                         |
| Start correlation                      | Correlation                                               | CorrelationStarted                                                                                                                                           | CatchUpCorrelation                                                                                                                              |
| Offer event                            | Correlation                                               | EventConsumed, CorrelationCompleted, TriggerSatisfied                                                                                                        | ConsumeListenEvent, CompleteListen, StartTriggeredInstance                                                                                      |
| Offer delivery                         | Delivery                                                  | DeliveryScheduled                                                                                                                                            | DeliverEvent                                                                                                                                    |
| Webhook, subscription, secret commands | Webhook, Subscription, Secret                             | —                                                                                                                                                            | —                                                                                                                                               |

## 4. Use cases

C = command, Q = query. All are linear; guard clauses are allowed.

| Module    | Commands                                                                                                                                                                                                                                      | Queries                                                                                              |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| workflows | PublishVersion, TurnWorkflowOn, TurnWorkflowOff, RegisterRecurringStarts, RemoveRecurringStarts                                                                                                                                               | CheckDocument, ListWorkflows, GetWorkflow, ListVersions, GetVersionDocument, GetConformanceStatement |
| instances | StartInstance, StartScheduledInstance, StartTriggeredInstance, StartSubWorkflow, AdvanceInstance, FaultInstance, SuspendInstance, ResumeInstance, CancelInstance, CompleteListen, ConsumeListenEvent, CompleteSubWorkflow, RunDetachedProcess | GetProgress, ListInstances, GetInstance, ListTaskRecords, ListLifecycleEvents                        |
| events    | AcceptEvent, ReceiveWebhookCall, RouteEvent, OfferEvent, OfferTrigger, OfferDelivery, StartCorrelation, CatchUpCorrelation, EndCorrelation, DeliverEvent, CreateWebhook, DeleteWebhook, CreateSubscription, DeleteSubscription                | ListWebhooks, ListSubscriptions, GetSubscription                                                     |
| secrets   | CreateSecret, ReplaceSecret, DeleteSecret                                                                                                                                                                                                     | ListSecrets                                                                                          |

## 5. Aggregates

There are nine. References between them are ids (Khorikov, "Link to an aggregate: reference or Id?"; Drizzle has no lazy loading). Repositories have one `save` (an upsert with an optimistic lock that raises `StaleWriteError`), and write-once aggregates use `add`. Every non-HTTP creation has a derived id, so a repeated reaction finds the row and stops.

### Workflow

- **Protects:**
  - the current version;
  - on/off;
  - the active schedule;
  - the epoch that makes stale starts harmless.
- **Fields:** `id`, `namespace`, `name`, `isOn`, `currentVersionId`, `schedule`, `epoch`, `version`, `#events`.
- **Behaviour:**
  - `register(identity)`.
  - `publish(version)`, `turnOn()` and `turnOff()` replace the active schedule through one step: `previous.deactivate()` followed by `next.activate(epoch)`. Repeating on or off is a no-op.
  - `assertStartable(epoch)`.
- **Schedule kinds (polymorphic):**
  - `NoSchedule` and `EventSchedule` raise nothing; the trigger types are derived on the row.
  - `CronSchedule` and `IntervalSchedule` raise `RecurringScheduleSet` on activation and `RecurringScheduleCleared` on deactivation.
  - `AfterSchedule` raises `NextStartDue(delay 0)` on activation.

### WorkflowVersion (write-once)

- **Protects:** a published document never changes.
- **Fields:** `id`, `workflowId`, `semver`, `dslVersion`, `source` (SourceDocument: format, text, fingerprint), `definition`, `publisherId`, `publishedAt`.
- **Behaviour:** `publish({ workflow, build, report, publisher })` throws `DefinitionRejectedError` with every problem when the report is not clean. `SourceDocument.confirmSame` owns the conflict between two documents under one identity.

### WorkflowInstance

- **Protects:**
  - phases;
  - which tasks run;
  - stage order, joins, iterations, catch and retry;
  - deadlines, data limits and the execution limit;
  - each result accepted once;
  - lifecycle order;
  - closing every listen and child it abandons.
- **Fields:**
  - `id`, `workflowId`, `versionId`, `phase`;
  - `input`, `output`, `error`, `context`;
  - `origin`, `startedAt`, `endedAt`, `deadline`;
  - `executions`, `limits` (a DataLimits snapshot taken at start), `sequence`;
  - `tasks` (active TaskInstances), `version`, `#events`, `#produced` (the Events created in this change).
- **Behaviour:**
  - `start({ version, input, inputCheck, origin, limits, now })`:
    - a missing input becomes `{}`;
    - a failed `inputCheck` throws `InputRejectedError` for API starts;
    - for a child, the same failure gives an instance that starts faulted, with the validation error.
  - `beginRound(definition, secrets, now)`:
    - starts the due tasks and issues their work;
    - faults with an authorization error any task that names a missing secret, so its work is never issued;
    - produces `workflow.started`, `task.created` and `task.started`.
  - `pendingWork()` (query) returns RoundWork:
    - evaluations, validations, calls and processes;
    - as plain data, with `$context`, `$input`, `$output`, `$workflow`, `$task`, `$runtime` and `$authorization` (from an earlier ServiceResult);
    - with each item's deadline.
  - `record(results, secrets, definition, now)`:
    - masks the secret values;
    - accepts each result once, by work id;
    - decides what follows;
    - calls `abandon()` on every task it cancels, which raises `ListenEnded` or `CancelRequested`;
    - produces lifecycle and emitted Events through `Event.produced`, where `LifecycleEvent` owns the 64 KiB rule.

    A `run` task with `await: false` completes with its transformed input and raises `ProcessDetached`.

  - `takeProducedEvents()`.
  - `suspend`, `resume`, `cancel`.
  - `completeListen`, `consumeListenEvent`, `completeSubWorkflow`.
  - `fault(failure, secrets, now)`, which masks the failure first.
  - `spawn(taskId, target, inputCheck, now)` returns the child, always. The parent task parks on it.
- **Ending.** On ending, the origin decides what follows:
  - `ParentOrigin` raises `SubWorkflowEnded` when the parent awaits;
  - `AfterOrigin` raises `NextStartDue(delay)` when the instance **completed** (the standard: "after it completes");
  - the other origins raise nothing.

**TaskInstance** is an entity with a local identity:

- **Fields:** `id`, `reference`, `name`, `parentId`, `status`, `rawInput`, `input`, `output`, `error`, `startedAt`, `endedAt`, `deadline`, `progress`.
- **Progress** (from `language/progress`) is created by `task.begin(rawInput)`, tracks the stages and decides for its kind:
  - `LeafProgress` covers set, raise, call, emit, script and shell;
  - `DoProgress`, `ForProgress`, `ForkProgress`, `SwitchProgress`, `WaitProgress`;
  - `TryProgress` owns the attempts;
  - `ListenProgress` holds the `foreach` FIFO;
  - `SubWorkflowProgress`.
- **Abandon.** `abandon()` closes what the task holds.

### Event (write-once entity)

- **Is:** the unit of acceptance and routing.
- **Uniqueness:** source + id is unique, enforced by an index; `add` returns `false` for a duplicate.
- **Fields:** `id`, `source`, `eventId`, `type`, `time`, `subject`, `dataContentType`, `dataSchema`, `data`, `extensions`, `origin` (intake, webhook, emit or lifecycle, with the workflow and instance ids), `sequence`, `acceptedAt`.
- **Behaviour:** `accept(input)` (intake, webhook) and `produced(input)` (lifecycle, emit). Both raise `EventAccepted`.

### Correlation

- **Protects:** one consumption context: what it has consumed, the expected values, and when it is satisfied.
- **Fields:** `id`, `owner` (an interface: `ListenOwner` or `TriggerOwner`), `strategy` (of EventFilters), `since`, `expected`, `consumed`, `status`, `version`.
- **Behaviour:**
  - `start(owner, strategy, since)` raises `CorrelationStarted`.
  - `forTrigger(workflow, epoch, open, results)`.
  - `evaluationsFor(event)` delegates to the strategy's EventFilters.
  - `offer(event, results)`:
    1. ignores events that are old, already consumed, or (TriggerOwner) produced by its own workflow;
    2. fixes or checks the correlation values;
    3. lets the owner raise `EventConsumed`, `CorrelationCompleted` or `TriggerSatisfied`.
  - `end()`.

### Webhook

- **Protects:**
  - the URL secret is stored only as a fingerprint;
  - each call becomes an event of the declared type and source, with `Authorization` and `Cookie` dropped.
- **Fields:** `id`, `name`, `eventType`, `tokenFingerprint`, `ownerId`, `createdAt`.
- **Behaviour:** `create(input)` takes a WebhookToken. `receive(call, now)` returns the props for `Event.accept`.

### Subscription

- **Protects:** authentication only with the owner's secrets.
- **Fields:** `id`, `name`, `endpoint`, `filter` (an EventFilter), `ownerId`, `createdAt`.
- **Behaviour:** `create(input, ownedSecretNames)`.

### Delivery

- **Protects:**
  - a subscriber's view of one event;
  - the 24-hour limit;
  - masking of echoed credentials in its error.
- **Fields:** `id`, `subscriptionId`, `eventId`, `status`, `attempts`, `lastError`, `firstAttemptAt`, `lastAttemptAt`, `version`.
- **Behaviour:**
  - `plan(event, subscription, results)` returns a Delivery when the filter accepts (raising `DeliveryScheduled`), otherwise null.
  - `record(attempt, secrets, now)`.

### Secret

- **Protects:** a credential belongs to one owner.
- **Fields:** `id`, `ownerId`, `name`, `value` (SecretValue, read only by the repository mapper through `reveal()`), `createdAt`, `updatedAt`, `version`.
- **Behaviour:** `create`, `replace`. Removal goes through `remove`.
- **SecretValues** is a value object built only by `SecretQueries`. It offers `has(name)`, `valueOf(name)` and `mask(json)`.

## 6. Language model (module `language`)

- **`Definition.build(parsed)`.** The factory takes the reader's ParsedDocument, a plain tree in the standard's shape that holds no SDK types. It returns a `DefinitionBuild`: the Definition, or none, plus **every** problem with its JSON Pointer:
  - constructs outside `SupportedSubset` (including script `source`);
  - duplicate names in a scope;
  - a reusable component (function, retry policy, error, timeout, authentication) named but not declared in `use`;
  - flow directives outside their scope;
  - a fork with no branches;
  - negative limits.

  Constructors keep guard clauses only, as a second line of defence (Khorikov, "Always-Valid Domain Model").

- **`Definition`:** `dslVersion`, `input`/`output` (DataSpec), `timeout`, `schedule`, `evaluation`, `authentications`, `secretNames`, `body`. Each task keeps its parsed JSON for `$task.definition` and `$workflow.definition`.
- **`Task`** (an interface): `name`, `reference`, `condition`, `data`, `timeout`, `then`, `secretNames`, `begin(rawInput)`.
- **Task kinds:**
  - `DoTask`, `ForTask`, `ForkTask`, `SwitchTask` (`select`), `TryTask`;
  - `SetTask`, `RaiseTask`, `CallTask`, `EmitTask`, `WaitTask`, `ListenTask`;
  - `RunWorkflowTask`, `RunScriptTask`, `RunShellTask`, which differ only in how they build a `ProcessRun`.
- **Templates.** Each leaf kind holds its spec as a template: JSON with `${}` leaves.
- **Process results** are polymorphic:
  - `ProcessExited.outcome(ProcessReturn)`: the output follows `return`, stdout and stderr are strings, and a non-zero exit is not an error;
  - `ProcessTimedOut` gives a timeout error;
  - `SandboxFailed` gives a runtime error.
- **`EventFilter`:** `evaluationsFor(event)` (PatternMatch and Evaluation work) and `accepts(results)`. It is the only owner of `with` and `correlate` matching, for correlations and subscriptions alike.
- **Values:**
  - `TaskList`, `FlowDirective`, `Expression`, `DataSpec`;
  - `CatchClause`, `ErrorFilter`, `RetryPolicy` (`allows`, `delayFor(attempt, jitterSample)`), `Backoff` kinds;
  - `ErrorType`, `WorkflowError`;
  - `Schedule` kinds, `ConsumptionStrategy`, `SemanticVersion`, `SupportedSubset`;
  - `DocumentReferences` (`check(facts)`: only the publisher's secrets, published targets).

## 7. Execution model

**Work and results** (`language/work`, `language/results`):

| Work           | Content                                                                                        | Result                                                                                                                                |
| -------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `Evaluation`   | Work id; expression or template; data; arguments; expected type (any, boolean, duration); mode | `EvaluationResult`: a value (durations in ms), or a failure                                                                           |
| `PatternMatch` | Work id; value; regular expression                                                             | `EvaluationResult`: a boolean                                                                                                         |
| `Validation`   | Work id, schema, data                                                                          | `ValidationResult`                                                                                                                    |
| `ServiceCall`  | Work id; an evaluated HTTP or OpenAPI request; authentication policy; deadline                 | `ServiceResult`: the content or response plus the `$authorization` descriptor (masked); or `TimedOut` / `CommunicationFailed(status)` |
| `ProcessRun`   | Work id; script (language, code) or shell command; arguments; environment; stdin; deadline     | `ProcessExited`, `ProcessTimedOut` or `SandboxFailed`                                                                                 |

**Stage plan of a leaf task.** One line per round. Independent pure items share a round:

1. `if`, input schema and `input.from`, on the raw input;
2. the template;
3. the service call or process run;
4. `output.as` and `export.as`;
5. the output and export schemas.

Composites run lines 1, 4 and 5 around their children. `wait`, `listen` and `run: workflow` park after line 2, and lines 4 and 5 follow when they resume. A recorded result is never computed again (FR-018).

**Who decides what:**

| Result                            | Decision                            | Owner                                    |
| --------------------------------- | ----------------------------------- | ---------------------------------------- |
| `if` value                        | skip or proceed                     | WorkflowInstance                         |
| Missing secret                    | authorization error, no work issued | WorkflowInstance.beginRound              |
| Failed validation or evaluation   | validation or expression error      | ErrorType                                |
| `TimedOut`, `CommunicationFailed` | timeout or communication error      | ErrorType                                |
| Process result                    | completion or fault                 | the ProcessResult kind, ProcessReturn    |
| Case values                       | the branch                          | SwitchTask.select                        |
| Fault                             | catch, retry, delay                 | ErrorFilter, RetryPolicy, TryProgress    |
| Branch outputs                    | join, compete, export order         | ForkProgress                             |
| Any cancelled task                | close its correlation or child      | the task's progress, through `abandon()` |

## 8. State machines

**Instance:**

| From             | To                 | When                                |
| ---------------- | ------------------ | ----------------------------------- |
| pending          | running            | first round                         |
| running          | waiting            | all active tasks parked             |
| waiting          | running            | deadline, event, or child end       |
| running, waiting | suspended          | suspend                             |
| suspended        | running or waiting | resume                              |
| any non-terminal | cancelled          | cancel                              |
| pending          | faulted            | a child whose input is rejected     |
| running          | faulted            | error, timeout, limit, engine fault |
| running          | completed          | end                                 |

**Task:** pending → running → (waiting ↔ running) → completed, faulted or cancelled.

**Correlation:** active → completed or ended.

**Delivery:** pending → delivered, or failed after 24 hours.

## 9. Rule owners

| Rule                                                                                              | Owner                                                            |
| ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| A published document never changes; conflict under the same identity                              | SourceDocument, plus the unique index                            |
| Current version, on/off, schedule replacement, epoch, stale starts                                | Workflow and the Schedule kinds                                  |
| Document syntax and the standard's schema                                                         | DocumentReader (adapter, input contract)                         |
| Subset, duplicate names, directive scope, structural limits, every problem with its pointer       | Definition.build                                                 |
| Expression syntax                                                                                 | ExpressionEvaluator.check (adapter), reported through the report |
| Only the publisher's secrets; published targets                                                   | DocumentReferences.check                                         |
| A report with problems rejects publication                                                        | WorkflowVersion.publish                                          |
| The input schema; missing input means `{}`; a rejected child input                                | WorkflowInstance.start                                           |
| A missing secret is an authorization error                                                        | WorkflowInstance.beginRound                                      |
| Stages, skip, next task, limits, timeouts, phases, control, result accepted once, lifecycle order | WorkflowInstance, TaskList, progress objects                     |
| Abandoned listens and children are closed                                                         | progress `abandon()`                                             |
| `await: false` detaches the process                                                               | WorkflowInstance (ProcessDetached)                               |
| Lifecycle event shape, sequence, 64 KiB output                                                    | LifecycleEvent                                                   |
| Masking: records, faults, delivery errors                                                         | SecretValues, used by WorkflowInstance, Delivery                 |
| Encryption at rest                                                                                | DrizzleSecretRepository                                          |
| What follows an instance's end                                                                    | Origin kinds                                                     |
| Event acceptance once                                                                             | the Event index and `add`                                        |
| `with` and `correlate` matching                                                                   | EventFilter                                                      |
| Consumption, `since`, `until`, no self-trigger                                                    | Correlation and its owner                                        |
| Header drop on webhook calls                                                                      | Webhook.receive                                                  |
| Subscription authenticates only with owner's secrets                                              | Subscription.create                                              |
| Delivery outcome and 24-hour limit                                                                | Delivery                                                         |
| Access by role                                                                                    | `@Can` policies                                                  |

## 10. Domain errors

| Error                                                                                                                                    | Base               | HTTP |
| ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------ | ---- |
| DefinitionRejectedError (report), InputRejectedError (WorkflowError), ForeignSecretError                                                 | RuleViolationError | 422  |
| StaleWriteError (any optimistic conflict), VersionConflictError, InvalidControlError                                                     | ConflictError      | 409  |
| WorkflowNotFoundError, VersionNotFoundError, InstanceNotFoundError, WebhookNotFoundError, SubscriptionNotFoundError, SecretNotFoundError | NotFoundError      | 404  |
| StaleStartError                                                                                                                          | RuleViolationError | —    |

Run-time workflow errors are WorkflowError values.

## 11. Persistence (PostgreSQL, Drizzle)

| Table               | Key columns                                                                                                                                                              | Notes                                                                                     |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| `workflow`          | id, namespace, name, is_on, current_version_id, schedule, trigger_types text[], epoch, version                                                                           | unique (namespace, name); GIN on trigger_types                                            |
| `workflow_version`  | id, workflow_id, semver, dsl_version, source_format, source_text, fingerprint, definition, publisher_id, published_at                                                    | unique (workflow_id, semver)                                                              |
| `workflow_instance` | id, workflow_id, version_id, phase, input, output, error, context, origin, limits, started_at, ended_at, deadline, executions, sequence, progress_kind, wake_at, version | the progress columns serve GetProgress                                                    |
| `task_instance`     | id, instance_id, reference, name, kind, parent_id, status, raw_input, input, output, error, attempts, progress, started_at, ended_at, deadline                           | active rows load with the aggregate; `attempts` is a read column written from TryProgress |
| `event`             | id, source, event_id, type, time, subject, data_content_type, data_schema, data, extensions, origin_kind, origin_workflow_id, origin_instance_id, sequence, accepted_at  | unique (source, event_id); indexes (type, accepted_at) and (origin_instance_id, sequence) |
| `correlation`       | id, owner_kind, instance_id, task_instance_id, workflow_id, epoch, filter_types text[], strategy, since, expected, consumed, status, version                             | GIN on filter_types; `*` marks a filter without an exact type                             |
| `webhook`           | id, name, event_type, token_fingerprint, owner_id, created_at                                                                                                            | unique token_fingerprint                                                                  |
| `subscription`      | id, name, endpoint_uri, auth_scheme, auth_secret, filter, filter_types text[], owner_id, created_at                                                                      | GIN on filter_types                                                                       |
| `delivery`          | id, subscription_id, event_id, status, attempts, last_error, first_attempt_at, last_attempt_at, version                                                                  | unique (subscription_id, event_id)                                                        |
| `secret`            | id, owner_id, name, ciphertext, created_at, updated_at, version                                                                                                          | unique (owner_id, name)                                                                   |
| `idempotency_key`   | the module's contract                                                                                                                                                    |                                                                                           |

The libraries own `nest_workflows` and `nest_outbox`.

## 12. Khorikov posts behind each building block (AR-001)

| Building block           | Where                                                                                                                                               | Post                                                                                                         |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Entity vs value object   | TaskInstance is an entity; progress objects, work, results, filters and specs are value objects                                                     | "Entity vs Value Object: the ultimate list of differences"; "Classes internal to an aggregate"               |
| Aggregates and set rules | nine aggregates; uniqueness by index; derived ids                                                                                                   | "Email uniqueness as an aggregate invariant"                                                                 |
| References               | by id                                                                                                                                               | "Link to an aggregate: reference or Id?"                                                                     |
| Domain events            | only across separately advancing aggregates or beyond the database (research R4); produced Events are written explicitly in the round's transaction | "Domain events: simple and reliable solution"                                                                |
| Application services     | linear orchestration                                                                                                                                | "Domain services vs Application services"                                                                    |
| Purity                   | work out, results in; time, jitter samples, limits and secrets passed as values                                                                     | "Domain model purity vs. completeness"; "Domain model purity and the current time"; "Immutable architecture" |
| Always valid             | factories return every problem; constructors guard                                                                                                  | "Always-Valid Domain Model"                                                                                  |
| Repositories, CQS        | one repository per aggregate; queries read into read models                                                                                         | "Having the domain model separated from the persistence model"; "Types of CQRS"                              |
| Encapsulation            | progress objects, owners, schedule kinds, origins and filters decide for themselves                                                                 | "Encapsulation revisited"                                                                                    |
