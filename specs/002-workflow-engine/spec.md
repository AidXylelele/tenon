# Feature Specification: Workflow Engine

**Feature Branch**: `002-workflow-builder`

**Created**: 2026-10-28

**Status**: Draft

**Input**: User description: "нам нужно построить ядро платформы автоматизаций по спецификации openworkflows cncf standart. Основная задача построить движок обработки всех workflows делая дизайн по спецификации openworkflows cncf спецификации. Основной пример - synapse, сервис-движок написанный по спецификации cncf openworkflows. Нам нужно спроектировать правильно по нашей архитектуре, чтобы все выполнение могло масштабироваться горизонтально; Делать нужно по domain driven design - по статьям из блога enterprisecraftmanships про DDD. Также обязательно нужно соблюдать Clean Architecture - https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html Очень важно правильно спроектировать доменную модель и адаптеры. Используй nestjs/workflows, nestjs/idempotency, nestjs/outbox (для реализации доменных событий при необходимости и аггрегатов по статье из блога о том, как сделать надежными и простыми обработку доменных событий в блоге enterprisecreftmanships). https://enterprisecraftsmanship.com/posts/domain-events-simple-reliable-solution/ И твоя задача делать по всем типам объектов DDD смотреть по блогу."

## Clarifications

### Session 2026-10-28

- Q: Which task and call types are in the supported subset? → A: This answer was revised later in the session, after the user pointed out that the first subset departed from the standard.
  - **In the subset:** the control-flow tasks (`do`, `set`, `switch`, `for`, `fork`, `try`, `raise`), `wait`, `listen`, `emit`, `call` with `http` and `openapi`, and `run` with `workflow`, `script` and `shell`.
  - **Outside the subset, refused at publish:** `run: container`, and `call` with gRPC, AsyncAPI, A2A or MCP. They are left for later iterations.
- Q: Where do scripts and shell commands run? → A: In the go-judge sandbox, never in the platform's own processes.
- Q: What is the platform, and what does it add to the standard? → A:
  - **Audiences.** It is for non-technical users, who build automations in a no-code editor, and for technical users, who integrate services and whole applications through it, as with Synapse. It is not a deployment-configured infrastructure component.
  - **What it adds.** Beyond the standard, it adds only cron-style scheduled starts (polling, with no memory between runs) and inbound webhooks.
  - **Everything else** follows the Open Workflow Specification, without n8n mechanics.
- Q: Should the platform work around the durable engine's per-instance journal limit for very long loops? → A: No. The limit is accepted. An instance that reaches it faults.
- Q: Do events leave the platform, and how reliably? → A: Yes. The standard requires them: `emit` publishes to event consumers, and lifecycle events notify users and external services. Events MUST be delivered with a guarantee, through the outbox.
- Q: How far should the NestJS ecosystem be used? → A: To the maximum: `@nestjs/schedule`, `@nestjs/locks`, `@nestjs/idempotency` and `@nestjs/resilience`, alongside `@nestjs/workflows` and `@nestjs/outbox`.
- Q: What must this feature prepare for? → A: It builds the core. Later iterations add AI agents with tools and work with files, both through the standard's own constructs. The core must be designed so that those iterations extend it without reworking it.

## User Scenarios & Testing _(mandatory)_

Two kinds of people use the platform, and both produce the same thing: a workflow document in the Open Workflow Specification DSL.

- **Non-technical users** build automations in a no-code editor (a later feature), which saves them as standard documents.
- **Technical users** write documents by hand and integrate services and applications through the platform.

The engine runs only standard documents. Scheduled starts, cron included, come from the standard's own `schedule`. Beyond the standard, the platform adds only two things: inbound webhooks, and an on/off switch for scheduled starts.

### Usage and Integration Analysis

**Actors**

| Actor                                        | Uses the platform to                                                               | Through                                                                                                   |
| -------------------------------------------- | ---------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Non-technical author, for example a marketer | Build automations: lead routing, nurture sequences, notifications, scheduled syncs | The no-code editor (later), credentials, webhooks, on/off, execution history                              |
| Technical author                             | Write workflows, orchestrate services, reuse sub-processes                         | Documents through the API                                                                                 |
| Application or backend service               | Start workflows, send events, receive events, be called by workflows               | The API, the event intake, webhooks, event subscriptions; `call: http` and `call: openapi` from workflows |
| Operator                                     | Run and scale the platform                                                         | Workers, limits, the outbound allow-list                                                                  |
| Viewer                                       | Follow what automations do                                                         | Execution history                                                                                         |

**Integration channels**

| Direction | Channel                                       | Standard construct                | Covered by           |
| --------- | --------------------------------------------- | --------------------------------- | -------------------- |
| In        | A person or application starts an instance    | Workflow input                    | User Story 2, FR-008 |
| In        | An application sends a CloudEvent             | `schedule.on`, `listen`           | User Story 7, FR-023 |
| In        | An application calls a webhook URL            | `schedule.on`, `listen`           | User Story 5, FR-024 |
| In        | A clock reaches a cron or interval occurrence | `schedule.cron`, `every`, `after` | User Story 4, FR-029 |
| Out       | A workflow calls a service                    | `call: http`, `call: openapi`     | User Story 2, FR-011 |
| Out       | A workflow publishes an event                 | `emit`                            | User Story 6, FR-028 |
| Out       | The platform reports state changes            | Lifecycle events                  | User Story 6, FR-030 |
| Out       | A workflow runs another workflow              | `run: workflow`                   | User Story 2, FR-011 |
| Observe   | A person reads what happened                  | Instance and task records         | User Story 2, FR-016 |

**Usage patterns.** Each pattern is an example from the standard's constructs, with the stories that cover it.

| Pattern                                 | Example                                                                                             | Constructs                                              | Stories |
| --------------------------------------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------- | ------- |
| Scheduled polling or sync               | Every 15 minutes, fetch new CRM leads and add them to the mailing tool                              | `schedule.cron`, `call: http`, `for`                    | 4       |
| Webhook-triggered automation            | A form is submitted, so create a contact and notify the team                                        | Webhook, `schedule.on`, `call`                          | 5       |
| Long-running nurture                    | Send a welcome email, wait three days, then send a reminder unless a purchase event arrives         | `wait`, `listen` with `until`, `try`                    | 7       |
| Request–reply orchestration             | Order, then payment, then inventory, then shipping, across four services                            | Sequential `call`, `try` with retry                     | 2, 3    |
| Compensation (saga)                     | Payment fails after inventory was reserved, so release the reservation                              | `try` with a catch `do` that runs compensating calls    | 2       |
| Fan-out and fan-in                      | Enrich each lead in parallel, or take the first supplier that answers                               | `for`, `fork`, `fork` with `compete`                    | 2       |
| Event choreography between applications | Application A emits `order.placed`, a workflow reacts, and application B receives `order.confirmed` | `emit`, `listen` with `correlate`, subscriptions        | 6, 7    |
| Human in the loop                       | Wait for a manager's approval event for two days, otherwise escalate                                | `listen` inside `try` with a timeout                    | 7       |
| Failure monitoring                      | When any automation faults, post to the team channel, or forward the fault to a monitoring system   | `schedule.on` on `workflow.faulted`, subscription       | 4, 6    |
| Reuse                                   | One "create contact" call declared once per document; a common sub-process shared by many workflows | `use.functions`, `run: workflow`                        | 2       |
| Integrating whole applications          | Applications exchange events through the platform, which orchestrates the steps between them        | Event intake, webhooks, subscriptions, `listen`, `emit` | 5, 6, 7 |
| Custom processing in code               | Normalize a CSV export with a Python script before sending it to the CRM                            | `run: script`, `run: shell`                             | 2       |

