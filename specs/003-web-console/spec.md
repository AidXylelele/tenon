# Feature Specification: Web Console

**Feature Branch**: `003-web-console`

**Created**: 2026-11-03

**Status**: Draft

**Input**: User description: "реализуй теперь UI ко всему этому разработанному функционалу, чтобы можно было потестировать. Основное - отзывчивость, информативность и простота и возможность как "продвинутого" использования, так и основной упор на no-code. Дизайн делай современным, чистым, красивым, минимализм, используй стабильные и красивые и популярные библиотеки для UI. Архитектура как я и говорил строго по строгой и заданной архитектуре. Важно - скорость интерфейса, и его информативность, отзывчивость, чтобы не оставлять пользователя в недоумении что происходит в системе."

## User Scenarios & Testing _(mandatory)_

The console is the "no-code editor (web)" that feature 002 lists under its later iterations, together with every screen a person needs to use what features 001 and 002 built. It adds no behaviour to the platform: every rule stays in the API, and the console shows the API's answers.

Two audiences use it ([002 spec](../002-workflow-engine/spec.md), Actors):

- **Non-technical authors** build automations from forms and see what they do. The console is built for them first.
- **Technical authors** edit the same document as YAML or JSON, and see each problem at its line.

Three rules hold on every screen:

- **Nothing happens silently.** An action shows that it is in progress at once, and then its outcome, or the API's reason for refusing it.
- **Live state is live.** What is still in flight (an instance that runs or waits, a delivery that is pending) refreshes by itself until it settles, and says when it was last updated.
- **Roles are visible.** A control that the signed-in role cannot use is not offered, and the screen says why.

### User Story 1 - Sign in and find one's way (Priority: P1)

A person signs in with email and password and lands on the console: navigation to workflows, instances and the integration screens, their name and role, and sign-out. A visit to any console page while signed out leads to the sign-in page, and back to that page after signing in.

**Why this priority**: Every other story needs a session.

**Independent Test**: Sign in as each role, see the navigation the role allows, sign out, and be asked to sign in again.

**Acceptance Scenarios**:

1. **Given** an account, **When** its owner signs in with the right password, **Then** the console opens on the page they asked for, or on the workflows overview.
2. **Given** a wrong password or an unknown email, **When** someone signs in, **Then** the same message is shown for both, and the form keeps the email.
3. **Given** a session that ended (signed out elsewhere, expired, password changed), **When** the person acts, **Then** they are taken to sign in, told why, and returned afterwards.
4. **Given** a viewer, **When** they open the console, **Then** the integration screens and every control that changes something are absent, and a read-only note says so.

---

### User Story 2 - Build and publish a workflow without code (Priority: P1)

An author creates a workflow by naming it and adding tasks from a palette of the kinds the platform supports (as its conformance statement lists them). Each task is configured through a form with plain labels, a short explanation and an example. Tasks can be reordered, removed, and nested where the kind takes tasks (loops, branches, try and catch). A trigger is chosen at the top: started by hand, on a schedule (a cron expression, every interval, or a delay after the previous run), or when an event of a type arrives.

While the author works, the console checks the document with the platform and shows either "ready to publish" or the first problem, on the task and field it concerns. Publishing creates the version; editing a published workflow proposes the next version number.

**Why this priority**: This is the no-code core the platform exists for (002 spec, Audiences).

**Independent Test**: Build "fetch a URL, keep a field of the answer, wait one minute, emit an event" from forms only, see one problem shown on its field, fix it, publish, and find the version listed.

**Acceptance Scenarios**:

1. **Given** an editor, **When** they add, configure, reorder and delete tasks, **Then** the outline shows the order the workflow will run in, and nested tasks inside their parent.
2. **Given** a document with a problem, **When** the check answers, **Then** the problem's reason is shown on the task and field at its location, and publishing is held until the document checks clean.
3. **Given** a clean document, **When** the editor publishes, **Then** the new version is the workflow's current one, and the console offers to start it.
4. **Given** a published workflow, **When** the editor opens it for editing, **Then** the current version loads into the builder with the next patch version proposed.
5. **Given** a trigger on a schedule or an event, **When** the version is published, **Then** the workflow page says the workflow is off until turned on, and what turning it on will start.

