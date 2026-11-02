# Data Model: Workflow Engine

The design follows the DDD steps in order: language, event storming, use cases, aggregates, rule owners, model. Mechanics are in [architecture.md](architecture.md) and decisions in [research.md](research.md). Every element exists because a requirement needs it (research R20). The critics' second-round fixes are applied (R22).

## 1. Bounded context and modules

There is one new bounded context, **automation**, next to **identity**, whose `User` its policies read. The modules follow business capability:

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
| Definition                                   | Our model of a document, mapped from the document the standard's SDK validated; its value objects keep the invariants of a runnable model                                                                           |
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

| Command                                | Aggregate                                                 | Domain events (outbox)                                                                                                                                                                | Reaction                                                                                                                                                                                        |
| -------------------------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Publish, turn on, turn off             | Workflow                                                  | RecurringScheduleSet, RecurringScheduleCleared, NextStartDue                                                                                                                          | RegisterRecurringStarts, RemoveRecurringStarts, StartScheduledInstance                                                                                                                          |
| Start instance                         | WorkflowInstance                                          | — (the run starts in the same transaction)                                                                                                                                            | —                                                                                                                                                                                               |
| Advance (a round)                      | WorkflowInstance; produced Events in the same transaction | ProcessDetached, WorkflowDetached; from later stories: ListenStarted, ListenEnded (US7), CancelRequested (US9), NextStartDue (US4), EventAccepted from the produced Events (US6, US7) | RunDetachedProcess, StartDetachedWorkflow; StartCorrelation, EndCorrelation, CancelInstance, StartScheduledInstance, RouteEvent. Sub-workflows run as steps of the engine run (architecture §4) |
| Suspend, resume, cancel                | WorkflowInstance                                          | ListenEnded, CancelRequested, plus lifecycle Events                                                                                                                                   | as above                                                                                                                                                                                        |
| Accept event (intake, webhook)         | Event                                                     | EventAccepted                                                                                                                                                                         | RouteEvent                                                                                                                                                                                      |
| Route event                            | — (fan-out through the `EventOffers` port)                | —                                                                                                                                                                                     | OfferEvent, OfferTrigger, OfferDelivery                                                                                                                                                         |
| Start correlation                      | Correlation                                               | CorrelationStarted                                                                                                                                                                    | CatchUpCorrelation                                                                                                                                                                              |
| Offer event                            | Correlation                                               | EventConsumed, CorrelationCompleted, TriggerSatisfied                                                                                                                                 | ConsumeListenEvent, CompleteListen, StartTriggeredInstance                                                                                                                                      |
| Offer delivery                         | Delivery                                                  | DeliveryScheduled                                                                                                                                                                     | DeliverEvent                                                                                                                                                                                    |
| Webhook, subscription, secret commands | Webhook, Subscription, Secret                             | —                                                                                                                                                                                     | —                                                                                                                                                                                               |

## 4. Use cases

C = command, Q = query. All are linear; guard clauses are allowed.

| Module    | Commands                                                                                                                                                                                                                                                                | Queries                                                                                              |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| workflows | PublishVersion, TurnWorkflowOn, TurnWorkflowOff, RegisterRecurringStarts, RemoveRecurringStarts                                                                                                                                                                         | CheckDocument, ListWorkflows, GetWorkflow, ListVersions, GetVersionDocument, GetConformanceStatement |
| instances | StartInstance, StartScheduledInstance, StartTriggeredInstance, StartSubWorkflow, AdvanceInstance (BeginRound, RecordRound), FaultInstance, SuspendInstance, ResumeInstance, CancelInstance, CompleteListen, ConsumeListenEvent, CompleteSubWorkflow, RunDetachedProcess | ListInstances, GetInstance, ListTaskRecords, ListLifecycleEvents                                     |
| events    | AcceptEvent, ReceiveWebhookCall, RouteEvent, OfferEvent, OfferTrigger, OfferDelivery, StartCorrelation, CatchUpCorrelation, EndCorrelation, DeliverEvent, CreateWebhook, DeleteWebhook, CreateSubscription, DeleteSubscription                                          | ListWebhooks, ListSubscriptions, GetSubscription                                                     |
| secrets   | CreateSecret, ReplaceSecret, DeleteSecret                                                                                                                                                                                                                               | ListSecrets                                                                                          |

## 5. Aggregates

There are nine. References between them are ids (Khorikov, "Link to an aggregate: reference or Id?"; Drizzle has no lazy loading). Repositories have one `save` (an upsert with an optimistic lock that raises `StaleWriteError`), and write-once aggregates use `add`. Every non-HTTP creation has a derived id, so a repeated reaction finds the row and stops.

### Workflow

- **Protects:**
  - the current version;
  - on/off;
  - the active schedule;
  - the epoch that makes stale starts harmless.