**What the core cannot do, and why.** Each limit follows from a decision recorded above.

- Containers: `run: container` is outside the subset. Scripts and shell commands run in the sandbox, which offers no network access.
- Agent and tool protocols: A2A and MCP are outside the subset. Model APIs can still be called with `call: http`.
- Binary content: only as base64 text through `call: http` with `output: raw`, within the data size limit.
- Webhook signatures: provider-specific signature checks are not part of this feature.
- Machine credentials: none in this feature.
- Unbounded loops: a loop is stopped by the accepted journal limit.

### Foundation for Later Iterations

Every planned iteration maps to constructs the standard already defines. The core provides what each one builds on.

| Iteration                          | Standard constructs                                                                                                                                                                                       | What the core already provides                                                                                                  |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| No-code editor (web)               | Documents, task `metadata` for layout                                                                                                                                                                     | Checking without publishing, with JSON Pointer locations; execution history                                                     |
| Catalog of reusable functions      | The default catalog: `call: name:version@default`                                                                                                                                                         | A subset declared in one place (ER-001); `use.functions` already resolves named calls                                           |
| AI agents with tools               | `call: a2a` for agents; `call: mcp` over the `http` transport for tools; `call: http` or `call: openapi` to model APIs; agent loops with `switch` and `then`; tools as sub-workflows or catalog functions | Secrets for API keys; outbound safeguards and limits; durable long runs; lifecycle events for observing agent steps             |
| An assistant that builds workflows | An agent that writes standard documents                                                                                                                                                                   | The check report as its feedback loop (FR-003)                                                                                  |
| Files                              | External resources by URI with an authentication policy; `call: http` with `output: raw`; the claim-check `outputUri` of DSL 1.0.4                                                                        | JSON instance data that carries URIs, size limits, secrets for storage credentials                                              |
| Containers and local tools         | `run: container`, and the MCP `stdio` transport                                                                                                                                                           | Sandboxed processes behind one port, which a container runtime can implement; a subset extended construct by construct (ER-001) |
| DSL 1.0.4                          | Runtime-generated `emit` id and source, `outputUri`, `catch.then`, `schedule.read`, the new event namespace                                                                                               | Each version keeps the DSL version it declares (ER-002)                                                                         |
| Machine credentials                | None; this is a platform feature                                                                                                                                                                          | Role-based access to every operation                                                                                            |

### User Story 1 - Publish a workflow (Priority: P1)

An author publishes a workflow document in YAML or JSON. The platform checks the whole document before it accepts it:

- A valid document becomes a new immutable version and the workflow's current version.
- An invalid document is refused, and every problem is reported with its location.

Authors can also check a document without publishing it, so an editor or an assistant can show the problems while the document is being built.

**Why this priority**: Nothing runs without a published workflow. Because the platform checks everything before a run, an automation does not fail later for a reason that publishing could have found.

**Independent Test**:

1. Publish a valid document and read it back.
2. Publish documents with these defects, and confirm that each one is refused with every defect located:
   - a schema violation;
   - an unsupported task;
   - a flow directive pointing to a missing task;
   - an undeclared reusable component;
   - a malformed expression.
3. Check a defective document without publishing it. Confirm that the report is the same and that nothing is stored.

**Acceptance Scenarios**:

1. **Given** a valid document, **When** an author publishes it, **Then** a version with the document's namespace, name and version exists, becomes the workflow's current version, and returns the document as submitted.
2. **Given** a document with several defects, **When** it is published, **Then** it is refused, nothing is stored, and the response lists every defect with its location in the document and the reason.
3. **Given** a published version, **When** the identical document is published again, **Then** the existing version is returned and nothing changes.
4. **Given** a published version, **When** a document with the same namespace, name and version but different content is published, **Then** it is refused as a conflict.
5. **Given** a document that uses a construct outside the supported subset (FR-011), **When** it is published, **Then** it is refused, and the response names the construct and its location.
6. **Given** a document that declares a DSL version the platform does not support, **When** it is published, **Then** it is refused.
7. **Given** any document, **When** an author checks it without publishing, **Then** the response is the report that publishing would give, and nothing is stored.
8. **Given** a viewer, **When** the viewer tries to publish, **Then** the operation is refused.

---

### User Story 2 - Run a workflow and follow its execution (Priority: P1)

An author, or an application, starts an instance of a workflow with an input. The platform executes the tasks as the standard defines them: task order and flow directives, conditions, data transformations, branching, loops, parallel branches, raised and caught errors, retries, timeouts, sub-workflows and calls to external services.

The instance moves through the standard's phases and ends in one of three ways: completed with an output, faulted with an error, or cancelled.

The execution history shows the instance's phase and, for every task, its status, timing, input, output, error and retry attempts.

**Why this priority**: This is the engine. Together with User Story 1 it is the minimum viable core.

**Independent Test**: Start instances of the conformance-kit workflows that fall inside the supported subset, and of a sample workflow that uses every supported task type. Compare their outputs, task order and errors with the expected results.

**Acceptance Scenarios**:

1. **Given** a published workflow and an input that matches its input schema, **When** an instance is started, **Then** the instance is created as pending, runs, and ends completed with the output the standard prescribes.
2. **Given** an input that violates the input schema, **When** an instance is started, **Then** the start is refused with a validation error and no instance exists.
3. **Given** a task that raises an error which nothing catches, **When** the instance runs, **Then** it ends faulted with that error: its type, status, title, detail and the location of the faulting task.
4. **Given** a `try` task whose catch matches the error and declares a retry policy, **When** the guarded task fails, **Then** it is retried as the policy defines. The instance continues if a retry succeeds and follows the catch when the retries are exhausted. Every attempt is visible in the history.
5. **Given** a task or workflow timeout, **When** it elapses, **Then** the task or instance faults with a timeout error.
6. **Given** a start request repeated with the same idempotency key and the same input, **When** it arrives, **Then** the first instance is returned and only that instance exists. The same key with a different input is refused.
7. **Given** a start that names no version, **When** it is accepted, **Then** the instance runs the workflow's current version. A start that names a version runs that version.
8. **Given** any instance, **When** a signed-in user reads it, **Then** the response contains the phase, version, input, output or error, start and end times, and the task records.