---

### User Story 3 - Start an instance and watch it run (Priority: P1)

A person starts the current version (or a chosen one) with an input given as a form for the input schema's fields when the schema is simple, or as JSON. The instance page then shows, live: the phase, each task as it starts and ends with its duration, input and output, the events the instance produced, and its output or error. A faulted instance points at the task that faulted and shows the error's type, status and detail. Controls offer only what the phase allows: suspend, resume, cancel, restart, delete.

**Why this priority**: Running and watching is how authors learn whether an automation works; it makes the platform testable end to end.

**Independent Test**: Start a workflow with a wait and see the instance go from pending to running to waiting to completed without reloading; fault one on purpose and see the faulting task highlighted with the error.

**Acceptance Scenarios**:

1. **Given** a published workflow, **When** an editor starts it with an input, **Then** the instance page opens at once and shows progress as it happens.
2. **Given** a running instance, **When** a task starts or ends, **Then** the console shows it within two seconds, without a reload.
3. **Given** a faulted instance, **When** it is opened, **Then** the faulting task is marked in the outline and the error's type, status, title and detail are shown.
4. **Given** an instance in any phase, **When** it is opened, **Then** only the controls that phase allows are offered; a refused control shows the API's reason.
5. **Given** a start retried after a network failure, **When** the same start reaches the platform twice, **Then** one instance exists.

---

### User Story 4 - Edit the document as code (Priority: P2)

A technical author switches the builder to code: the same document as YAML (or JSON), with syntax highlighting. Edits in either view show in the other. The check marks the problem at its line. A document can be pasted or loaded from a file. Any published version's document can be read as YAML.

**Why this priority**: Technical authors and documents beyond the builder's forms need it; it also makes every construct of the subset reachable.

**Independent Test**: Paste a CTK document, see it checked, introduce an error, see it marked at its line, publish it.

**Acceptance Scenarios**:

1. **Given** the builder, **When** the author switches to code and back, **Then** neither view loses an edit.
2. **Given** a construct the forms do not offer, **When** the document carries it, **Then** the builder shows it as an "advanced" task that can be edited as code, and keeps it unchanged.
3. **Given** text that is not valid YAML or JSON, **When** it is typed, **Then** the parse error is shown at its line, and the builder keeps the last valid document.

---

### User Story 5 - Manage workflows (Priority: P2)

The workflows page lists workflows with their current version, whether they start automatically, and their status, active or archived. A workflow page shows the trigger in plain words, its versions in publishing order, its recent instances, and the controls: turn on or off, edit, start, archive. The platform's conformance statement is readable from the builder.

**Why this priority**: Operating several automations needs an overview and the on/off switch.

**Independent Test**: Turn a scheduled workflow on and see its first scheduled instance appear; archive it and see it read-only.

**Acceptance Scenarios**:

1. **Given** workflows, **When** the list opens, **Then** each shows its name, namespace, current version, on/off and status, and active and archived workflows can be filtered.
2. **Given** a scheduled workflow, **When** an editor turns it on, **Then** the switch changes at once, and returns with the API's reason if refused.
3. **Given** an archived workflow, **When** it is opened, **Then** it is read-only and says why.

---

### User Story 6 - Find instances (Priority: P2)

The instances page lists instances newest first, filtered by workflow, version, phase and start period, with what started each one (by hand, schedule, event, parent, restart). Unended instances update live. The list pages on.

**Why this priority**: Execution history is how viewers follow automations (002 spec, Actors).

**Independent Test**: Filter to faulted instances of one workflow in the last hour and open one.

**Acceptance Scenarios**:

1. **Given** instances, **When** filters are set, **Then** the list shows matching instances and the filters are kept in the address, so the view can be shared and reloaded.
2. **Given** running instances in the list, **When** they end, **Then** their phase changes without a reload.

---

### User Story 7 - Connect other applications (Priority: P2)

