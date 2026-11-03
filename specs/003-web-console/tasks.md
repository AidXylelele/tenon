# Tasks: Web Console

**Input**: [plan.md](plan.md), [spec.md](spec.md), [data-model.md](data-model.md), [research.md](research.md)

**Status**: `[x]` is done and tested; `[ ]` is open. Paths are under `apps/web/src/`. Stories run in the order US1 → US2 → US3 → US5 → US6 → US4 → US7 → US8; each task writes its tests with its code.

## Foundation

- [x] T001 Packages of research R4, shadcn init (`radix`, `nova`) with the aliases in `libs/ui`, the components the console uses
- [x] T002 `libs/data-access`: request with the forwarded session, `Problem`, `Outcome`, 401 → sign-in, 404 → null, client types (data-model)
- [x] T003 `libs/live`, `libs/document-text`, and the `libs/ui` composites (page header, submit button, JSON block, copy, time, problem message)
- [x] T004 `proxy.ts` (CSP nonce, request URL, optimistic session check), security headers and the action body limit in `next.config.ts`, theme by system preference, root layout, `not-found`, `global-error`

## US1 — Sign in and find one's way (P1)

- [x] T010 [US1] `identity/modules/sign-in` with its action (session cookie, R3) and the `(anonymous)` frame
- [x] T011 [US1] `shell/modules/console-frame`: sidebar by role, user menu, sign-out, mobile sheet; `(console)` layout and redirect

## US2 — Build and publish without code (P1)

- [x] T020 [US2] `automation/__shared_context/document`: tasks by pointer (insert, move, remove, rename, update), kinds, triggers, located problems, next version
- [x] T021 [US2] `automation/modules/workflow-editor`: header, trigger, task list with nesting, inspector forms per kind, live check, publish
- [x] T022 [US2] Routes `workflows/new` and `workflows/[namespace]/[name]/edit` with loading skeletons

## US3 — Start an instance and watch it run (P1)

- [x] T030 [US3] Start dialog: version, input as form or JSON, idempotency key kept across retries
- [x] T031 [US3] `automation/modules/instance-detail`: phase, outline with statuses, task timeline, events, input/output/error, controls by phase, live refresh

## US5 — Manage workflows (P2)

- [x] T040 [US5] `automation/modules/workflow-list` (status filter, paging) and `workflow-detail` (trigger in words, on/off, versions, recent instances, archive)
- [x] T041 [US5] `automation/modules/conformance` and `version-document`

## US6 — Find instances (P2)

- [x] T050 [US6] `automation/modules/instance-list`: filters in the address, paging, live while unended

## US4 — Edit the document as code (P2)

- [x] T060 [US4] Code view in the editor: YAML/JSON, two-way with the draft, parse errors and problems at their line, paste and load a file

## US7 — Connect other applications (P2)

- [x] T070 [US7] `automation/modules/webhooks` (URL once, copy, example call) and `secrets` (create, replace, delete)
- [x] T071 [US7] `automation/modules/event-sender`
- [x] T072 [US7] `automation/modules/subscription-list`, `subscription-form` (filter rows, authentication by secret, located problems), `subscription-detail` (live deliveries)

## US8 — Account and team (P3)

- [x] T080 [US8] `identity/modules/account` (password change, rotated cookie), `password-recovery`, `password-reset`
- [x] T081 [US8] `identity/modules/invitations` (admin) and `invitation-acceptance`

## Polish

- [x] T090 Lint, types, unit and component suites green; the quickstart journeys on the running stack; README of `apps/web`

## Iteration 2 — canvas and organisation (Session 2026-11-03)

- [x] T100 Packages of R11 and R12 (`@xyflow/react`, shadcn `command` with `cmdk`); accent and family colours; `PageBody`
- [x] T101 `automation/__shared_context/canvas/graph.ts`: the structured layout and the edges of FR-022, with unit tests
- [x] T102 The canvas components (nodes, containers, edges, insert and connect) in `automation/__shared_context/canvas`
- [x] T103 [US2] The builder on the canvas: a side panel per node, a searchable node creator, `then` written by dragging (FR-023)
- [x] T104 [US3] A run's page on the canvas: statuses, taken edges, a step's executions in the panel (FR-024)
- [x] T105 [US5] A workflow's page with Overview, Runs and Versions tabs
- [x] T106 The Overview page, the regrouped navigation, the top bar and the ⌘K search (FR-025)
- [x] T107 Checks on the running stack, the critic round, and the artifacts synchronised

## Iteration 3 — requests, clarity, failures, navigation (Session 2026-11-03)

- [x] T110 Refresh as Grafana does: one refresh control per live page, Auto/Off/intervals, 5 s minimum, hidden pages wait (FR-026, R14)
- [x] T111 Lazy reads: a run's events on its Events view, versions on their tab, version documents cached per session, hover-only prefetch in lists (FR-027)
- [x] T112 Navigation: five destinations, Connections and Settings with tabs under new routes and redirects, breadcrumbs, icon sidebar, bottom bar on phones (FR-034, R15)
- [x] T113 The canvas laid out by ELK: direction, orthogonal edges with placed labels, collapsible containers, `try` with its failure block, badges for a step protected alone, notes (FR-028–FR-030, R16)
- [x] T114 [US2] The step panel: fixed and resizable, Settings / If it fails / Data / Note, move up and down, duplicate, delete; a bottom sheet on phones (FR-031)
- [x] T115 [US2] The code editor: JavaScript and Python highlighting, syntax errors, fixed height, large editor, Prettier for JavaScript (FR-032, R17)
- [x] T116 [US3] Failures on a run: attempts and the next try, the fault strip with its next actions, Run again (FR-033, R18)
- [x] T117 Checks on the production build (requests per minute, SC-007), phones and dark, the critic round, the artifacts synchronised

## Iteration 4 — the module system of the owner's RFC (R19)

- [x] T120 Libs: JSON reads and writes in `document-text`, `Status` and confirm-then-act in `ui`, a `forms` lib; `data-access` names no route and keeps no view-shaped query; tests for every lib
- [x] T121 Operations `workflow-document`, `run-progress`, `access-policy`, `app-routes`: no JSX, 75 % coverage each (playgrounds with T125)
- [x] T122 Features `workflow-canvas` and `run-table`, composed through props and slots, coverage each (playgrounds and smoke tests with T125); the workflow search stays in the console frame
- [ ] T123 Spaces by experience: `home`, `workflows`, `runs`, `connections`, `credentials`, `settings` beside `shell` and `identity`; each `__shared_context` keeps only what two of its modules share
- [ ] T124 Entries as rendering instructions: pages pass their params through, layouts reference layout modules, redirects in `next.config`, `not-found`, `loading` and `error` through shell modules
- [ ] T125 Governance: `CODEOWNERS`, the development-only playground routes for each feature and operation, Cypress with each space's e2e and each feature's smoke test, coverage thresholds per tier, the dependency check in CI
- [ ] T126 The critic round (RFC, Clean Architecture) and the artifacts synchronised (plan structure, quickstart)