---

### User Story 3 - Survive failures and scale out (Priority: P1)

The platform runs on any number of identical workers. Each instance advances on whichever worker has capacity.

If a worker crashes, restarts or is replaced during a deployment, other workers continue its instances, and work that was already recorded is not repeated. Operators add workers to handle more load.

**Why this priority**: Automations run for days and weeks, and applications rely on the platform as their orchestrator. Neither may lose work when a process fails. Horizontal scaling is a requirement of the request, and the durable runtime is the thesis contribution.

**Independent Test**:

1. Run a batch of instances that call an external test endpoint, while workers are killed and restarted at random.
2. Confirm that every instance reaches the same outcome as in an undisturbed run, and that no task recorded as completed ran again.
3. Repeat with more workers and compare throughput.

**Acceptance Scenarios**:

1. **Given** running instances, **When** the worker executing them is killed, **Then** another worker continues them and they reach their outcome.
2. **Given** a task whose completion was recorded, **When** its instance recovers after a crash, **Then** that task is not executed again.
3. **Given** a task that was in progress when its worker was killed, **When** the instance recovers, **Then** the task runs again from its recorded input (at-least-once).
4. **Given** several workers, **When** an instance runs, **Then** no task is executed by two workers at the same time. Parallel branches of a `fork` are separate tasks and may run at the same time.
5. **Given** a constant load, **When** workers are added, **Then** the number of completed instances per minute rises with no other change (SC-004).
6. **Given** all workers stopped, **When** they start again, **Then** every instance that had not ended continues.

---

### User Story 4 - Start workflows on a schedule and on events (Priority: P2)

An author turns a workflow on. While it is on, the standard `schedule` of its current version starts instances by itself, in one of four ways:

- on a cron expression;
- at a fixed interval;
- after a delay once the previous instance ends;
- when events that satisfy a strategy arrive.

Polling another application is simply a scheduled workflow that calls it; the platform keeps no state between instances. Turning the workflow off stops automatic starts, while manual starts and starts by applications keep working.

**Why this priority**: Unattended automation needs it. This story builds on User Stories 2 and 7.

**Independent Test**:

1. Turn on a workflow with `every: PT1M`, run it on two workers for five minutes, and confirm that exactly five instances started.
2. Turn the workflow off, and confirm that no more instances start.
3. Turn on a workflow with `schedule.on` for an event type. Publish a matching event, and confirm that exactly one instance starts, with the event as its input.

**Acceptance Scenarios**:

1. **Given** a workflow that is on and whose current version has `cron` or `every`, **When** an occurrence is due, **Then** exactly one instance starts across all workers.
2. **Given** a version with `after`, **When** an instance it started completes, **Then** the next instance starts once the delay has passed. A faulted or cancelled instance ends the chain until the workflow is turned on again.
3. **Given** a version with `on`, **When** accepted events satisfy its strategy, **Then** exactly one new instance starts, and its input is the consumed events.
4. **Given** a workflow that is on, **When** a new version is published, **Then** the new version's schedule replaces the previous one.
5. **Given** a workflow that is off, **When** an occurrence is due or matching events arrive, **Then** no instance starts. Running instances continue, and manual starts are still accepted.
6. **Given** the platform was unavailable when occurrences were due, **When** it recovers, **Then** at most one missed occurrence starts, and the regular cadence follows.

---

### User Story 5 - Receive webhooks from other applications (Priority: P2)

An author creates a webhook: a secret URL that another application calls when something happens there, such as a form being submitted or an order being paid. Each call becomes an ordinary CloudEvent of the type the webhook declares. Workflows react to it with the standard's `schedule.on` or `listen`.

**Why this priority**: Most applications report their events by calling a URL, not by sending CloudEvents. Webhooks are one of the platform's two additions to the standard.

**Independent Test**:

1. Create a webhook with type `com.example.form.submitted`.
2. Turn on a workflow whose `schedule.on` matches that type.
3. Post a JSON body to the webhook URL. Confirm that the call is acknowledged at once and that one instance starts, with the body in its input.
4. Delete the webhook and confirm that the URL stops working.

**Acceptance Scenarios**:

1. **Given** an editor, **When** they create a webhook with a name and an event type, **Then** its URL is returned once, at creation, and the webhook is listed by name and type.
2. **Given** a webhook, **When** an application posts to its URL, **Then** the call is acknowledged without waiting for any workflow. The platform accepts one event with the webhook's type, the webhook as its source, and the request body, query parameters and headers as its data.
3. **Given** a request whose body is not JSON, **When** it arrives, **Then** the body is carried as text.
4. **Given** two requests to a webhook with the same idempotency key, **When** they arrive, **Then** only one event is accepted.
5. **Given** a deleted webhook or an unknown URL, **When** it is called, **Then** the call is refused in the same way for both, and no event is accepted.
6. **Given** a request above the event size limit, **When** it arrives, **Then** it is refused, and no event is accepted.

---

### User Story 6 - Deliver events to other applications (Priority: P2)

An application subscribes to events: the events workflows emit and the standard's lifecycle events. A subscription names a destination endpoint, an optional authentication taken from its owner's secrets, and a filter in the standard's event-filter form.

The platform delivers every matching event to the destination as a CloudEvent, in the HTTP structured mode the standard recommends. It keeps retrying until the destination accepts the event, so no event is lost when a process crashes or the destination is down for a while.

**Why this priority**: The standard requires events. `emit` publishes to event consumers, and lifecycle events notify users and external services. Integrating whole applications depends on this delivery being guaranteed.

**Independent Test**:

1. Subscribe a test receiver to `io.serverlessworkflow.workflow.completed.v1` and to a type that a workflow emits.
2. Run the workflow, and confirm that the receiver gets each event once, in structured mode.
3. Take the receiver down for five minutes while instances complete and workers are killed. Confirm that every event arrives after the receiver comes back, and that any repeated delivery carries the same id.

**Acceptance Scenarios**:

