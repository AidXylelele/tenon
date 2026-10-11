# Feature Specification: Workflow Builder and Core Nodes

**Feature Branch**: `002-workflow-builder`

**Created**: 2026-10-11

**Status**: Draft

**Input**: User description: "Теперь нужно приступить к реализации основной механики приложения - построения workflows, создание, редактирование, узлы code nodes, все основные узлы (из n8n) (но не интеграции с внешними сервисами - это все отдельно). Строить его нужно поверх nest/workflows, nest экосистеме, поэтому сначала изучай документацию. Следуй архитектуре из документации проекта. Начинай в новой ветке разработку."

## Clarifications

### Session 2026-10-11

- Q: Is the generic HTTP Request node part of this feature, or does it belong with the external integrations? → A: Part of this feature, because it is a core part of the platform. Authenticated requests therefore need stored credentials, and the constitution requires credentials used by automations to be encrypted at rest and scoped to the owning user. So this feature also delivers a minimal credential store for the generic HTTP authentication types (header, basic, bearer, query parameter); service-specific credential types stay with the integrations.
- Q: Are workflows shared by everyone, owned by their creator, or private? → A: Owned by their creator: every signed-in user sees every workflow, its versions and its runs; only the owner or an administrator changes, publishes, activates or runs it.
- Q: How do users write expressions in node parameters? → A: The option that serves a no-code editor best, keeping user errors and the entry barrier low:
  - A parameter value is typed: a fixed value, a field reference, or a formula.
  - The editor builds field references by picking from the known output of earlier nodes; they point to the node, not its name, so renames do not break them.
  - Formulas are a safe subset of n8n-style expressions, kept for advanced cases.
- Q: How does the editor save changes to a draft? → A: The whole graph and settings in one atomic request that names the revision it was based on; a stale revision is refused as a conflict; the response carries the new revision and the validation report.
- Q: How much work of a node with external effects may repeat after the execution process fails in the middle of it? → A: The checkpoint is the node, because that is simpler. An unfinished node runs again from its start, so its requests may be sent again. Making those operations idempotent is the integrator's task, and the platform supplies a stable idempotency key per request.
- Q: Should the editor be able to test a single node without running the whole workflow? → A: No. Only full test runs of the draft, with pinned sample output standing in for nodes that should not run again.
- Q: Which languages does the Code node support, and what can scripts use? → A: The goal is to support the popular programming languages conveniently through one contract: items in, a list of objects out, n8n-style helpers in each language, and a fixed set of preinstalled libraries per language. This feature delivers JavaScript, TypeScript and Python; further languages follow later through the same contract.

### Session 2026-10-12

- Q: Should the HTTP Request node paginate? → A: Yes. Pagination is configured as declaratively as possible, with n8n's flexibility. Ready-made choices cover how pages advance (page number, offset, cursor, next link including the `Link` header) and when they end, and formulas with `$response`, `$pageCount` and `$request` cover unusual APIs. n8n's known gaps are closed: restart loops on a missing cursor, no cycle detection, no per-page retry or `Retry-After`, flat parameter names, and `+json` bodies left unparsed (FR-037).

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Build a workflow and test-run it (Priority: P1)

An editor creates a workflow and becomes its owner. The owner adds a trigger and processing nodes from the node catalogue, connects them, sets their parameters and saves the draft. The owner then starts a test run of the draft with sample input and sees, node by node, the status, the number of items each node produced, the produced items and any error with the node and the reason. Other users see the workflow and its runs but cannot change or run it.

**Why this priority**: Building and trying a workflow is the core loop of the platform; every other capability (code, HTTP calls, publishing, schedules, webhooks, history) builds on a saved graph and on the run engine.

**Independent Test**: Create a workflow with a Manual Trigger, an Edit Fields node and an If node; save it; start a test run with three input items; confirm the run succeeds, each node reports its item count, the If node routes the items to the expected branches, and the produced items can be read page by page; confirm another editor can read but not change or run the workflow.

**Acceptance Scenarios**:

1. **Given** an editor, **When** the editor creates a workflow with a name, **Then** an empty draft exists, the editor is its owner, and it appears in every signed-in user's workflow list.
2. **Given** a draft, **When** the owner saves a graph of nodes and connections, **Then** reading the workflow returns the same graph, and a validation report lists every problem by node and parameter without blocking the save.
3. **Given** a saved draft with a Manual Trigger, **When** the owner starts a test run with input items, **Then** a run is created at once, executes the nodes in dependency order, and reaches `succeeded` with a step per executed node.
4. **Given** a running or finished run, **When** any signed-in user reads it, **Then** the response shows the run status, the current node while running, and per node the status, item count, duration and error.
5. **Given** a finished step, **When** a user reads its output, **Then** the items are returned page by page in the order the node produced them.
6. **Given** a node that fails, **When** the run reaches it, **Then** the run ends `failed` and the step names the node and the reason; nodes downstream of it do not run.
7. **Given** a running run, **When** the owner cancels it, **Then** the run ends `cancelled` and no further node starts.
8. **Given** two sessions of the owner that loaded the same draft, **When** both save changes, **Then** the second save is refused as a conflict and the first save is kept.
9. **Given** a draft with pinned sample output on a node, **When** a test run reaches that node, **Then** the pinned items are used instead of executing it.
10. **Given** an editor who is not the owner, **When** the editor tries to save the draft, publish, activate, archive, start or cancel a run, **Then** the operation is refused; duplicating the workflow is allowed and makes the editor the owner of the copy.
11. **Given** an administrator, **When** the administrator changes the workflow or transfers its ownership to another editor or administrator, **Then** the change is applied and the new owner can change the workflow.

---

### User Story 2 - Transform data with custom code (Priority: P2)

An editor adds a Code node and writes a short script in JavaScript, TypeScript or Python that receives the incoming items and returns new items, using the same helpers in every language to read the input, the output of earlier nodes and the run details, plus a fixed set of preinstalled libraries. The code runs isolated from the platform, the network and other users' data, within time, memory and output limits; its console output is shown next to the result.