- **Fields:** `id`, `name` (WorkflowName), `isOn`, `currentVersionId`, `schedule`, `epoch`, `version`, `#events`.
- **Behaviour:**
  - `register(name)`.
  - `publish({ definition, source, publisherId, now })` creates the WorkflowVersion and makes it current; it refuses a definition of another workflow (the only statement of that rule).
  - `publish`, `turnOn()` and `turnOff()` replace the active schedule through one step: `previous.deactivate()` followed by `next.activate(epoch)`. Repeating on or off is a no-op.
  - `assertStartable(epoch)`.
- **Schedule kinds (polymorphic):**
  - `NoSchedule` and `EventSchedule` raise nothing; the trigger types are derived on the row.
  - `CronSchedule` and `IntervalSchedule` raise `RecurringScheduleSet` on activation and `RecurringScheduleCleared` on deactivation.
  - `AfterSchedule` raises `NextStartDue(delay 0)` on activation.

### WorkflowVersion (write-once)

- **Protects:** a published document never changes.
- **Fields:** `id`, `workflowId`, `semver`, `dslVersion` (DslVersion), `source` (SourceDocument: format and text; the fingerprint is derived from the text), `publisherId`, `publishedAt`.
- **Behaviour:** created only by `Workflow.publish`, which takes `semver` and `dslVersion` from the definition; the definition comes from `CheckDocument`. `confirmSame(source)` delegates to `SourceDocument.confirmSame`, which owns the conflict between two documents under one identity. A run reads the version's Definition from its source through `DefinitionReader` (US2).

### WorkflowInstance

- **Protects:**
  - phases;
  - which tasks run, in the order the flow directives give;
  - stage order, joins, iterations, catch and retry;
  - workflow and task timeouts;
  - each result accepted once;
  - lifecycle order.