1. **Given** an editor, **When** they create a subscription with a name, a destination endpoint and an event filter, **Then** the subscription is listed, and events accepted or produced from then on that match the filter are delivered to it.
2. **Given** a subscription whose endpoint takes its authentication from one of its owner's secrets, **When** an event is delivered, **Then** the request carries that credential, and the credential never appears in the subscription's details.
3. **Given** a destination that answers with an error or does not answer, **When** an event is due, **Then** the platform retries with growing delays for up to 24 hours. After that it marks the delivery failed and keeps it for inspection.
4. **Given** a slow or failing destination, **When** events are delivered to it, **Then** workflows and deliveries to other subscriptions are not delayed.
5. **Given** a worker that is killed while it delivers an event, **When** delivery resumes, **Then** the event is delivered again with the same id.
6. **Given** a subscription, **When** its owner reads it, **Then** they see, for each recent event, whether it was delivered, is pending, or failed with the last error.
7. **Given** a deleted subscription, **When** events that would have matched it are produced, **Then** nothing is delivered to it, and its pending deliveries stop.
8. **Given** a subscription whose destination resolves to a private, loopback or link-local address that is not allow-listed, **When** an event is delivered, **Then** no connection is opened and the attempt fails.

---

### User Story 7 - Wait for time and for events (Priority: P2)

A workflow can pause for a duration (`wait`) or until events arrive (`listen`). Events come from webhooks, from users and applications that publish CloudEvents, from workflows that publish them with `emit`, and from lifecycle changes. A waiting instance takes no execution capacity. It resumes when its time comes or when its events match.

**Why this priority**: Automations wait for days, and integrations wait for the replies of other applications. Both need waits that survive restarts.

**Independent Test**:

1. Start an instance that waits one minute, restart all workers during the wait, and confirm that the instance resumes.
2. Start an instance that listens for an order event correlated by order id.
3. Publish a non-matching event, a matching event and a duplicate of the matching event. Confirm that the matching event is consumed exactly once.

**Acceptance Scenarios**:

1. **Given** a `wait` task, **When** an instance reaches it, **Then** the instance is waiting and continues after the duration, even if processes restarted in the meantime.
2. **Given** a `listen` task with filters and correlation keys, **When** matching events are accepted, **Then** the instance consumes them according to the task's strategy (`one`, `any`, `all`, `until`). It continues with the consumed events as the task output, in the task's read mode (`data`, `envelope`, `raw`).
3. **Given** an event with the same source and id as an event already accepted, **When** it is published again, **Then** it is acknowledged and has no effect.
4. **Given** an `emit` task, **When** it runs, **Then** its event reaches the matching listeners, schedules and subscriptions exactly as any other event does.
5. **Given** a `listen` task with `foreach`, **When** several events match, **Then** they are processed one at a time, in the order the platform accepted them.
6. **Given** an event accepted before a `listen` task started, **When** the task starts, **Then** the task does not consume that event.

---

### User Story 8 - Keep credentials for workflows (Priority: P2)

A user stores a credential as a named secret, for example an API token or a password. The workflows that user publishes reference it by name through the standard's `use.secrets` and authentication policies. Their subscriptions can authenticate with it too. The platform resolves the value only when it is needed, and nobody can read the value back.

**Why this priority**: Integrations need credentials, and non-technical users cannot place them in server configuration. The constitution requires credentials to be encrypted at rest and scoped to their owner.

**Independent Test**:

1. Create a secret.
2. Publish a workflow that calls a test endpoint with basic authentication taken from the secret, and run it. Confirm that the endpoint received the credential.
3. Read the secret back and confirm that only its name is returned.
4. Publish another user's workflow that names the same secret, and confirm that it is refused.

**Acceptance Scenarios**:

1. **Given** a signed-in author, **When** they create a secret with a name and a value, **Then** the secret is listed by name and creation time, and its value is never returned.
2. **Given** an existing secret, **When** its owner replaces the value, **Then** later resolutions use the new value.
3. **Given** a version whose `use.secrets` names only secrets its publisher owns, **When** it is published, **Then** it is accepted, and its tasks receive the values at run time.
4. **Given** a version that names a secret its publisher does not own, **When** it is published, **Then** it is refused at that name's location.
5. **Given** a secret that was deleted after a version using it was published, **When** a task needs it, **Then** the task raises an authorization error.

---

### User Story 9 - Suspend, resume and cancel an instance (Priority: P3)

An author can pause an instance, resume it later, or cancel it.

**Why this priority**: Authors need to stop a misbehaving automation without losing it. The standard defines the suspended and cancelled phases.

**Independent Test**:

1. Start an instance that contains a long `wait`.
2. Suspend it, confirm that no further task starts, then resume it and confirm that it completes.
3. Cancel another instance and confirm that it ends cancelled.

**Acceptance Scenarios**:

1. **Given** a running or waiting instance, **When** an author suspends it, **Then** no new task starts, tasks in progress finish and their results are recorded, and the instance is suspended.
2. **Given** a suspended instance, **When** an author resumes it, **Then** it continues where it stopped. A wait whose deadline passed during the suspension ends at once.
3. **Given** a pending, running, waiting or suspended instance, **When** an author cancels it, **Then** no further task starts and the results of tasks in progress are discarded. Its pending waits and event subscriptions end, the instance ends cancelled, and any sub-workflow instances it started are cancelled too.
4. **Given** a completed, faulted or cancelled instance, **When** any control request arrives, **Then** it is refused and nothing changes.
5. **Given** an instance that is not suspended, **When** resume is requested, **Then** it is refused. **Given** a suspended instance, **When** suspend is requested again, **Then** it is refused.

---

### Edge Cases

**Publishing**

- A document declares `dsl` 1.0.4 or an unknown version: it is refused at publish.
- A flow directive targets a task outside its own scope: it is refused at publish.
- A document mixes valid parts with one unsupported construct: the whole document is refused; nothing is accepted partially.
- A new version is published while instances of an earlier version run: the earlier instances finish on their own version.

**Data and limits**

- Values in an instance's input, in event data or in webhook requests that look like runtime expressions are never evaluated.
- A `for` loop over a very large collection, or a `then` cycle that never ends: the instance faults with a runtime error once it reaches the task-execution limit (FR-021). The platform does not continue it as a new instance.
- A task's output exceeds the data size limit: the task faults with a runtime error.
- A lifecycle event whose output would make it larger than 64 KiB: the event is delivered without the output, and the output stays readable in the execution history.

**Control**

- A suspend arrives during an outbound call: the call completes, its result is recorded, and no next task starts.
- A cancel arrives during a `wait` or `listen`: the instance ends cancelled at once, and its subscriptions end.

**Events and triggers**

- An event matching a `listen` arrives while the instance is suspended: the event is collected and consumed on resume.
- One event matches several listening instances, schedules and subscriptions: each one receives it under its own rules.
- A webhook is called while every workflow that reacts to it is off: the event is accepted and delivered to matching subscriptions, and no instance starts.
- A workflow's `schedule.on` matches lifecycle events: it is never started by a lifecycle event of its own instances.
- A cron occurrence falls during a restart: the occurrence starts at most once (User Story 4, scenario 6).
- A worker crashes right after an `emit` task completes: the event is delivered once it recovers, and the task does not emit it again.
- A subscription destination accepts an event but answers too late: the event may be delivered again with the same id, and the receiver drops the duplicate.