An editor creates webhooks (the URL is shown once, with a copy button and an example call), keeps secrets (a value is entered once and never shown again; it can be replaced or deleted), sends a CloudEvent from a form to test triggers and listeners, and subscribes an endpoint to events with a filter, optionally authenticated with one of their secrets. A subscription page shows its recent deliveries with status, attempts and last error, live while any is pending.

**Why this priority**: Webhooks, events and subscriptions are the platform's integration channels (002 spec, Integration channels).

**Independent Test**: Create a webhook for a type, call it with the shown example, see the event start a workflow that is on for that type; subscribe an endpoint and watch its delivery succeed.

**Acceptance Scenarios**:

1. **Given** a created webhook, **When** its page is left, **Then** the URL is not shown again, and the list says so.
2. **Given** a secret, **When** it is listed, **Then** only its name and dates are shown; replacing it asks for a new value only.
3. **Given** a subscription with a filter whose pattern does not compile, **When** it is saved, **Then** the problem is shown on that filter field.
4. **Given** a pending delivery, **When** its page is open, **Then** the delivery's attempts and status update until it is delivered or failed.

---

### User Story 8 - Account and team (Priority: P3)

A signed-in person changes their password. Someone who forgot theirs requests a recovery link and sets a new password from it. An administrator invites people with a role, sees pending invitations and revokes them; an invited person opens the link, sees the email and role, and creates their account.

**Why this priority**: Feature 001's flows are needed to bring a team in, but a single seeded administrator can test everything else.

**Independent Test**: Invite an editor, accept the invitation from the emailed link, sign in as the editor.

**Acceptance Scenarios**:

1. **Given** a recovery request, **When** it is sent, **Then** the same confirmation is shown whether or not the address is registered.
2. **Given** an expired or used link, **When** it is opened, **Then** the page says so and offers what to do next.
3. **Given** an administrator, **When** they invite an address that already has an account, **Then** the API's reason is shown on the form.

---

### Edge Cases

- The API is unreachable or answers 503: the page says the platform is unavailable and retries; nothing is lost from a form being edited.
- A request takes long: the pending state stays visible, and the control cannot be pressed twice.
- Two people edit the same workflow: publishing the same version number with another document is refused with the API's reason; the builder proposes the next free version.
- A document larger than the API's limit (1 MiB): refused with a clear message before upload.
- A live view left open in a background tab stops refreshing until the tab is shown again.
- An instance with thousands of task records: the timeline pages, and the outline shows the latest state per task.
- Deep links to a deleted instance, an unknown workflow or a deleted subscription show a "not found" page with a way back.
- A narrow screen (360 px): every page works without horizontal scrolling; the builder stacks its panes.

## Requirements _(mandatory)_

### Functional Requirements

**Session and shell**

- **FR-001**: The console MUST sign people in and out through feature 001, keep the session only where page scripts cannot read it, and return a signed-out visitor to the page they asked for after signing in.
- **FR-002**: The console MUST show navigation, controls and pages by role: viewers read workflows, versions and instances only (002 FR-031); integration screens are for editors and administrators; invitations for administrators.

**Workflows**

