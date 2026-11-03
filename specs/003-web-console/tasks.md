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

- [ ] T070 [US7] `automation/modules/webhooks` (URL once, copy, example call) and `secrets` (create, replace, delete)
- [ ] T071 [US7] `automation/modules/event-sender`
- [ ] T072 [US7] `automation/modules/subscription-list`, `subscription-form` (filter rows, authentication by secret, located problems), `subscription-detail` (live deliveries)

## US8 — Account and team (P3)

- [ ] T080 [US8] `identity/modules/account` (password change, rotated cookie), `password-recovery`, `password-reset`
- [ ] T081 [US8] `identity/modules/invitations` (admin) and `invitation-acceptance`

## Polish

- [ ] T090 Lint, types, unit and component suites green; the quickstart journeys on the running stack; README of `apps/web`