**Errors**

- In a `fork` without `compete`, one branch faults with an uncaught error: the fork faults and the remaining branches are cancelled. With `compete`, the first branch that completes wins and the others are cancelled.
- A retry policy is exhausted: the error propagates to the enclosing scope as the standard defines.
- A runtime expression fails at run time: the task raises an expression error, which `try` can catch.
- A sub-workflow instance faults: the `run` task faults with the sub-workflow's error.
- A script exits with code 1 and `return: code`: the task completes with the output `1`.
- A script runs past its time limit: it is stopped, and the task faults with a timeout error.

**Durability and concurrency**

- A worker is killed during an outbound call: after recovery the call is made again (at-least-once).
- Two start requests with the same idempotency key arrive at the same moment: exactly one instance is created.

**Security**

- An outbound call or a subscription delivery targets a private, loopback or link-local address that is not allow-listed: no connection is opened. A call fails with a communication error; a delivery fails.
- A script tries to open a network connection or read a file outside its sandbox: the attempt fails inside the script.
- An external service echoes a credential back in its response, or an author passes `$secrets` into data: the value is masked everywhere the platform records, shows or delivers it (FR-007).

## Requirements _(mandatory)_

### Functional Requirements

**Definitions**

- **FR-001**: The platform MUST accept workflow documents in YAML or JSON that declare a DSL version from 1.0.0 through 1.0.3 of the Open Workflow Specification, and MUST refuse any other `document.dsl` value.
- **FR-002**: Before it accepts a document, the platform MUST check:
  - (a) conformance to the standard's schema for the declared version;
  - (b) use of the supported subset only (FR-011);
  - (c) references:
    - every flow directive targets a task in its own scope;
    - every reusable component a task names (function, retry policy, error, timeout, authentication policy) is declared in the document's `use`;
    - every sub-workflow a `run` task names exists, and a version it names explicitly is published (`latest`, the standard's default, is resolved when the task starts);
    - every secret in `use.secrets` is owned by the publisher;
  - (d) the syntax of every runtime expression in the evaluation language.

  The platform MUST report every problem in one response, each with its location as a JSON Pointer into the document and a reason. It MUST store nothing for a refused document.

- **FR-003**: Authors MUST be able to check a document without publishing it. The check MUST give the same report as publishing would and MUST store nothing.
- **FR-004**: A version MUST be identified by the document's namespace, name and version, and a published version MUST never change. Publishing an identical document again MUST return the existing version. Publishing different content under an existing identity MUST be refused as a conflict. A newly published version MUST become the workflow's current version.
- **FR-005**: Signed-in users MUST be able to list workflows and their versions and to read a version's document exactly as submitted.
- **FR-006**: An author MUST be able to turn a workflow on and off. Only while a workflow is on MUST the schedule of its current version start instances. Turning a workflow off MUST NOT affect running instances or manual starts.

**Credentials**

- **FR-007**: Users MUST be able to create, replace and delete their own secrets and to list their names.
  - Values MUST be encrypted at rest and MUST never be returned.
  - A version MUST resolve the names in its `use.secrets` against the secrets of its publisher, only while its instances run. A subscription resolves its secret only while it delivers.
  - A secret missing at run time MUST raise an authorization error.
  - The platform MUST never return, show or deliver a secret value. Wherever a resolved value appears in instance records, task records, events, deliveries, logs or error messages, it MUST be masked. The standard warns that `$secrets` lets an author pass a value into data, so masking covers data as well.

**Execution**

- **FR-008**: An author or an application MUST be able to start an instance with a JSON input, either of a named version or, when no version is named, of the workflow's current version.
  - If the version declares an input schema, the platform MUST validate the input before it creates the instance and MUST refuse the start with a validation error when the input does not match.
  - An instance MUST run on the version it was started with until it ends.
- **FR-009**: A start request MUST accept an idempotency key. Within 24 hours, a repeated request with the same key and the same input MUST return the original instance, and a request with the same key and a different input MUST be refused.
- **FR-010**: The platform MUST execute instances with the standard's semantics:
  - flow directives (`continue`, `exit`, `end`, a task name) and the `if` condition;
  - the data-flow stages in the standard's order: input schema, `input.from`, execution, `output.as`, output schema, `export.as`, export schema;
  - runtime expressions in jq, in strict and loose evaluation modes;
  - the runtime arguments `$context`, `$input`, `$output`, `$secrets`, `$authorization`, `$task`, `$workflow` and `$runtime`.

  The platform MUST NOT evaluate expressions found in input, event or webhook data.

- **FR-011**: The supported subset MUST be the following:
  - the tasks `do`, `set`, `switch`, `for`, `fork`, `try`, `raise`, `wait`, `listen` and `emit`;
  - `call` with the `http` and `openapi` types, used directly or through a function declared in the document's `use.functions`;
  - `run` with the `workflow` type, which starts a sub-workflow instance of the version it names or, for `latest`, of the sub-workflow's current version when the task starts. When `await` is true, the `run` task completes with the sub-workflow's output or faults with its error.
  - `run` with the `script` type (JavaScript or Python, with inline `code`) and the `shell` type, executed as FR-012 defines. A script `source` (an external resource) is outside the subset.

  These are outside the subset: `run` with `container`; `call` with `grpc`, `asyncapi`, `a2a` or `mcp`; catalogs, the default catalog included; `use.extensions`; digest authentication and OAuth2 or OIDC grants other than `client_credentials`; a runtime expression as a retry delay, jitter or limit; and a fraction of years, months, weeks or days in a duration, which the standard does not define. The tasks `wait` and `listen`, `schedule` and `use.secrets` join the subset with the stories that run them.

  The platform MUST refuse any construct outside the subset at publish and MUST never ignore a construct silently.

- **FR-012**: Scripts and shell commands MUST run in an isolated sandbox, outside the platform's processes.
  - **Isolation.** The sandbox gives a process no network access, no access to the platform's files or secrets except the values passed to it, and limits on time, memory and processes.
  - **Inputs.** A process receives the task's evaluated `code` or `command`, its `arguments`, its `environment` and its `stdin`.
  - **Output.** Its output follows `return` (`stdout` by default; `stderr`; `code`; `all` as `{ code, stdout, stderr }`; `none`).
  - **Exit codes.** A non-zero exit code is not an error by itself.
  - **Failures.** A process that exceeds its time limit faults the task with a timeout error. Any other sandbox failure faults the task with a runtime error.
  - **Not awaited.** With `await: false`, the task completes with its transformed input once the process is submitted.
- **FR-013**: Errors MUST follow the standard's error shape (`type`, `status`, `instance`, `title`, `detail`) and the standard error types (configuration, validation, expression, authentication, authorization, timeout, communication, runtime).
  - An uncaught error MUST fault the instance with that error.
  - `try`/`catch` MUST support the error filter, `as`, `when`, `exceptWhen` and a catch `do`.
  - Retry policies MUST support `when`, `exceptWhen`, `delay`, constant, linear and exponential back-off, attempt-count, attempt-duration and total-duration limits, and jitter.
  - `raise` MUST raise the declared error.
- **FR-014**: Task-level and workflow-level timeouts MUST fault the task or the instance with a timeout error when they elapse.
- **FR-015**: Instances and tasks MUST use the standard's phases: pending, running, waiting, suspended, cancelled, faulted, completed. Completed, faulted and cancelled are terminal: a terminal instance or task MUST never change again. A task whose `if` evaluates to false is recorded as skipped, the standard's term for it: it enters no phase, produces no lifecycle event, and its raw input becomes its output.
- **FR-016**: Signed-in users MUST be able to read an instance's execution history: its phase, version, input, output or error, start and end times, lifecycle events, and task records.
  - A task record MUST hold the task's location in the document, its status, timing, input, output, error, retry attempts and parent task.
  - Users MUST be able to list instances, filtered by workflow, version, phase and start-time range, with pagination.
- **FR-017**: An author MUST be able to suspend a running or waiting instance, resume a suspended one, and cancel an instance that has not ended, with the effects described in User Story 9. Every other control request MUST be refused without effect.
- **FR-018**: An instance MUST survive the crash or restart of any process.
  - A task whose completion was recorded MUST never execute again.
  - A task interrupted before its completion was recorded MUST execute again from its recorded input. Calls to external systems are therefore at-least-once.
- **FR-019**: The platform MUST run on any number of identical workers.
  - Any worker MUST be able to continue any instance.
  - A task MUST NOT be executed by two workers at the same time.
  - Adding workers MUST increase capacity without changing configuration or definitions.
- **FR-020**: A waiting or suspended instance MUST hold no execution capacity. Waits, retry delays, timeouts and schedules MUST fire after restarts, and a deadline that passed while the platform was down MUST fire on recovery.
- **FR-021**: Every instance MUST run within explicit limits:
  - a maximum number of task executions per instance, within the durable engine's per-instance journal limit;
  - a maximum size for each task's input, output and exported context;
  - a timeout and a maximum response size for every outbound call;
  - a time, memory, process-count and output limit for every script or shell command.

  Exceeding a limit MUST fault the task with a runtime, timeout or communication error. The operator MUST be able to configure the limits within the engine's bounds.

- **FR-022**: Outbound calls and subscription deliveries MUST be refused for private, loopback and link-local addresses unless the operator allow-lists them. The address MUST be checked after DNS resolution at connect time and again on every redirect.

**Events and triggers**

- **FR-023**: The platform MUST accept CloudEvents 1.0 from authenticated users and applications, in HTTP structured and binary modes. Each event MUST be accepted once per source and id; a duplicate MUST be acknowledged and have no effect.
- **FR-024**: Editors MUST be able to create, list and delete webhooks.
  - A webhook MUST have a name and a CloudEvent type, and an unguessable URL that is returned only at creation and stored only as a fingerprint.
  - Each request to the URL MUST be acknowledged without waiting for any workflow, and MUST be accepted as one event with the webhook's type, the webhook as its source, and the request body, query parameters and headers as its data. `Authorization` and `Cookie` headers MUST be dropped, and a body that is not JSON MUST be carried as text.
  - Requests with the same idempotency key MUST be accepted once within 24 hours.
  - Requests to a deleted webhook, to an unknown URL, or above the event size limit MUST be refused without accepting an event. Deleted and unknown URLs MUST answer in the same way.
- **FR-025**: Editors MUST be able to create, list, read and delete event subscriptions.
  - A subscription MUST have a name, a destination endpoint in the standard's endpoint form (a URI and, optionally, a basic or bearer authentication that takes its values from one of the owner's secrets), and an event filter in the standard's event-filter form (`with` attributes, matched as `listen` matches them).
  - Each matching event MUST be delivered as a CloudEvent in HTTP structured mode. A 2xx answer means delivered.
  - Failed deliveries MUST be retried with exponential back-off for up to 24 hours, then marked failed and kept for inspection.
  - The owner MUST be able to see, per subscription, which recent events are delivered, pending or failed, with the last error.
  - Deliveries to one subscription MUST NOT delay workflows or other subscriptions.