**Why this priority**: The Code node covers every transformation the built-in nodes do not; it is the escape hatch that makes the platform useful before the node catalogue is complete.

**Independent Test**: Build Manual Trigger → Code (multiply a field of every item by two) in each supported language → run with five items and confirm the same output; then confirm that code reading a URL, reading a host file, looping forever or allocating excessive memory fails that node with a clear error while the platform stays available.

**Acceptance Scenarios**:

1. **Given** a Code node in "run once for all items" mode, **When** the run reaches it, **Then** the code receives all incoming items and its returned items become the node output.
2. **Given** a Code node in "run once for each item" mode, **When** the run reaches it, **Then** the code runs for every item and the outputs are concatenated in input order.
3. **Given** the same script written in JavaScript, TypeScript and Python, **When** each runs on the same items, **Then** they produce the same output through the same helpers.
4. **Given** code that throws, returns something other than a list of JSON objects, exceeds the time, memory or output limit, or attempts network or file access, **When** it runs, **Then** the node fails with a message naming the cause, the platform does not retry it on its own (the node's retry setting may retry a thrown error, never a limit or isolation breach), and diagnostics written by the code are attached to the step.
5. **Given** code that writes to the console, **When** it runs, **Then** the written lines are attached to the step as diagnostics, bounded in size.

---

### User Story 3 - Call HTTP APIs with stored credentials (Priority: P3)

An editor stores an API key, a bearer token or a username and password as a credential, and adds an HTTP Request node that calls an external API for every item, authenticating with that credential. When the API returns its data in pages, the editor picks how the pages advance (page number, offset, cursor, next link) and when they end from ready-made choices, writing a formula only for unusual APIs. The node fetches every page and outputs either the records found in them or one item per page. The secret is never shown again after it is saved, never appears in run data or logs, and the node cannot reach the platform's internal network.

**Why this priority**: Calling HTTP APIs is how automations reach the outside world; it is a core capability of the platform, and it must be safe from the first release because it turns user-defined workflows into outbound network traffic.

**Independent Test**: Create a bearer-token credential; build Manual Trigger → HTTP Request (GET an allow-listed test service with the credential) → run with two items and confirm two requests carried the token and the responses became the output; confirm the credential secret appears in no API response, step output or log; confirm requests to loopback, private and metadata addresses, directly or through a redirect or a host name that resolves to them, fail the node; against a test API with cursor, page-number, offset and next-link pagination, confirm each preset collects every record without a formula and stops where the API ends.

**Acceptance Scenarios**:

1. **Given** an editor, **When** the editor creates a credential of type header, basic, bearer or query parameter, **Then** it is stored encrypted, owned by the editor, and later reads return its name, type and dates but never the secret values.
2. **Given** an HTTP Request node with a method, URL, query parameters, headers, body and a credential of the workflow's owner, **When** the run reaches it, **Then** one request per item is sent with the credential applied, and each response becomes an output item with the parsed body and, when asked for, the status code and headers.
3. **Given** a response with a non-success status, **When** the node runs, **Then** the node fails with the status and a bounded excerpt of the body, unless it is set to treat every response as success.
4. **Given** a URL whose host is or resolves to a loopback, private, link-local, multicast or other reserved address, or that redirects to one, **When** the node runs, **Then** the request is refused before any connection to that address, the node fails with a destination-not-allowed reason, and the refusal is never retried.
5. **Given** a credential of another user, **When** an owner references it in a node, **Then** the draft reports a validation problem and the workflow cannot be published.
6. **Given** a credential referenced by an active version, **When** its owner tries to delete it, **Then** the deletion is refused until no active version references it.
7. **Given** a request that exceeds the timeout or a response larger than the response limit, **When** the node runs, **Then** the node fails with the limit named.
8. **Given** pagination by cursor read from a response field, with the records at a field path, **When** the node runs against an API with five pages, **Then** five requests are sent, each carrying the cursor of the previous response, pagination stops when the response has no cursor, and the output holds every record of the five pages in order.
9. **Given** pagination by page number or by offset and limit, **When** the node runs, **Then** the first request carries the configured start value, each following request carries the next value, and pagination stops at the configured completion condition (an empty page, a `hasMore` flag set to false, the reported total reached, or a terminating status code).
10. **Given** pagination by next link read from a response field or from the `Link` header (`rel="next"`), **When** the node runs, **Then** each next link, relative or absolute, is requested until none is returned. A next link to another origin is requested without the credential.
11. **Given** an API that returns the same cursor or next link twice, **When** the node runs, **Then** the node fails with a "pagination did not advance" reason instead of looping.
12. **Given** a page answered with 429 or a temporary server error, **When** the node runs, **Then** that page is requested again, waiting as `Retry-After` asks (at most 60 seconds), up to 3 times, before the node fails; pages already fetched are not requested again within that attempt.
13. **Given** a maximum of N pages, **When** pagination has not completed after N pages, **Then** the node stops with the N pages, or fails when it is set to treat the limit as an error.

---

### User Story 4 - Route, combine and reshape items with core nodes (Priority: P4)

An editor uses the built-in core nodes to filter, branch, merge, sort, aggregate, split and reshape items, convert between text formats, compute hashes and dates, and stop a run with a custom error, without writing code.

**Why this priority**: The core nodes cover the common data handling of automations; they make workflows readable and safe to change without custom code.

**Independent Test**: For each core node in the catalogue, run a workflow that feeds it a fixed set of items and compare the output with the documented behaviour of the node and its options.

**Acceptance Scenarios**:

1. **Given** an If node with a condition, **When** items reach it, **Then** matching items leave through the "true" output and the rest through the "false" output.
2. **Given** a Switch node with rules, **When** items reach it, **Then** each item leaves through the output of the first matching rule, or through the fallback output when configured.
3. **Given** a Merge node with two inputs, **When** both upstream branches have finished, **Then** the output follows the chosen mode (append, combine by matching fields, combine by position, all combinations, or choose one input).
4. **Given** any core node, **When** it receives no items, **Then** it produces no items and downstream nodes are skipped, unless the node is set to always output data.
5. **Given** node parameters set as field references picked from the incoming item or an earlier node, or as formulas, **When** the node runs, **Then** they are resolved per item; a reference to a missing field resolves to empty, and a formula that cannot be evaluated fails the node with the parameter and the reason.
6. **Given** a Stop and Error node, **When** items reach it, **Then** the run ends `failed` with the configured message.

---

### User Story 5 - Publish a version and run it automatically (Priority: P5)

The owner publishes the draft as an immutable numbered version and activates it. Schedule triggers then start runs at the configured times in the configured time zone, and webhook triggers start a run for every authenticated call to the workflow's webhook address. Editing the draft afterwards does not change what runs until the next publish.

**Why this priority**: Automatic execution is what turns a tested workflow into an automation; it requires a validated, immutable version to run against.

**Independent Test**: Publish a workflow with a Schedule Trigger every minute and a webhook workflow; activate both; confirm one run per scheduled minute and one run per webhook call carrying the request body, all against the published version; edit the draft and confirm new runs still use the published version until it is republished.

**Acceptance Scenarios**:

1. **Given** a valid draft, **When** the owner publishes it, **Then** a new immutable version with the next number exists and the draft stays editable.
2. **Given** a draft with a cycle, no trigger, a node of an unknown type, parameters that violate the node definition, or a credential the owner does not own, **When** the owner publishes it, **Then** publishing is refused with the full validation report.
3. **Given** a published version with a Schedule Trigger, **When** the owner activates it, **Then** runs start at each scheduled time in the trigger's time zone, and an occurrence that is due while the previous run of the same schedule is still running is skipped.
4. **Given** an active version with a Webhook trigger, **When** a client calls the webhook address with the endpoint secret, **Then** the call is acknowledged after the run is recorded and the run receives the request method, headers, query and body as its input item.
5. **Given** a webhook call without a valid secret or above the size limit, **When** it arrives, **Then** it is refused and no run starts.
6. **Given** the same webhook delivery received twice with the same delivery identifier, **When** both arrive, **Then** exactly one run exists for it.
7. **Given** an active version, **When** a newer version is published and activated, **Then** the previous activation ends and only the newer version starts runs.
8. **Given** an active workflow, **When** the owner deactivates or archives it, **Then** no further runs start and running runs continue to completion.

---

### User Story 6 - Wait, call sub-workflows and handle errors (Priority: P6)

An editor pauses a run for a period, until a moment in time, or until an external call to the run's resume address; calls another workflow as a sub-workflow and uses its result; configures retries and an "on error" behaviour per node; and assigns an error workflow that runs whenever a run of this workflow fails.

**Why this priority**: Long-running and composed automations need durable waits, reuse and controlled failure handling; they rely on the run engine and on publishing.

**Independent Test**: A run with a Wait node of two minutes ends `waiting`, survives a restart of the execution process and continues afterwards; a run waiting for a resume call continues when the call arrives; a workflow that calls a sub-workflow receives the sub-workflow's last-node output; a failing node with three retries is attempted three times; a failed run starts the assigned error workflow with the failure details.

**Acceptance Scenarios**:

1. **Given** a Wait node set to an interval or a date and time, **When** a run reaches it, **Then** the run is `waiting` until that moment and then continues with the same items.
2. **Given** a Wait node set to wait for a resume call, **When** a call reaches the run's resume address, **Then** the run continues with the items and the call's data; without a call it continues or fails when the optional maximum wait ends, as configured.
3. **Given** a node with "retry on fail" set to N attempts and a wait between them, **When** the node fails for a reason other than a limit or isolation breach, **Then** it is attempted up to N times, waiting between attempts, before the run fails.
4. **Given** a node with "on error: continue", **When** it fails, **Then** the run continues with the node's input items; with "continue through error output", the failed items leave through the node's error output.
5. **Given** an Execute Workflow node referencing a published workflow that starts with an Execute Workflow Trigger, **When** the run reaches it, **Then** the sub-workflow runs with the incoming items, and the caller either waits for its last-node output or continues at once, as configured.
6. **Given** a workflow with an assigned error workflow, **When** a run of it fails, **Then** the error workflow starts once with the failed run, the node and the error message as input.
7. **Given** sub-workflow calls nested beyond the platform depth limit, **When** the next call is made, **Then** the calling node fails with a depth-limit error.

---

### User Story 7 - Review run history and keep it bounded (Priority: P7)

Any signed-in user lists the runs of a workflow with their status, trigger and timing, filters them by status and opens any run to see its steps and outputs. An administrator sets how long runs are kept and how many runs per workflow are kept; older runs and their data are removed automatically every night.

**Why this priority**: History lets users diagnose automations after the fact; retention keeps storage bounded. Both build on runs produced by the earlier stories.

**Independent Test**: Produce runs of several workflows; list and filter them; set retention to one day and a maximum of five runs per workflow; trigger the retention job and confirm that only the allowed runs and their outputs remain and that running runs are untouched.

**Acceptance Scenarios**:

1. **Given** a workflow with runs, **When** a user lists them, **Then** they are returned newest first, page by page, with status, trigger type, version, start and end time, and can be filtered by status.
2. **Given** a retention policy, **When** the nightly retention job runs, **Then** finished runs older than the retention period, and finished runs beyond the per-workflow maximum, are removed together with their step outputs.
3. **Given** a run that is queued, running or waiting, **When** the retention job runs, **Then** the run is kept regardless of its age.
4. **Given** a viewer or an editor, **When** they try to change the retention policy, **Then** the change is refused.

---

### Edge Cases

- A graph with a cycle is saved as a draft with a validation problem and cannot be published.
- A draft with no trigger node is saved with a validation problem and cannot be published or test-run.
- A workflow with several trigger nodes starts each run from the trigger that fired; nodes not reachable from that trigger do not run.
- Nodes not connected to any trigger are reported as unreachable and never run.
- A node type version that is no longer offered for new nodes remains executable for published versions that reference it.
- A Merge node whose one input produced no items follows its mode: append outputs the other input, combine modes output nothing.
- A node output exceeding the item or size limit fails that node with a limit error; earlier outputs remain readable.
- A run exceeding the workflow run timeout ends `failed` with a timeout reason.
- The execution process stops during a run: the run resumes on another process and completed nodes are not executed again.
- The execution process stops in the middle of an HTTP Request node: after recovery the node runs again from its first item, so requests sent before the stop are sent again, carrying the same idempotency keys.
- Runs started while the per-workflow concurrency limit is reached wait in `queued` and start in order.
- A Schedule Trigger in a time zone with daylight-saving changes runs once per scheduled local time, skipping times that do not exist and not repeating times that occur twice.
- Scheduled occurrences that fall due while the platform is unavailable for more than a minute are skipped, not replayed.
- A webhook call to an inactive or archived workflow is refused as not found, without revealing whether the workflow exists.
- A webhook redelivery with a known delivery identifier but a different body is refused as a conflict.
- An Execute Workflow node referencing an archived or unpublished workflow fails with a not-found reason.
- A workflow that calls itself directly or indirectly fails at the depth limit instead of looping forever.
- An error workflow that itself fails does not start another error workflow.
- A Wait node longer than the remaining run timeout fails the run when the timeout is reached.
- A resume call that arrives before the run reaches its Wait node resumes the run as soon as it gets there; a second resume call is refused.
- Cancelling a waiting run ends it `cancelled` without resuming the wait; cancelling while a node executes lets that node finish within its limits, keeps its output, and starts nothing after it.
- Saving a draft while a test run of an earlier draft is in progress does not affect that run, which keeps the graph it started with.
- Archiving a workflow with an active version deactivates it; runs already in progress continue.
- Code that never returns is stopped at the time limit; code that spawns processes or writes outside its scratch area is refused by the isolation.
- A field reference or formula that reads a node that has not run in this run resolves to empty and does not fail the node.
- Renaming a node keeps every field reference to it working and rewrites the node name inside formulas that mention it.
- A field reference to a path that does not appear in the node's known output is saved with a warning, because real data may still contain it; it does not block publishing.
- A disabled node passes its input items through unchanged.
- An HTTP Request host that resolves to a public address when the workflow is saved but to a private address at run time is refused at run time.
- An HTTP Request URL with a scheme other than http or https, or with credentials embedded in the URL, is refused.
- A credential referenced by a draft is deleted: the draft reports a validation problem; the deletion is refused while an active version references it.
- Ownership of a workflow whose nodes reference the previous owner's credentials is transferred: those references become validation problems, and an active version that uses them is deactivated with the reason recorded, so the new owner never runs with the previous owner's secrets.
- A workflow is duplicated by another editor: the copy keeps only credential references that the copier owns and reports the cleared ones as validation problems.
- The owner of an active workflow is suspended: the workflow keeps running; an administrator can transfer its ownership.
- A paginated API returns an empty cursor or next link on the last page: pagination completes; it never restarts from the first page.
- A paginated API returns cursors that cycle (A, B, A): the repeated request fails the node with "pagination did not advance".
- A records path that is absent from a page counts as an empty page; a JSON body that is an empty object counts as having no records when no records path is set.
- Pagination that would exceed the step output limits fails the node with the limit named, and its partial output is discarded.
- A credential secret appears in a response that the HTTP Request node received: it is treated as response data like any other; the platform never adds secrets to outputs, errors, diagnostics or logs itself.

## Requirements _(mandatory)_

### Functional Requirements

**Workflows, drafts and ownership**

- **FR-001**: Editors and administrators MUST be able to create workflows; the creator becomes the owner.
- **FR-002**: Every signed-in user MUST be able to list workflows (paged, with name search and archived and owner filters) and read a workflow with its owner, draft, published versions and activation state.
- **FR-003**: Only the owner or an administrator MUST be able to rename, change the draft, publish, activate, deactivate, archive and restore a workflow and start or cancel its runs; archived workflows are hidden from the default list, cannot be run or activated, and keep their versions and run history.
- **FR-004**: Editors and administrators MUST be able to duplicate any workflow they can read; the copy is owned by the duplicating user and keeps only credential references that user owns.
- **FR-005**: The owner or an administrator MUST be able to transfer ownership of a workflow to another editor or administrator; references to credentials the new owner does not own MUST become validation problems, and an active version using them MUST be deactivated with the reason recorded.
- **FR-006**: A draft MUST hold the graph: nodes (identifier, unique display name, node type and type version, parameters, credential reference, settings, position for the editor, optional note, disabled flag, optional pinned sample output) and connections (from node and output, to node and input), plus workflow settings (time zone, run timeout, error workflow).
- **FR-007**: Saving a draft MUST be accepted even when the graph is invalid and MUST return a validation report listing every problem by node and parameter: unknown node type or version, parameter values that violate the node definition, a missing or foreign credential, a cycle, no trigger, unreachable nodes, connections to ports that do not exist, duplicate node names, field references or formulas that read nodes that do not exist or are not upstream, and formulas that do not parse. These are errors and block publishing and test runs; field paths missing from a node's known output are warnings and block nothing.
- **FR-008**: Saving a draft MUST replace its whole graph and settings in one atomic operation that names the revision it was based on; when the draft changed since that revision, the save MUST be refused as a conflict and change nothing; a successful save MUST return the new revision together with the validation report.
- **FR-009**: A workflow MUST be limited to 200 nodes; parameters of one node MUST be limited to 256 KB.

**Versions and activation**

- **FR-010**: Publishing MUST validate the draft and, when it is valid, create an immutable version with the next version number; an invalid draft MUST NOT be published.
- **FR-011**: A workflow MUST have at most one active version; activating a version MUST register its triggers (schedules, webhook endpoints) and end the previous activation; deactivating or archiving MUST remove them.
- **FR-012**: Runs started by triggers of an active version MUST use that version's graph, unaffected by later draft edits.

**Node catalogue and parameters**

- **FR-013**: The platform MUST serve a catalogue of node types; each entry states its identifier, version, kind (trigger, action, transform), category, display name, description, parameter definitions, accepted credential types, input and output ports, and default settings. Each parameter definition states its type, label, description, default, validation rules, allowed options with labels, whether it accepts field references and formulas, and the values of other parameters under which it applies, so that a client renders every node's form without node-specific code.
- **FR-014**: The catalogue MUST contain the core nodes listed in the "Core node catalogue" section, each behaving as described there.
- **FR-015**: Every node parameter value MUST be one of:
  - a fixed value of the parameter's type;
  - a field reference: the current item or an earlier node, named by its identifier, plus a field path;
  - a formula in a safe subset of n8n-style expressions (`{{ … }}` with `$json`, `$('Node name')`, `$input`, `$now`, `$run`, operators, and allow-listed functions for text, numbers, lists, objects and dates).

  Field references and formulas MAY read the current item, the first, last, all or same-position items of any upstream node, the trigger input, and run metadata (run identifier, workflow identifier and name, version, start time, current time in the workflow time zone, the run's resume address). Formulas MUST NOT be able to define functions, loop, assign, run arbitrary code, or reach the network, the file system, credentials or platform secrets. One evaluation MUST be bounded to 100 milliseconds and 1 MB of result, and exceeding a bound MUST fail the node with the parameter named. For every node of a draft, the platform MUST report the field paths and value types seen in its pinned sample output or its latest test-run output, so that clients offer fields to pick instead of having them typed.

- **FR-016**: Every node MUST support these settings:
  - disabled: passes items through;
  - always output data: emits one empty item when it would emit none;
  - execute once: uses only the first input item;
  - retry on fail: 1 to 5 attempts and a wait between attempts of 0 to 5 minutes, applied to every failure of the node except limit and isolation breaches;
  - on error: stop the run, continue with the input items, or continue through an error output.

**Runs**

- **FR-017**: The owner or an administrator MUST be able to start a test run of the current draft or a run of any published version, with input items for a Manual Trigger; the run MUST capture the graph it started with and run with the credentials of the workflow's owner.
- **FR-018**: A run MUST follow the states queued → running → waiting → succeeded, with the terminal alternatives failed and cancelled; every node that runs MUST produce a step with status, start and end time, attempt count, item count, output size and, on failure, the error.
- **FR-019**: Nodes MUST execute in dependency order. A node MUST run only after every upstream node connected to it has finished or been skipped. A node none of whose inputs received items MUST be skipped unless it is set to always output data, and a node with several inputs runs when at least one of them received items.
- **FR-020**: Completed nodes MUST NOT be executed again when a run resumes after an interruption of the execution process. A run MUST continue from the first unfinished node, which executes again from its start, so its external requests may be repeated. Sub-workflow calls MUST be identified by run, node and batch, so that a repeated node never starts the same call twice.
- **FR-021**: The output of every step MUST be readable page by page in production order for as long as the run is retained; test runs MUST use pinned sample output of a node instead of executing it.
- **FR-022**: A run MUST respect these limits:
  - a workflow run timeout that counts from the start request and covers the whole run, including queued time and waits: default 1 hour, at most 30 days;
  - at most 10,000 items and 16 MB per step output;
  - at most 256 MB of step outputs per run.

  Exceeding a limit MUST fail the run with a reason that names the limit and the node.

- **FR-023**: The executing runs of one workflow MUST be limited to a platform-wide number (default 5) that applies to every workflow alike; runs beyond it MUST wait in queued state and start in order; waiting runs MUST NOT hold a place.
- **FR-024**: The owner or an administrator MUST be able to cancel a queued, running or waiting run; a node already executing finishes within its own limits, and no further node MUST start after the cancellation is recorded.

**Triggers, waits and sub-workflows**

- **FR-025**: The Manual Trigger MUST start a run with the items supplied by the caller (at most 1,000 items and 1 MB).
- **FR-026**: The Schedule Trigger MUST support intervals (minutes, hours, days, weeks, months at a given time) and cron expressions in a configurable time zone; each occurrence MUST start at most one run, and an occurrence that falls due while the previous run of the same schedule is still active MUST be skipped.
- **FR-027**: The Webhook trigger MUST do all of the following:
  - expose an unguessable address per active trigger node;
  - accept the configured HTTP methods;
  - require the endpoint secret, as a header token or an HMAC signature of the body;
  - refuse bodies above 1 MB;
  - acknowledge the call after the run is recorded;
  - start exactly one run per delivery identifier when the caller supplies one: a repeated delivery with the same content is answered with the existing run, and one with different content is refused as a conflict.
- **FR-028**: The Execute Workflow Trigger MUST start a run when another workflow calls this one, with the caller's items as input.
- **FR-029**: The Error Trigger MUST start a run of the error workflow when a run of a workflow that names it as error workflow fails, with the failed run identifier, workflow, node and error message; test runs and error workflow runs MUST NOT start an error workflow.
- **FR-030**: The Wait node's resume address MUST be unguessable, valid from the start of the run until it ends, and accept one call: the first accepted call resumes the wait (or is kept until the run reaches the Wait node), and later calls are refused; a call carries at most 1 MB. Because the address is per run, a graph MUST contain at most one Wait node in resume mode, and a second one is a validation error.
- **FR-031**: An Execute Workflow node MUST make at most 1,000 sub-workflow calls per execution, a run MUST make at most 4,000 sub-workflow calls in total, and sub-workflow calls MUST nest at most 5 levels deep; exceeding any of these fails the node with the limit named.

**Code node**

- **FR-032**: The Code node MUST run user code written in JavaScript, TypeScript or Python in "run once for all items" or "run once for each item" mode, receiving the input items and returning a list of JSON objects. Every language MUST offer the same n8n-style helpers, named by that language's conventions:
  - the input items: all, first, and the current item in per-item mode;
  - the output items of upstream nodes by node name, within the sandbox input limit;
  - the run metadata and the current time in the workflow time zone;
  - writing diagnostics.

  Each language MUST also offer a fixed set of preinstalled libraries for dates and data handling, at pinned versions; scripts cannot install packages.

- **FR-033**: User code MUST run isolated from the platform processes, other runs, the network, the host file system, credentials and the platform's environment and secrets.
  - Each invocation is limited to at most 10 seconds of CPU time, 30 seconds of wall time, 256 MB of memory, 32 processes and threads, and 16 MB of output.
  - A breach of a limit or of the isolation MUST fail the node as a user error that is never retried.
- **FR-034**: The Code node MUST attach the code's console output to the step as diagnostics, at most 64 KB.

**HTTP Request node and credentials**

- **FR-035**: The HTTP Request node MUST send one request per input item with:
  - a method (GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS) and an http or https URL;
  - query parameters and headers;
  - a body that is empty, JSON, form-urlencoded, or raw text with a content type;
  - optionally one credential owned by the workflow's owner.
- **FR-036**: The HTTP Request node MUST support these options:
  - a timeout: default 30 seconds, at most 5 minutes;
  - following redirects: on by default, at most 5;
  - the response format: automatic (JSON for `application/json` and every `+json` media type, otherwise text), JSON or text;
  - including the response status code and headers in the output;
  - treating every response status as success;
  - batching: N requests per batch with an interval between batches;
  - sending an idempotency key in a header, unique per run, node and item and identical when the node is repeated after a failure or a retry.

  A response larger than 10 MB MUST fail the node.

- **FR-037**: The HTTP Request node MUST offer declarative pagination for each input item.
  - **Modes**:
    - off;
    - update parameters in each request;
    - follow the next link.
  - **Update parameters**: one to five parameters. Each targets the query, a header, or the JSON body by field path, so nested GraphQL variables are reachable. Each takes one of these values:
    - a page number with a start and a step;
    - an offset with a start and a step, the step being a fixed number or the number of records received;
    - a cursor read from a response body field or a response header;
    - a formula.
  - **Follow the next link**: the link comes from a response body field, a response header, the `Link` header's `rel="next"` entry, or a formula. Relative links are resolved against the request that returned them.
  - **Completion**: pagination completes when any of the chosen conditions holds:
    - the page has no records;
    - the cursor or next link is missing or empty;
    - a boolean field is false;
    - the records received reach a total read from a field;
    - the response status is one of the listed codes (that page is not output);
    - a formula is true.
  - **Records and output**: an optional field path names where each page's records are; a missing path means no records on that page. The output is one item per record (the default) or one item per page.
  - **Bounds**:
    - pagination always has a page limit: default 100, at most 1,000. Reaching it stops pagination, or fails the node when so configured;
    - an interval between requests of 0 to 60 seconds;
    - the step output limits of FR-022.
  - **Formulas**: pagination formulas MAY read `$response` (body, headers with lower-case names, status code; null before the first request), `$pageCount` (pages received so far, starting at 0) and `$request` (the previous request as sent, with credential values removed). These variables exist only in pagination formulas.
  - **Advancing**: a page whose cursor, next link or request repeats one already sent MUST fail the node with "pagination did not advance". A page answered with 429, 502, 503, 504 or a connection error MUST be requested again up to 3 times, waiting as `Retry-After` asks (at most 60 seconds), before the node fails. Any other non-success status fails the node, unless it is a completion status or the node treats every response as success.
  - **Credentials and isolation**: the credential is applied to every page request on the original origin, and never to a page request on another origin. Every page request passes the destination check of FR-038.
  - **Retries and failure**: pages are written to the output as they arrive. When the node fails, its partial output is discarded, and a repetition of the node starts again from the first page (FR-020).

- **FR-038**: The HTTP Request node MUST refuse a destination before connecting when the host is, or resolves at connection time to, a loopback, private, link-local, multicast, unspecified or otherwise reserved IPv4 or IPv6 address. The check MUST apply again to every redirect and every pagination request, and an operator-configured allow-list MAY permit specific internal hosts. TLS certificates MUST always be verified, and a refusal MUST fail the node as an isolation breach that is never retried.
- **FR-039**: Editors and administrators MUST be able to create credentials of the types header (name and value), basic (username and password), bearer (token) and query parameter (name and value); the creator owns the credential.
- **FR-040**: Credential secret values MUST be stored encrypted, MUST be write-only (no read returns them), and MUST NOT appear in validation reports, run inputs, step outputs, errors, diagnostics or logs. They are resolved only while the node that uses them executes.
- **FR-041**: Owners MUST be able to list, rename, replace the secret of and delete their credentials, and see which workflows reference each one. Administrators MUST be able to list every credential's name, type, owner and references and delete any credential. A credential referenced by an active version MUST NOT be deletable.
- **FR-042**: A node MUST reference only credentials owned by the workflow's owner and of a type the node accepts.

**History and retention**

- **FR-043**: Every signed-in user MUST be able to list the runs of a workflow newest first, paged, filtered by status, and read any run with its steps.
- **FR-044**: Administrators MUST be able to set the retention policy: retention period in days (default 14) and maximum runs kept per workflow (default 10,000).
- **FR-045**: A retention job MUST run every night and remove finished runs older than the retention period or beyond the per-workflow maximum, together with their step outputs; queued, running and waiting runs MUST NOT be removed.

**Access**

- **FR-046**: Access by role:
  - Viewers MUST be able to read workflows, versions, the node catalogue and runs.
  - Editors MUST additionally be able to create workflows and credentials and to change, publish, activate and run the workflows they own.
  - Administrators MUST additionally be able to act on every workflow and credential, transfer ownership and change the retention policy.
  - Every operation MUST declare its authorization policy, and the ownership check MUST be made on the workflow or credential being accessed.

### Core node catalogue

The catalogue follows the n8n core nodes that work on the platform's own data and run lifecycle, plus the generic HTTP Request node. Nodes that need other credential types, files or binary data, the host operating system, or a specific external protocol are listed under Assumptions as separate features.

| Group     | Node                     | Behaviour and options                                                                                                                                                                                                                                  |
| --------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Trigger   | Manual Trigger           | Starts a test run or a run of a published version with caller-supplied items.                                                                                                                                                                          |
| Trigger   | Schedule Trigger         | Starts runs on intervals (every N minutes, hours, days, weeks or months at a given time; at least one minute) or cron expressions; several rules per node; time zone of the workflow unless set on the node.                                           |
| Trigger   | Webhook                  | Starts a run for each authenticated call; methods GET, POST, PUT, PATCH, DELETE; outputs one item with method, path, headers (secret header removed), query and body.                                                                                  |
| Trigger   | Execute Workflow Trigger | Entry point of a sub-workflow; accepts all caller items or declared input fields.                                                                                                                                                                      |
| Trigger   | Error Trigger            | Entry point of an error workflow; outputs the failed run, workflow, node and error message.                                                                                                                                                            |
| Action    | HTTP Request             | Sends an HTTP request per item with optional stored credentials, follows declarative pagination, and outputs the responses or the records they contain (User Story 3, FR-035 to FR-038).                                                               |
| Flow      | If                       | Conditions on text, number, date, boolean, list and object values joined by AND or OR, optional case-insensitive comparison; outputs "true" and "false".                                                                                               |
| Flow      | Switch                   | Ordered rules routing each item to the first matching output, or to every matching output; optional fallback output; outputs can be named.                                                                                                             |
| Flow      | Merge                    | Waits for all inputs; modes: append (two or more inputs), combine by matching fields (keep matches, keep non-matches, keep everything, enrich input 1, enrich input 2), combine by position, all combinations, choose one input; field-clash handling. |
| Flow      | Filter                   | Keeps items matching conditions joined by AND or OR.                                                                                                                                                                                                   |
| Flow      | Wait                     | Pauses the run for an interval, until a date and time, or until a call to the run's resume address (with an optional maximum wait); the items continue unchanged, plus the resume call's data for the resume mode.                                     |
| Flow      | Execute Workflow         | Runs a published workflow that starts with an Execute Workflow Trigger, once with all items or once per batch of N items; waits for and outputs the sub-workflow's last-node items, or continues at once with its input items.                         |
| Flow      | Stop and Error           | Ends the run `failed` with a configured message.                                                                                                                                                                                                       |
| Flow      | No Operation             | Passes items through unchanged.                                                                                                                                                                                                                        |
| Transform | Code                     | Runs JavaScript, TypeScript or Python once for all items or once per item, with the same helpers and preinstalled libraries in each language (User Story 2).                                                                                           |
| Transform | Edit Fields              | Sets, renames or removes fields by mapping or from a JSON template; keeps all, none, selected, or all-but-selected other fields; dot notation for nested fields.                                                                                       |
| Transform | Rename Keys              | Renames keys by pairs or by a regular expression.                                                                                                                                                                                                      |
| Transform | Aggregate                | Combines items into one: selected fields into lists, or all item data into one list.                                                                                                                                                                   |
| Transform | Split Out                | Turns a list field into separate items, optionally keeping other fields.                                                                                                                                                                               |
| Transform | Summarize                | Groups by fields and computes count, count unique, sum, average, minimum, maximum, append and concatenate.                                                                                                                                             |
| Transform | Sort                     | Orders items by fields ascending or descending, or randomly.                                                                                                                                                                                           |
| Transform | Limit                    | Keeps the first or last N items.                                                                                                                                                                                                                       |
| Transform | Remove Duplicates        | Removes items that repeat all fields or selected fields within the node input.                                                                                                                                                                         |
| Transform | Compare Datasets         | Compares two inputs by key fields and outputs four branches: only in A, same, different, only in B.                                                                                                                                                    |
| Transform | Date & Time              | Adds or subtracts durations, extracts parts, formats, rounds, gets the current time and the time between two dates, in a time zone.                                                                                                                    |
| Transform | Crypto                   | Hashes values (MD5, SHA-1, SHA-256, SHA-384, SHA-512, SHA3) in hex or base64, and generates random values and UUIDs.                                                                                                                                   |
| Transform | HTML                     | Renders an HTML template from item fields, extracts values by CSS selector, and converts items to an HTML table.                                                                                                                                       |
| Transform | XML                      | Converts between JSON and XML in either direction.                                                                                                                                                                                                     |
| Transform | Markdown                 | Converts between Markdown and HTML in either direction.                                                                                                                                                                                                |

### Delivery Requirements

- **DR-001**: The single command that starts the local environment MUST also start the object storage for step outputs, the code sandbox and an HTTP test service for HTTP Request journeys. The new services MUST use the same project-specific names, loopback-only ports and named volumes as the existing ones.
- **DR-002**: The API image MUST run in two roles, serving HTTP and executing runs, selected by configuration; the execution role MUST be able to run as several replicas.
- **DR-003**: Every new container image MUST be pinned by digest and pass the vulnerability scan with zero critical or high findings; every new dependency MUST be pinned exactly.
- **DR-004**: Automated tests MUST cover every functional requirement, every edge case and every documented mode of every core node, at the test layers the constitution prescribes. The end-to-end suite MUST include building, test-running, an HTTP Request with a credential and with pagination, publishing, a scheduled run, a webhook run and a resumed run after the execution process restarts.
- **DR-005**: The web application MUST NOT be modified by this feature.

### Key Entities

- **Workflow**: a named automation; owner, status (active, archived), draft, published versions, settings, activation.
- **Draft**: the editable graph of a workflow with its revision for conflict detection and its validation report.
- **Workflow version**: an immutable, numbered snapshot of the graph created by publishing.
- **Node**: an instance of a node type in a graph; type and type version, display name, parameters, credential reference, settings, position, pinned sample output.
- **Parameter value**: what a node parameter is set to; a fixed value, a field reference (node identifier or current item, plus field path) or a formula.
- **Connection**: a link from an output port of one node to an input port of another.
- **Node type**: a catalogue entry shipped with the platform; identifier, version, kind, category, parameter definitions, accepted credential types, ports.
- **Credential**: a named secret of a generic HTTP authentication type owned by one user; encrypted secret values, creation and update times, the workflows that reference it.
- **Activation**: the registration of an active version's triggers; schedules and webhook endpoints with their secrets.
- **Run**: one execution of a version or draft snapshot; trigger, status, timestamps, input, current node, resume address.
- **Step**: one execution of a node within a run; status, attempts, item count, output size, error, diagnostics, output items.
- **Retention policy**: retention period and maximum runs per workflow.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: A test run of a 10-node workflow processing 100 items finishes and its step outputs are readable within 10 seconds of the start request on a developer workstation running the local environment.
- **SC-002**: In repeated tests that stop the execution process in the middle of a run, 100% of runs complete after a restart and no completed node runs a second time.
- **SC-003**: 99% of scheduled occurrences start their run within 60 seconds of the scheduled time, and no occurrence starts two runs.
- **SC-004**: 95% of authenticated webhook calls are acknowledged within 1 second, and each delivery identifier yields exactly one run.
- **SC-005**: 100% of Code node attempts to reach the network, read host files or exceed a limit fail the node with a named cause, while other runs continue unaffected.
- **SC-006**: 100% of HTTP Request attempts to reach loopback, private, link-local or metadata addresses are refused before a connection is made, including through redirects and host names that resolve to such addresses.
- **SC-007**: A credential secret value appears in 0 API responses, run inputs, step outputs, errors, diagnostics or log records produced by the platform, verified by searching for known test secrets after the full test suites.
- **SC-008**: 100 runs started at the same moment all reach a terminal status, none is lost or duplicated, and each workflow's concurrency limit is never exceeded.
- **SC-009**: Every core node in the catalogue has automated tests of each documented mode and option, and every functional requirement and edge case is covered by at least one automated test; all suites pass.
- **SC-010**: Listing runs and paging a step output return within 2 seconds for a workflow with 10,000 retained runs.

## Assumptions

- This feature delivers the API and the execution processes; the visual editor is a separate web feature that consumes this API (constitution principle I; the 001 feature was scoped the same way).
- The platform is self-hosted and single-tenant; the roles are those of the authentication feature (admin, editor, viewer).
- The following are separate features, together with integration nodes for external services, polling triggers and AI nodes:
  - service-specific credential types: OAuth2 and credential verification against a service;
  - n8n core nodes that need other credential types: JWT, TOTP, and the HMAC, signing and encryption actions of Crypto;
  - n8n core nodes that work on files and binary data: Convert to File, Extract from File, Compression, Edit Image;
  - n8n core nodes that reach the host operating system (excluded for security): Execute Command, Read/Write Files from Disk, Local File Trigger;
  - n8n core nodes that speak external protocols: Send Email, SSH, FTP, Git, GraphQL, RSS, LDAP, Email Trigger;
  - n8n core nodes with their own storage or product surface: Data Table, Execution Data, n8n, Track Time Saved;
  - forms and chat, which belong to the web application: Form Trigger, Form, Chat.
- Credentials of the generic HTTP types have no service to be verified against; they count as verified once saved, which satisfies the domain rule that published versions reference only verified credentials.
- The HTTP Request node does not offer proxies, client certificates or disabling TLS verification in this feature.
- Workflows exchange data as lists of JSON items; binary data is not part of this feature. Items carry no lineage to the items they came from; field references and formulas reach earlier items by position.
- Webhook calls are acknowledged as soon as the run is recorded (docs/architecture/04-execution.md); responding to the caller with data produced by the run (Respond to Webhook) is a later feature.
- Loops are expressed through item-wise processing and batched sub-workflow calls. Graphs stay acyclic, as the domain model requires, so n8n's Loop Over Items, which needs a cycle, is not offered. Neither are the SQL mode of Merge and the code mode of Sort.
- The web editor builds field references and conditions with pickers and offers formulas only as an advanced mode, so most users never type a formula; arbitrary code runs only in the Code node.
- The Code node supports JavaScript, TypeScript and Python. Further popular languages (for example Go, Java, C#, PHP, Ruby) are added later through the same contract. Python extends the Code node runtime described in docs/architecture/05-node-types.md, which names only Node.js; the plan updates that document.
- Test runs of workflows that start with a Webhook or Schedule Trigger use input items supplied by the owner or pinned sample output; there is no temporary test webhook address.
- A test run always executes the whole draft from its trigger; executing a single node or running up to a chosen node is not offered. To try a node on known data, the owner pins the output of the nodes before it.
- New node types and new node type versions ship with platform releases; there is no user-defined node type.
- External effects are delivered at least once per node execution. Making the receiving operations idempotent is the responsibility of whoever builds the integration; the platform supplies stable idempotency keys and does not deduplicate on the caller's behalf.
- Run execution builds on the durable execution module of the NestJS ecosystem named by the architecture documents (`@nestjs/workflows`, docs.nestjs.com/reliability/workflows).
  - It is an early release (0.0.x), so the plan must verify each mechanism against the installed version.
  - Its documented behaviour sets several rules here: the platform-wide per-workflow concurrency limit, waits counted in the run timeout, cancellation letting the current node finish, and missed schedule occurrences being skipped.
- This feature introduces the execution process role, object storage for step outputs, the code sandbox and the credential encryption key, as the architecture documents describe.
- Limits stated as numbers are platform defaults that operators may lower or raise through configuration.