- **FR-003**: Editors MUST be able to build a document from forms: document name, namespace, version, title and summary; the trigger (manual, `schedule.cron`, `every`, `after`, `on` one event type); and tasks of the kinds in the platform's conformance statement, nested where the kind takes tasks.
- **FR-004**: The console MUST check the document with the platform while it is edited (the API's check without publishing, 002 FR-003) and show the first problem at its location: the task and field in the builder, the line in the code view.
- **FR-005**: Editors MUST be able to edit the same document as YAML or JSON, load one from a file or paste it, and switch views without losing edits; constructs the forms do not cover MUST be kept unchanged and editable as code.
- **FR-006**: Editors MUST be able to publish, turn on and off, and archive workflows; everyone MUST be able to list workflows (active or archived), read a workflow with its trigger in plain words, its versions and its recent instances, and read any version's document.

**Instances**

- **FR-007**: Editors MUST be able to start a version with an input, given as JSON or, for a simple input schema, as a form; a start MUST carry an idempotency key, so a retried start creates one instance.
- **FR-008**: The instance page MUST show the phase, trigger, origin, input, output or error, the task records in start order with status and duration, the events, and the outline of the workflow with each task's latest status; while the instance has not ended, it MUST refresh by itself at least every two seconds.
- **FR-009**: Editors MUST be able to suspend, resume, cancel, restart and delete an instance; the console MUST offer only the controls the phase allows and show the API's reason when one is refused.
- **FR-010**: Everyone MUST be able to list instances newest first, filtered by workflow, version, phase and start period, with the filters in the address, paged, and live while any listed instance has not ended.

**Integrations**

- **FR-011**: Editors MUST be able to create, list and delete webhooks; the URL MUST be shown only right after creation, with a copy control and an example call.
- **FR-012**: Editors MUST be able to create, list, replace and delete their secrets; a value MUST never be shown after it is typed.
- **FR-013**: Editors MUST be able to send a CloudEvent from a form (type, source, subject, data as JSON), with id and time filled in.
- **FR-014**: Editors MUST be able to create, list, read and delete subscriptions with an endpoint, an optional authentication by one of their secrets, and a filter on event attributes; the subscription page MUST show its recent deliveries and refresh while any is pending.
- **FR-015**: Everyone MUST be able to read the platform's conformance statement (supported DSL versions, tasks, calls, runs, authentications, exclusions, recorded contradictions).

**Account and team**

- **FR-016**: The console MUST cover feature 001's flows: password change, recovery request and completion, invitations (create, list, revoke) for administrators, and invitation acceptance.

**Feedback**

- **FR-017**: Every action MUST show its pending state at once, block a second submission while pending, and end in a visible outcome: success, or the API's refusal with its title and detail; a refusal located in a request MUST be shown on its field.
- **FR-018**: Navigation MUST show the target page's frame immediately and fill it as data arrives; a failure in one part of a page MUST NOT blank the rest.
- **FR-019**: Live views MUST say when they were last updated, pause while the page is hidden, and stop once what they show has settled.

**Quality**

- **FR-020**: Every page MUST work from 360 px wide screens to desktops, follow the system's light or dark preference, and meet WCAG 2.2 AA (keyboard use, labels, contrast).
- **FR-021**: The console MUST send a Content Security Policy, HSTS and the standard hardening headers, and render all user content escaped (constitution, Security requirements).

### Key Entities

The console keeps no data of its own beyond the session. It shows the API's resources (002 data model): workflow, version, document, instance, task record, event, webhook, secret, subscription, delivery, conformance statement; and feature 001's session, user and invitation.

- **Draft document**: the document being built or edited, held in the browser until published; it is the single source both the forms and the code view edit.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: A first-time author builds, publishes and runs a three-task workflow from forms only, without help, in under five minutes.
- **SC-002**: Every action shows its pending state within 100 ms; a page's frame appears within 100 ms of navigation and its content within one second on a local deployment.
- **SC-003**: A task that starts or ends appears on an open instance page within two seconds.
- **SC-004**: Every problem the check reports is shown at its location: on a task and field in the builder, or at a line in the code view.
- **SC-005**: Every page is usable at 360 px wide without horizontal scrolling of the page.
- **SC-006**: No secret value and no webhook URL is shown after the screen where it was entered or created.

## Assumptions

- **Language.** The console is in English, like the API's messages and the standard's terms.
- **Scope of no-code forms.** Forms cover `set`, `call: http`, `wait`, `emit`, `listen` (one event), `raise`, `switch`, `for`, `fork`, `try`, `do`, `run: workflow`, `run: script` and `run: shell`. `call: openapi`, `use.functions`, `use.authentications` and other constructs of the subset are edited as code and kept unchanged by the forms.
- **Input form.** A start offers a form only when the version's input schema is an object of string, number, integer or boolean fields; otherwise JSON.
- **Live updates** poll the API through the console's server; the API offers no push channel.
- **People.** The API lists no users; the console shows the signed-in user and invitations only.
- **Out of scope**: machine credentials, user management beyond invitations, a canvas with free node placement, an assistant that builds workflows, localisation.