- **FR-026**: Every event the platform accepts or produces — through the intake, a webhook, an `emit` task or a lifecycle change — MUST be delivered at least once to every matching listening instance, schedule and subscription.
  - Delivery MUST happen only after the event is recorded, MUST survive the crash of any process, and MUST keep the event's id on every attempt.
  - The delivery order across retries is not guaranteed. Lifecycle events carry their sequence number within the instance, so receivers can order them.
- **FR-027**: `listen` MUST support:
  - the `one`, `any` and `all` strategies, and `until`;
  - the `with` filters and `correlate` keys;
  - the `data`, `envelope` and `raw` read modes;
  - `foreach`, in acceptance order.

  A `listen` task MUST consider only events accepted after it started.

- **FR-028**: `emit` MUST publish the event its task declares; the DSL 1.0.3 schema requires only `source` and `type`.
  - The platform MUST generate the `id`, `time` and `specversion` attributes the task leaves out.
  - The task's output MUST be the emitted CloudEvent.
  - The event MUST be recorded together with the task's completion, so that a recovered instance never emits it twice. From there it is delivered as FR-026 defines.
- **FR-029**: `schedule` MUST support `cron` (in UTC), `every`, `after` and `on`, for workflows that are on (FR-006).
  - Each occurrence MUST start exactly one instance across all workers.
  - After downtime, at most one missed occurrence MUST start.
  - `on` MUST start one instance per satisfied strategy, with the consumed events as its input.
  - `after` MUST start the next instance the given delay after an instance it started completes, and the first one when the workflow is turned on.
  - The platform MUST keep no workflow data between the instances a schedule starts.
- **FR-030**: The platform MUST produce the standard's required lifecycle events, with the data the standard defines for each:
  - workflow: started, suspended, resumed, correlation started, correlation completed, cancelled, faulted, completed;
  - task: created, started, suspended, resumed, retried, cancelled, faulted, completed.

  How lifecycle events are produced and delivered:
  - The optional status-changed events are not produced.
  - An event MUST be produced only after its change is recorded, never for an unrecorded change, and in the order of changes per instance.
  - Every event MUST be part of the instance's execution history and MUST be delivered as FR-026 defines.
  - When including the optional `output` would make an event larger than 64 KiB, the output MUST be left out of the event; it stays readable in the execution history.