- **Fields:**
  - `id`, `workflowId`, `versionId`, `workflow` (WorkflowName) and `semver`, which the lifecycle events and the definition check need even when the definition cannot be read;
  - `phase`, `input`, `output`, `error`, `context`;
  - `origin`, `startedAt`, `endedAt`;
  - `executions` (TaskInstances created so far: it derives each task's id, and US3 bounds it);
  - `tasks` (TaskInstances), `version`;
  - an internal `ProducedEvents` (the lifecycle sequence and the Events created in this change) and the domain events.
- **Behaviour (US2):**
  - `start({ id, workflow, version, input, origin, now })`: a missing input becomes `{}`. The root task validates the input schema in its first stage, so an input that breaks it faults the instance with a validation error (dsl.md, "Workflow Input").
  - Every round method takes the Definition, `$runtime` and the time, and refuses a Definition of another workflow or version.
  - `beginRound(definition, runtime, now)`: starts the workflow when it is pending, fires elapsed deadlines and the retries that are due, and starts the tasks that follow.
  - `pendingWork(definition, runtime, now)` (query) returns RoundWork: every active task's work for its current stage, with the stage's runtime arguments (section 7). Work the outside did not start (a full bulkhead) gets no result and stays pending.
  - `record(results, definition, runtime, now)`:
    - accepts each result once, by work id; work ids are positional, because a task's id derives from the instance id and its execution number, so `RecordRound` replays the same results on the reloaded instance;
    - advances each task's progress, which decides what follows;
    - abandons the active children of a task whose body no longer runs (a competing fork's losers, a timed-out or faulted composite);
    - ends the instance when its root task ends.
  - `fault(now)`: an engine failure ends the instance with a runtime error, from pending or any later phase that is not terminal.
  - `requestedSubWorkflows()` (query) lists the `run: workflow` tasks that have requested a sub-workflow, awaited or not, with the derived id of its instance. `answerSubWorkflow(instanceId, workflow, version, …)` answers a request through the task's progress with one of the language's `SubWorkflowAnswer`s: `SubWorkflowRefused` when the workflow or version is missing (a configuration error at the `run` task); `SubWorkflowDetached` for a task with `await: false` (it completes with its transformed input and raises `WorkflowDetached` with the resolved version id); for an awaited one it returns the new sub-workflow instance (`WorkflowInstance.startSubWorkflow`, with a `ParentOrigin`) for the caller to save. It refuses a workflow other than the one the task names. `completeSubWorkflow(instanceId, ending, …)` answers with `SubWorkflowEnded`, which takes the sub-workflow's ending by value (phase, output, error, read by a query): its output completes the task, its error faults it located at the `run` task, and an end without a result faults it with a runtime error; a detached request ignores it. Both do nothing on a terminal instance or a task that no longer requests.
  - `progress(now)` (query) returns plain data: ended, run again, or park until a time, plus the ids of the sub-workflows the instance awaits. The engine run follows it.
  - `takeProducedEvents()` and `takeDomainEvents()`.
  - A task that ends hands its requests to the instance once, in its `TaskEnding`: the emitted `CloudEvent`, a detached process (`ProcessDetached`, which carries the `ProcessRun`) or a detached workflow (`WorkflowDetached`, which carries the derived instance id, the resolved workflow and version and the input), so their handlers need nothing else.
- **Lifecycle events** (`LifecycleEvent`, `LifecycleEventType`): `workflow.started` in the first round, then `task.created` and `task.started` once a task's `if` passes (a skipped task produces none, FR-015), `task.retried` for the `try` task when a retry starts, `task.completed` or `task.faulted`, `task.cancelled` only for a task that was announced, and `workflow.completed` or `workflow.faulted`. The root task produces no task events. `name` and `workflow` carry the instance's qualified name, `{name}-{id}.{namespace}` like the standard's example. A lifecycle event becomes an `Event` directly (`Event.lifecycle`), with the standard's data and the task's or workflow's whole output; the CloudEvent JSON format and its 64 KiB rule belong to the adapters that write it (R16).
- **Later stories:** limits (US3), `wait` (US3), `listen` and correlations (US7), secrets and masking (US8), suspend, resume, cancel and `abandon()` (US9), the scheduled and triggered origins (US4). Until US9, a sub-workflow whose parent task ends early (a timeout, a `compete` loser, a caught branch) runs to its end, and its result is ignored.
- **Ending.** A sub-workflow's end reaches its parent through the engine, which signals the parent's run in the transaction that ends the sub-workflow (architecture §4). `ParentOrigin` records the parent instance and task.

**TaskInstance** is an entity with a local identity:

- **Fields:** `id` (derived), `reference`, `name`, `parentId`, `cancelled`, `rawInput`, `variables` (the iteration and catch variables it inherits), `retries`, `startedAt`, `endedAt`, `progress`. Its phase, output and error are read from its progress, so they cannot contradict it; only a cancellation is its own. A skipped task has no phase, and its raw input becomes its output (FR-015). The workflow itself is the root TaskInstance: it runs `Definition.root`.
- **One execution, one TaskInstance.** Every attempt, loop iteration and re-entry through `then` is a new TaskInstance with its own id, so its history and its work ids never collide.
- **Progress** (`TaskProgress`, from `language/stages`) begins with `EntryStage.begin(scope)` and decides for its task (section 7). It keeps only state (stage, counters, collected outputs) and receives its Task through a `TaskScope` built from `definition.taskAt(reference)` in each call, so it is stored without the Definition.

### Event (write-once entity)

- **Is:** the unit of acceptance and routing.
- **Uniqueness:** source + id is unique, enforced by an index; `add` returns `false` for a duplicate.
- **Fields:** `id`, `source`, `eventId`, `type`, `time`, `subject`, `dataContentType`, `dataSchema`, `data`, `extensions`, `origin` (emit or lifecycle, with the workflow and instance ids; intake and webhook join with US7 and US5), `sequence`, `acceptedAt`.
- **Behaviour:** `lifecycle(input)` takes the typed values of a lifecycle event (source, sequence as id, type, time, data, and the time of the round that recorded it as `acceptedAt`); `emitted(input)` takes the `CloudEvent` an `emit` task produced. Neither passes through JSON. `accept(input)` (intake, webhook) and `EventAccepted` join with US7 (T058).

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

The names follow the standard. Where a library export or the platform's access policies already use a name (`Policy`, `Retry`, `RetryPolicy`, `Duration`, `Catch`), the domain picks another one.

**What publishing checks.** Publishing checks a document the way a compiler checks code. The split follows Khorikov's "Always-Valid Domain Model": input is validated at the boundary with the domain's knowledge, and invariants stay in the domain.

- **Input validation (documents adapter).** The first problem found refuses the document:
  - the standard's SDK checks the schema, the DSL range and duplicate task names (`InvalidDocumentError`);
  - the mappers refuse what the domain cannot represent (`UnsupportedConstructError`): a DSL version outside 1.0.0–1.0.3, `evaluate` other than `strict` with jq, a schema by `resource` or in a format other than `json`, years, months or weeks in a duration, backoff parameters, `limit.attempt.duration`, `return` on `run: workflow`, the `$secrets` argument in any expression (until US8), OAuth2 or OIDC settings outside client credentials with a client secret (`ClientCredentialsMapper`), and any property a mapper does not read where the standard's schema leaves the object open (`KnownPropertiesMapper`); an `evaluate` that is not an object is an `InvalidDocumentError`, since the 1.0.3 schema leaves it out;
  - `ReusableComponents` refuses a name that `use` does not declare (`UndeclaredComponentError`);
  - `ExpressionEvaluator.check` checks the syntax of every expression (`InvalidExpressionError`).
- **Invariants (domain).** An object that would break one is never created:
  - `TaskList`: task names are unique, and every flow directive names `continue`, `exit`, `end` or a task of the list (`DuplicateTaskError`, `UnknownTaskError`);
  - `ForkTask`: a competing fork has a branch, and no branch names another (`EmptyCompetingForkError`, `BranchJumpError`);
  - `SwitchTask`: one default case at most (`DuplicateDefaultCaseError`);
  - `EmitTask`: the event names its source and its type, and its attribute names are lower-case letters and digits (`MalformedEventError`); at run time the evaluated event must be a CloudEvent 1.0.2 (`CloudEvent`), or the task faults with a runtime error;
  - `ForTask` and `TryTask`: `for.each`, `for.at` and `catch.as` do not name a runtime argument (`ReservedVariableError`), which would otherwise hide it;
  - `ReusableComponents`: a declared function names no task in its directives, since it runs apart from the tasks that call it (`FunctionJumpError`); its `end` ends the workflow, as in `do`, `for`, `fork` and `try`;
  - `FixedDuration`: a duration is not negative, counts no years, months or weeks, and a fraction appears only in the smallest of its hours, minutes or seconds;
  - `RetryStrategy`: an attempt count is not negative.

  The `FixedDuration` and `RetryStrategy` errors carry no location, because they are rules of the values themselves, and durations are also built at run time from jq results. The mapper turns them into an `InvalidDocumentValueError` at the value's place.

- **Run time, not publish.** These are resolved when a run needs them (US2, US8):
  - the workflows that `run` tasks name;
  - the publisher's secrets;
  - which runtime arguments and variables an expression can use at its place.

**Model:**

- **`Definition`:** `document` (the document's JSON), `workflow` (WorkflowName), `version`, `dslVersion` (DslVersion: the mapper refuses another version, the domain cannot hold one), `input`, `output`, `timeout`, `body` (TaskList) and `components` (ReusableComponents). It also gives `expressions` (every expression in the document, the declared components included), `root` (the workflow as a `do` task with the workflow's `input.from`, `output`, `timeout` and `then: end`), `taskAt(reference)` (body tasks and declared functions) and `jsonAt(pointer)`.
- **`Task`** (abstract): `name`, `reference` (JsonPointer), `base` (TaskBase), `directives` and `expressions`. US2 adds `enter(scope)`: the `BodyScope` carries the transformed input, so no kind progress keeps a copy of it. The leaf kinds decide their own results: `SetTask`, `RaiseTask` and `EmitTask` (`outcomeOf`), the call tasks (`callFrom`), the run tasks (`runFrom`).
- **`TaskBase`** (the standard's common task properties): `if`, `input`, `output`, `export`, `timeout`, `then`.
- **Task kinds** (`tasks/`):
  - flow: `DoTask`, `ForTask`, `ForkTask`, `SwitchTask` with `SwitchCase`, `TryTask` with `CatchClause`;
  - data: `SetTask`, `RaiseTask`, `EmitTask`;
  - the standard's call types: `HttpCallTask` (`endpoint`, `arguments`), `OpenApiCallTask` (`document`, `arguments`, `authentication`), `FunctionCallTask` (the name of a declared `function`, which `Definition` confirms, and its `arguments`);
  - runs: `RunWorkflowTask` (`target`, `input`), `RunScriptTask` (`language`, `script`), `RunShellTask` (`shell`).

  `WaitTask` and `ListenTask` join with US3. The constructors apply the standard's defaults: `item`, `index`, `error`, `continue`, `stdout`, `await: true`, `compete: false`.

- **Values:**
  - `TaskList`, `FlowDirective`;
  - `Expression` (`pointer`, `program`), `Template` (JSON whose `${}` leaves are expressions);
  - `Input`, `Output`, `Export`: each owns its part of the standard's data flow (its evaluations and validations, the order of its checks, and "absent means unchanged"); the stages only decide the round;
  - `Attempt` (count from zero, first start, `first(now)`, `next()`), shared by the `try` states and `RetryStrategy.allows`;
  - `FixedDuration`, `ExpressionDuration`;
  - `RetryStrategy` with its `Backoff`, and `ErrorCondition` (`when`, `exceptWhen`) shared with `CatchClause`;
  - `Schema` (a JSON Schema at its place);
  - `CatchClause`, `ErrorFilter`;
  - `Endpoint`, `Authentication`;
  - `ReusableComponents` (the declared `use`, with lookups by name);
  - `CloudEvent` (the one owner of the CloudEvents 1.0.2 rules for an evaluated `emit`: non-empty id, source and type, a URI-reference source, an RFC 3339 time, spec version `1.0`, an absolute data schema, extension names and values); it completes an emitted value with id, time and spec version (`complete`), reads it with `of(value)` and holds typed attributes, the time as a `Date`;
  - `LifecycleSource` (the platform's lifecycle sources, `/workflows/{namespace}/{name}/instances/{id}`); an emitted event may not claim one, so no `emit` can replace or impersonate a lifecycle event;
  - `SubWorkflowAnswer` (`SubWorkflowEnded`, `SubWorkflowRefused`, `SubWorkflowDetached`): what a `run: workflow` task learns about its request, each deciding the task's outcome;
  - `Phase` (the standard's status phases, an enumeration class that knows which are terminal); the stages decide a task's phase;
  - `WorkflowName` (the namespace and name that identify a workflow; the HTTP path schema and the standard's schema check the labels), `WorkflowTarget`, `JsonPointer` (owns the work id format, `idIn(prefix)`).
  - `VersionReference` (workflows module) decides which version a target names: `latest` is the workflow's current version, any other the published semver of that workflow, and a pinned id for a detached sub-workflow; repositories only fetch by it.

  The conformance statement (ER-001) is an application read model that `GetConformanceStatement` builds from the enums.

- **Later stories:** `Schedule` kinds (US4), `ConsumptionStrategy` and `EventFilter` (US7).
- **Enums** (`enums.ts`): `TaskKind`, `CallKind`, `RunKind`, `ScriptLanguage`, `AuthenticationScheme`, `FlowKeyword`, `DefaultVariable`, `ErrorProperty`, `Component`, `UnsupportedConstruct`, `DslVersion`, `Contradiction`. The sets only the documents adapter reads (`ExcludedCallKind`, `OAuth2Grant`, `EvaluationMode`, `ExpressionLanguage`, `SchemaFormat`) live in `documents/enums.ts`; single values are class constants, not enums.

  An enum holds a closed set of values. When values come to steer behaviour, the domain replaces the enum with polymorphism or an enumeration class (MS Learn, "Use enumeration classes instead of enum types"). In US2: `Backoff` (constant, linear, exponential) is polymorphic; `FlowDirective` (`continue`, `exit`, `end` or a task, through `FlowDirective.named`), `ErrorType`, `ProcessReturn` and `OutputFormat` are enumeration classes.

  Behaviour comes with the story that runs it. US1 holds the standard's values and checks them; US2 adds the run-time behaviour (`WorkflowError`, `ErrorType` as an enumeration class that carries a status, `ErrorFilter.matches`, retry delays and backoffs, duration arithmetic, `latest` resolution).

- **Process results** (US2) are polymorphic:
  - `ProcessExited.outcome(ProcessReturn)`: the output follows `return`; stdout and stderr are strings; a non-zero exit is not an error;
  - `ProcessTimedOut` gives a timeout error;
  - `SandboxFailed` gives a runtime error.
- **`EventFilter`** (US7): `evaluationsFor(event)` and `accepts(results)`. It is the only owner of `with` and `correlate` matching, for correlations and subscriptions alike.

## 7. Execution model

**Round.** A round is a functional core in an imperative shell (Khorikov, "Immutable architecture"). It is the first option of "Domain model purity vs. completeness" applied step by step: the domain stays pure and complete, because the application only computes and decides nothing; a round saves only at the boundaries of side effects (calls, processes, children, parking, the end), because expressions and schemas are pure and are computed again after a crash. The instance hands out work as data, the application computes it through four ports, and the instance records the results and decides what follows. The time and the Definition are passed as values.

**Work** (plain data in `language/interfaces.ts`; Martin: simple data crosses boundaries) and **results** (`language/results/`, each kind deciding its own outcome):

| Work          | Content                                                                                                                              | Results                                                                                                                                                                                                                                                                                                                                       |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Evaluation`  | Work id, jq program, data (`.`), arguments                                                                                           | `Evaluated(value)`; `EvaluationFailed(reason)` gives an expression error                                                                                                                                                                                                                                                                      |
| `Validation`  | Work id, JSON Schema, data                                                                                                           | `Validated`; `ValidationFailed(reason)` gives a validation error                                                                                                                                                                                                                                                                              |
| `ServiceCall` | Work id; the evaluated `http` or `openapi` request; its evaluated authentication, as plain data; the task input for the URI template | `ServiceResponded(status, headers, content, request, authorization)`, from which `CallOutput` decides the output format (`content`, `response`, `raw`), `redirect` and the status rule; `ServiceTimedOut` gives a timeout error; `AuthenticationFailed` an authentication error; `CommunicationFailed` (transport only) a communication error |
| `ProcessRun`  | Work id; `js` or `python` code, or a shell command, with its arguments and environment                                               | `ProcessExited(code, stdout, stderr)`, whose output follows `return` (a non-zero exit is not an error); `ProcessTimedOut` gives a timeout error; `SandboxFailed` a runtime error                                                                                                                                                              |

- A work id is derived from the task instance and its stage, so a recorded result is never computed again (FR-018). A retry's jitter sample is derived from the work id, which is pure and stable on replay.
- The domain splits a template into its `${}` leaves, one Evaluation each, and fills the values back in; a template without expressions needs no work. The evaluator only runs jq programs.
- Every expression runs in jq's strict mode, the default of 1.0.3's `evaluate`; publishing refuses `loose` and other languages.

**Arguments.** Each stage passes exactly the runtime arguments the standard's table lists for it (dsl.md, "Runtime expression arguments"):

| Expression              | `.`                                | Arguments                                                                |
| ----------------------- | ---------------------------------- | ------------------------------------------------------------------------ |
| Workflow `input.from`   | the raw workflow input             | `$workflow`, `$runtime`                                                  |
| Task `if`, `input.from` | the raw task input                 | `$context`, `$task`, `$workflow`, `$runtime`                             |
| The task's definition   | the transformed task input         | the above, `$input`, `$authorization`                                    |
| Task `output.as`        | the raw task output                | `$context`, `$input`, `$task`, `$workflow`, `$runtime`, `$authorization` |
| Task `export.as`        | the transformed task output        | the above and `$output`                                                  |
| Workflow `output.as`    | the last task's transformed output | `$context`, `$workflow`, `$runtime`                                      |

Iteration and catch variables (`$item`, `$index`, `$error` or their declared names) join inside their scope. `$secrets` joins with US8, in `input.from` only (R16). `$task.definition` and `$workflow.definition` carry the document's JSON, which the mappers keep on the Definition.

**Stages of a task.** One round each; a stage with nothing to compute passes at once:

1. `if`, the input schema and `input.from`, on the raw input. They are independent, so they are issued together and decided in the standard's order;
2. the definition: the kind's templates, on the transformed input;
3. the service call or the process run; `run: workflow` parks on its child;
4. `output.as`, on the raw output;
5. the output schema and `export.as`, both on the transformed output;
6. the export schema, on the new context.

Composites run stages 1 and 4–6 around their children.

**Progress**, immutable values, one class per state (Khorikov, "C# and F# approaches to illegal state"):

- `TaskProgress` (`language/stages`) owns the stages every task shares: `EntryStage` (`if`, input schema, `input.from`, timeout), `BodyStage`, `OutputStage`, `ExportStage`, `ExportCheckStage` and `EndedStage`. The stages before the ending are `ActiveStage`s, which a timeout ends; output, export and export check are `ResultStage`s, which carry the outcome of a body that did not fail. Each holds only its own data; `BodyStage` holds the transformed input and hands it to the kind progress through a `BodyScope`. The stages decide the task's phase (pending at the entry, waiting while the body is parked, the ending's phase at the end) and guard their state: a body stage runs an unfinished body, and a failed body has no output stage. It ends with a `TaskEnding`, a `CompletedEnding`, `FaultedEnding` or `SkippedEnding`: output or error, flow directive, exported context, and the body's `Outcome`, which carries the requests the instance acts on once (emitted event, detached process or workflow). `Outcome` alone owns the rules of those effects. A completed ending's body did not fail, and its directive is the body's directive or else the task's `then`, so the two cannot disagree.
- A kind progress (`language/progress`) owns the middle (stages 2–3) and ends as a `ConcludedProgress` with an `Outcome`. A leaf task (`LeafTask`: `ValueTask` for set, raise and emit, `CallTask`, `ProcessTask`, `FunctionCallTask`, `RunWorkflowTask`) has one stage 2, `DefinitionProgress`, which evaluates its templates and lets the task decide what follows, and one class per waiting state: `CallingProgress`, `RunningProgress`, `FunctionProgress` (the declared function runs as a child task) and `SubWorkflowProgress`. The composites keep theirs: `DoProgress`; for `for` the states `ForCollectingProgress`, `ForCheckingProgress` (only with `while`) and `ForIteratingProgress`, on a `ForIteration` (the items, the index and the data so far); `ForkProgress`, `SwitchProgress`, and for `try` the states `TryProgress`, `CatchProgress`, `RetryProgress` and `HandlerProgress`. A body runs in a `BodyScope`, which wraps the task's scope (`TaskScope.forBody`) and evaluates, checks and fills the body's templates; deadlines and wake-ups are `DueTime`s. `Sequence` runs a task list by its flow directives for `do`, each `for` iteration, and `try`.
- Every transition returns a `Step`: the next progress and the child tasks to start, and whether a retry started (the instance announces `task.retried`). Composites learn a child task's end through `childEnded`; a `run: workflow` task learns its sub-workflow's end through `subWorkflowEnded(outcome)`; a retry parks until `wakeAt`, and the next `record` after it runs the body again. A `Sequence` step gives either the next position or the list's `Outcome`, so an ended sequence is never stored.
- Stored state is guarded where jsonb comes in: whole, non-negative counters (attempts, sequence positions, `for` indexes, fork branches) and a retry only after a failed attempt (`InconsistentProgressError`). A competing fork's skipped branch does not win the race; if every branch is skipped, the fork's output is its input.
- `TaskScope` (`language/scopes`) carries the task, the Definition, the task instance id (the only owner of work ids), the variables, the time and the standard's arguments per stage; `WorkflowScope` gives the root's arguments. Expressions, templates, schemas and error conditions build their own work and read their own results.

**Who decides what:**

| Result          | Decision                                                                | Owner                                                 |
| --------------- | ----------------------------------------------------------------------- | ----------------------------------------------------- |
| `if` value      | skip or proceed                                                         | the progress                                          |
| A failed result | its error                                                               | the result kind, through `ErrorType`                  |
| Process result  | completion or fault                                                     | the process result kind, `ProcessReturn`              |
| Case values     | the branch                                                              | `SwitchProgress`                                      |
| Fault           | catch, retry, delay; spent retries fault unless `catch.do` handles them | `ErrorFilter`, `RetryStrategy`, `CatchProgress`       |
| Branch outputs  | join, compete; each branch ends once                                    | `ForkProgress`                                        |
| Next task       | the flow directive; `end` ends every enclosing composite                | `TaskList`, `FlowDirective`, `TaskEnding.workflowEnd` |

## 8. State machines

**Instance:**

| From             | To                 | When                                |
| ---------------- | ------------------ | ----------------------------------- |
| pending          | running            | first round                         |
| pending          | faulted            | engine fault                        |
| running          | waiting            | all active tasks parked             |
| waiting          | running            | deadline, event, or child end       |
| running, waiting | suspended          | suspend                             |
| suspended        | running or waiting | resume                              |
| any non-terminal | cancelled          | cancel                              |
| running          | faulted            | error, timeout, limit, engine fault |
| running          | completed          | end                                 |

**Task:** pending → running → (waiting ↔ running) → completed, faulted or cancelled.

**Correlation:** active → completed or ended.

**Delivery:** pending → delivered, or failed after 24 hours.

## 9. Rule owners

| Rule                                                                                                                              | Owner                                                                             |
| --------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| A published document never changes; conflict under the same identity                                                              | SourceDocument, plus the unique index                                             |
| Current version, on/off, schedule replacement, epoch, stale starts                                                                | Workflow and the Schedule kinds                                                   |
| Document syntax, the standard's schema, the DSL range, duplicate task names                                                       | The standard's SDK, through `SdkOpenWorkflowClient` (frameworks)                  |
| Constructs and values outside the subset; names declared in `use`                                                                 | The documents mappers with the domain's enums; `ReusableComponents`               |
| Unique task names, directive targets, fork branches (not empty when competing, naming no other branch), durations, attempt counts | TaskList, ForkTask, FixedDuration, RetryStrategy                                  |
| Expression syntax                                                                                                                 | ExpressionEvaluator.check (adapter)                                               |
| Run targets exist and are published (US2); only the publisher's secrets (US8)                                                     | Resolved when a run needs them                                                    |
| The first problem refuses the document, with its pointer                                                                          | a `DefinitionRejectedError` kind, thrown by the rule's owner                      |
| Missing input means `{}`                                                                                                          | WorkflowInstance.start                                                            |
| The workflow input schema                                                                                                         | the root task's `EntryStage`                                                      |
| A missing secret is an authorization error (US8)                                                                                  | WorkflowInstance.beginRound                                                       |
| A terminal task never changes                                                                                                     | TaskInstance                                                                      |
| Result accepted once, lifecycle sequence, instance phase, deadlines, limits, control                                              | WorkflowInstance                                                                  |
| Stages, skip                                                                                                                      | progress objects                                                                  |
| Next task                                                                                                                         | TaskList, FlowDirective                                                           |
| Abandoned listens and children are closed                                                                                         | progress `abandon()`                                                              |
| `await: false` detaches the process                                                                                               | WorkflowInstance (ProcessDetached)                                                |
| Lifecycle event data, sequence and source                                                                                         | LifecycleEvent                                                                    |
| Lifecycle sources belong to the platform                                                                                          | LifecycleSource                                                                   |
| `latest` is the workflow's current version                                                                                        | VersionReference                                                                  |
| What a sub-workflow's start or end means for its `run` task                                                                       | SubWorkflowAnswer                                                                 |
| The CloudEvent JSON format and the 64 KiB lifecycle limit                                                                         | the adapters that write events (`InstancePresenter`; the delivery gateway in US6) |
| Masking: records, faults, delivery errors                                                                                         | SecretValues, used by WorkflowInstance, Delivery                                  |
| Encryption at rest                                                                                                                | DrizzleSecretRepository                                                           |
| What follows an instance's end                                                                                                    | Origin kinds                                                                      |
| Event acceptance once                                                                                                             | the Event index and `add`                                                         |
| `with` and `correlate` matching                                                                                                   | EventFilter                                                                       |
| Consumption, `since`, `until`, no self-trigger                                                                                    | Correlation and its owner                                                         |
| Header drop on webhook calls                                                                                                      | Webhook.receive                                                                   |
| Subscription authenticates only with owner's secrets                                                                              | Subscription.create                                                               |
| Delivery outcome and 24-hour limit                                                                                                | Delivery                                                                          |
| Access by role                                                                                                                    | `@Can` policies                                                                   |

## 10. Domain errors

| Error                                                                                                                                                                                                                                                                                                                                            | Base               | HTTP |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------ | ---- |
| DefinitionRejectedError (pointer) and its kinds: InvalidDocumentError, UnsupportedConstructError, UndeclaredComponentError, InvalidExpressionError, DuplicateTaskError, UnknownTaskError, EmptyCompetingForkError, BranchJumpError, FunctionJumpError, MalformedEventError, ReservedVariableError, InvalidDocumentValueError; ForeignSecretError | RuleViolationError | 422  |
| InvalidValueError and its kinds (NegativeDurationError, CalendarDurationError, UncomputableDurationError, MalformedDurationError, NegativeAttemptCountError): a value rule without a location; the caller gives it a meaning                                                                                                                     | RuleViolationError | —    |
| StaleWriteError (any optimistic conflict), VersionConflictError, InvalidControlError                                                                                                                                                                                                                                                             | ConflictError      | 409  |
| WorkflowNotFoundError, VersionNotFoundError, InstanceNotFoundError, WebhookNotFoundError, SubscriptionNotFoundError, SecretNotFoundError                                                                                                                                                                                                         | NotFoundError      | 404  |
| StaleStartError                                                                                                                                                                                                                                                                                                                                  | RuleViolationError | —    |

Run-time workflow errors are WorkflowError values.

## 11. Persistence (PostgreSQL, Drizzle)

| Table               | Key columns                                                                                                                                                             | Notes                                                                                                                                                                                                                                     |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `workflow`          | id, namespace, name, is_on, current_version_id, schedule, trigger_types text[], epoch, version                                                                          | unique (namespace, name); GIN on trigger_types                                                                                                                                                                                            |
| `workflow_version`  | id, workflow_id, semver, dsl_version, source_format, source_text, fingerprint, publisher_id, published_at                                                               | unique (workflow_id, semver)                                                                                                                                                                                                              |
| `workflow_instance` | id, workflow_id, version_id, namespace, name, semver, phase, input, output, error, context, origin, started_at, ended_at, sequence, executions, version                 | index (namespace, name, started_at, id) for the list; `limits` join with US3                                                                                                                                                              |
| `task_instance`     | id, instance_id, execution, reference, name, parent_id, phase, raw_input, output, error, retries, progress, started_at, ended_at                                        | one row per execution, ordered by `execution`; active rows load with the aggregate (partial index on (instance_id, execution) where ended_at is null); one multi-row upsert per save; `progress` is jsonb written by `TaskProgressMapper` |
| `event`             | id, source, event_id, type, time, subject, data_content_type, data_schema, data, extensions, origin_kind, origin_workflow_id, origin_instance_id, sequence, accepted_at | unique (source, event_id), inserted with `ON CONFLICT DO NOTHING` (CloudEvents: the same source and id are duplicates); index (origin_instance_id, sequence); (type, accepted_at) joins with routing (US7)                                |
| `correlation`       | id, owner_kind, instance_id, task_instance_id, workflow_id, epoch, filter_types text[], strategy, since, expected, consumed, status, version                            | GIN on filter_types; `*` marks a filter without an exact type                                                                                                                                                                             |
| `webhook`           | id, name, event_type, token_fingerprint, owner_id, created_at                                                                                                           | unique token_fingerprint                                                                                                                                                                                                                  |
| `subscription`      | id, name, endpoint_uri, auth_scheme, auth_secret, filter, filter_types text[], owner_id, created_at                                                                     | GIN on filter_types                                                                                                                                                                                                                       |
| `delivery`          | id, subscription_id, event_id, status, attempts, last_error, first_attempt_at, last_attempt_at, version                                                                 | unique (subscription_id, event_id)                                                                                                                                                                                                        |
| `secret`            | id, owner_id, name, ciphertext, created_at, updated_at, version                                                                                                         | unique (owner_id, name)                                                                                                                                                                                                                   |
| `idempotency_key`   | the module's contract                                                                                                                                                   |                                                                                                                                                                                                                                           |

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
| Always valid             | input validation in the documents adapter with the domain's knowledge; invariants in constructors and factories                                     | "Always-Valid Domain Model"; "Validation and DDD"                                                            |
| Enumerations             | enums for closed sets; polymorphism or an enumeration class where values steer behaviour                                                            | MS Learn, "Use enumeration classes instead of enum types"; "Functional C#: Primitive obsession"              |
| Repositories, CQS        | one repository per aggregate; queries read into read models                                                                                         | "Having the domain model separated from the persistence model"; "Types of CQRS"                              |
| Encapsulation            | progress objects, owners, schedule kinds, origins and filters decide for themselves                                                                 | "Encapsulation revisited"                                                                                    |