**Access and conformance**

- **FR-031**: Access MUST be denied by default.
  - Administrators and editors MUST be able to:
    - publish workflows;
    - turn workflows on and off;
    - start and control instances;
    - manage webhooks, subscriptions and their own secrets;
    - publish events.
  - Viewers MUST be able to read workflows, versions and instances only.
  - Webhook URLs MUST be callable without signing in.
- **FR-032**: Every scenario of the standard's Conformance Test Kit for DSL 1.0.3 that uses only supported constructs MUST pass unmodified through the platform's public interface. Every scenario that uses an unsupported construct MUST be refused at publish.
  - A scenario that contradicts the specification's own text MUST follow the specification. It is listed as a recorded contradiction.
  - The one known case is `try.feature`, scenario "Try Handle Caught Error", which filters on an error type URI that the specification does not define.

### Evolution Requirements

These requirements keep the core open to the iterations listed in "Foundation for Later Iterations".

- **ER-001**: The supported subset MUST be declared in one place, and the platform MUST publish it through its interface as its statement of partial conformance. Publishing MUST check documents against that statement. Adding a construct in a later iteration MUST make documents that use it publishable, and MUST NOT change versions, instances or history that already exist.
- **ER-002**: Each version MUST keep the DSL version it declares, and its instances MUST run under that version's rules, so that a later DSL release (for example 1.0.4) can be supported next to the earlier ones.
- **ER-003**: Every interaction with an external system MUST pass through the same safeguards: secret resolution and masking (FR-007), limits (FR-021), address restrictions (FR-022) and at-least-once semantics (FR-018). This applies to calls of the supported types now and to agent, tool and file interactions added later.
- **ER-004**: Instance data MUST be JSON values. Binary content MUST travel only as base64 text within the data size limit, or as a URI that names an external resource. File support can then add a store and URIs without changing the data model.

### Architecture Requirements

These constraints come from the request. They shape the plan, not the user-visible behaviour.

- **AR-001**: The domain model MUST be designed with the tactical building blocks of Domain-Driven Design as described in Vladimir Khorikov's posts on enterprisecraftsmanship.com: entities, value objects, aggregates, domain events, domain services and repositories, plus specifications where a rule needs one. Each building block used MUST be shaped by the post that covers it, and the plan MUST name that post. Each aggregate MUST be justified by the business consistency it protects. The model's vocabulary is the standard's.
- **AR-002**: The code MUST follow The Clean Architecture (Robert C. Martin, 2012).
  - Source dependencies point inward.
  - Entities hold the enterprise rules and record what happens to workflows and instances.
  - Use cases orchestrate.
  - Interface adapters convert between the use cases and external formats, protocols and stores.
  - Frameworks and drivers stay in the outermost circle.
- **AR-003**: Domain events MUST follow "Domain events: simple and reliable solution".
  - Aggregates raise them only for effects that leave the transaction, and collect them in their own list.
  - The events are stored in the same transaction as the change, then dispatched after commit through the outbox to idempotent handlers.
  - Accepted, emitted and lifecycle events are such effects, and the outbox is what gives FR-026 its guarantee.
- **AR-004**: The platform MUST use the framework's first-party reliability modules wherever they fit, each as its documentation describes:
  - **Durable execution:** `@nestjs/workflows`, whose per-instance journal limit is accepted.
  - **Idempotent commands and webhook requests:** `@nestjs/idempotency`.
  - **Event delivery and every other effect that leaves the process:** `@nestjs/outbox`.
  - **Timeouts and bulkheads on outbound interactions, and circuit breakers on deliveries:** `@nestjs/resilience`.

  `@nestjs/schedule` and `@nestjs/locks` fit periodic housekeeping, such as purging finished runs and pruning library tables. They arrive with the retention feature, because this feature has no periodic job.

- **AR-005**: Horizontal scaling MUST rest on shared durable storage only. The API and the workers are stateless. Instances, timers, schedules, event subscriptions, deliveries and deduplication records MUST NOT depend on process memory or on a single leader process for correctness.
- **AR-006**: Before code, a DDD critic (Khorikov's posts) and a Clean Architecture critic (Martin, 2012) MUST review the design and each slice's intended code, and their findings MUST be resolved.
- **AR-007**: This feature changes the API only; the web application MUST NOT be modified. Tests MUST follow the constitution's layer mapping, and the conformance kit MUST run through the HTTP interface.

### Key Entities

- **Workflow**: a named automation within a namespace. It groups its versions, points to its current version, and is on or off.
- **Workflow version**: one immutable DSL document, identified by namespace, name and version. It records who published it and the DSL version it declares.
- **Workflow instance**: one execution of a version. It has a phase, an input, an output or error, start and end times, and the event subscriptions it holds.
- **Task instance**: one execution of a task inside an instance. It has its location in the document, a status, an input, an output, an error, retry attempts and a parent task.
- **Event**: a CloudEvent accepted or produced by the platform. It comes from the intake, a webhook, an `emit` task or a lifecycle change, and is unique by source and id.
- **Webhook**: a named inbound URL that turns each request into an event of its declared type. It keeps only the fingerprint of its secret.
- **Subscription**: an owner's standing request to receive the events that match a filter at a destination endpoint.
- **Delivery**: the attempts to hand one event to one subscription. Its status is pending, delivered or failed, with the last error.
- **Correlation**: an instance's or a schedule's standing interest in events. It holds filters, correlation keys, a strategy and the events collected so far.
- **Schedule**: the automatic-start timing declared by a workflow's current version, with its next due occurrence.
- **Secret**: a named, encrypted credential owned by one user and resolved when that user's versions and subscriptions need it.
- **Lifecycle event**: the record of one change of an instance or a task, with a stable id and a sequence number within the instance.
- **Workflow error**: the standard's error value (type, status, instance, title, detail), carried by faulted tasks and instances.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: 100% of the conformance-kit scenarios inside the supported subset pass unmodified, except the recorded contradiction of FR-032, and 0 scenarios outside the subset are accepted for execution.
- **SC-002**: In a corpus of at least 30 defective documents that covers schema, subset, reference and expression defects, 100% are refused at publish with every defect located. 0 documents from a corpus of valid ones are refused.
- **SC-003**: In a fault-injection run of 1,000 instances, with a random worker killed every 10 seconds, 100% of the instances reach the same terminal phase and output as in an undisturbed run. 0 tasks recorded as completed execute again, as counted by an external test endpoint.
- **SC-004**: Under the same load of workflows whose calls take 200 ms, doubling the workers from 2 to 4 raises completed instances per minute by at least 1.7×.
- **SC-005**: With 10,000 instances waiting on timers or events at once, newly started short instances complete within 10% of the time they take with no waiting instances.
- **SC-006**: Waits, retry delays and scheduled starts fire within 5 seconds of their due time. A due time that passed during downtime fires within 5 seconds of recovery.
- **SC-007**: An accepted event reaches a matching listening instance or schedule within 2 seconds at the 95th percentile, and 0 duplicate events cause a second effect.
- **SC-008**: Webhook calls are acknowledged within 1 second at the 95th percentile, however long the triggered workflows run.
- **SC-009**: Run this scenario: a subscription receiver is unreachable for 10 minutes while workers are killed at random. 100% of the matching events reach the receiver within 2 minutes after it becomes reachable again, and every repeated delivery carries the original id. When the receiver is reachable, events arrive within 5 seconds at the 95th percentile.
- **SC-010**: 100 concurrent start requests with the same idempotency key create exactly 1 instance.
- **SC-011**: Across all test suites, 0 secret values appear in records, events, deliveries, logs or error messages that the platform writes, as verified by scanning them for the test secrets.
- **SC-012**: 0 network connections succeed from scripts and shell commands across all test suites. A script that exceeds its time or memory limit is stopped within 1 second of the limit.
- **SC-013**: Every functional and evolution requirement and every edge case in this specification is covered by at least one automated test, and all test suites pass.

## Assumptions

- **Product.** Like Synapse, the platform orchestrates and integrates services and applications for technical users. Unlike it, the platform is also a product for non-technical users:
  - users manage credentials, webhooks, subscriptions, on and off, and history themselves, not through deployment configuration;
  - every wait, schedule and event delivery is durable.
- **Standard.**
  - The standard is the Open Workflow Specification (CNCF Sandbox, formerly Serverless Workflow), DSL 1.0.3, the latest release.
  - Lifecycle event types use that release's `io.serverlessworkflow` namespace.
  - Constructs that exist only on the unreleased 1.0.4 line wait until it is released (ER-002). They include runtime-generated `emit` ids, `outputUri`, `catch.then`, `schedule.read` and the `org.open-workflow-specification` namespace.
- **Additions to the standard.** The platform adds only two things. Both feed the standard's own mechanisms; neither adds a concept to the DSL.
  - **Webhooks** produce ordinary CloudEvents, which workflows consume with the standard's `schedule.on` and `listen`. Verifying provider-specific request signatures is not part of this feature.
  - **The on/off switch** governs the standard's `schedule`, which already provides the cron and interval starts used for polling.
- **Subscriptions are not an addition.** They are how the platform publishes the events the standard requires it to publish.
  - They follow the CloudEvents HTTP binding in structured mode, as the standard recommends.
  - They use the standard's endpoint, authentication and event-filter forms.
- **Where the standard is silent or inconsistent.**
  - The standard defines phases but no transition rules and no suspend, resume or cancel operation. This specification fixes those rules in User Story 9.
  - The standard leaves several things to the runtime. This specification fixes them in FR-007, FR-025 and FR-030:
    - how lifecycle and emitted events are transported;
    - whether the optional status-changed events are produced.
  - Where the standard contradicts itself, the stricter reading applies and the planning records the decision. Examples:
    - `$secrets` is described as usable only in `input.from`, but a table allows it everywhere;
    - `run.workflow.version` is marked required but defaults to `latest`, so `latest` is accepted.
- **Durable engine journal.**
  - The durable engine bounds the journal of each instance. This limitation is accepted.
  - The task-execution limit (FR-021) sits within that bound. An instance that reaches it faults, and no workaround, such as continuing as a new instance, is provided.
- **Conformance kit.**
  - The kit's 21 scenarios cover calls, data flow, switch, flow, try, fork, do, emit, for, raise and set.
  - The platform's own tests verify everything else: listen, wait, schedule, timeouts, retries, export, webhooks, subscriptions, delivery and lifecycle events.
  - Kit scenarios that call public hosts run against local stand-ins of those hosts. The scenario text stays unchanged, and the stand-ins are allow-listed (FR-022).
- **Roles.** Roles come from feature 001. Non-technical and technical authors are editors. Administrators have editor rights. Viewers read.
- **Application access.**
  - Applications send events through webhooks without signing in, and they receive events through subscriptions.
  - To start workflows or publish CloudEvents through the API, an application authenticates as a user of feature 001.
  - Dedicated machine credentials, such as API keys, belong to a later feature.
- **Default limits.** These defaults apply unless the operator changes them within the engine's bounds:
  - 10,000 task executions per instance;
  - 1 MiB for each task's input, output and exported context;
  - 256 KiB per accepted event or webhook request;
  - for an outbound call, a 30-second timeout when the document sets no shorter one, and a 1 MiB response;
  - for a subscription delivery, a 10-second timeout, with retries for 24 hours;
  - for a script or shell command, 30 seconds when the document sets no shorter timeout, 256 MiB of memory, 50 processes and 1 MiB of output per stream.

  Idempotency keys are kept for 24 hours. Request rates on webhook URLs are limited by the API gateway, as on every public route.

- **Retention.** Instance records, task records, accepted events and deliveries are kept. Purging them belongs to a later feature.
- **Later features.** These are listed in "Foundation for Later Iterations":
  - the no-code editor;
  - the catalog of reusable functions;
  - AI agents with tools;
  - a workflow-building assistant;
  - files;
  - containers and local tools;
  - DSL 1.0.4;
  - machine credentials.

  Also later: sharing secrets between users, multi-tenancy, and retention with its housekeeping jobs.

- **Out of scope.**
  - Constructs outside the supported subset (FR-011). Leaving them out is the platform's only deliberate departure from the standard. The standard lists `run: container` with the tasks every runtime must support, and gRPC, AsyncAPI and A2A with the calls every runtime must support. The departure is declared as partial conformance (ER-001).
- **Sandbox.** The sandbox is go-judge, run as a separate service:
  - its file system provides Node.js and Python 3;
  - it has network access disabled;
  - it runs under cgroup limits.
  - The unreleased DSL 1.0.4.
- **Scheduling.** Cron expressions are evaluated in UTC. An `every` schedule starts an occurrence even while the previous instance still runs, as the standard defines.
- **Planning.**
  - Before design, the plan reads:
    - the standard's `dsl.md` and `dsl-reference.md` for 1.0.3;
    - the CloudEvents 1.0 specification and its HTTP binding;
    - the documentation of `@nestjs/workflows`, `@nestjs/idempotency` and `@nestjs/outbox`;
    - the Khorikov posts;
    - the 2012 Clean Architecture article.
  - Constitution 3.0.1 governs the plan's Constitution Check.
