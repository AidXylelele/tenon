# Implementation Plan: Web Console

**Branch**: `003-web-console` | **Date**: 2026-11-03 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/003-web-console/spec.md`

## Summary

`apps/web` becomes the console for features 001 and 002: a Next.js 16 Backend for Frontend. It adds no rule of its own.

- **Reads.** Server Components read through `libs/data-access`, which forwards the session to the API.
- **Writes.** Server Actions call `libs/data-access`, then refresh the route (`refresh()`).
- **Live views.** A client component re-renders the route on an interval while something is in flight (`router.refresh()`), and pauses while the tab is hidden.
- **The no-code builder.** It edits one draft document, the same one the YAML view edits. The API's check (`POST /workflows/check`) locates each problem, and the builder shows it on the task and field it concerns.

Decisions and their sources: [research.md](research.md). View models: [data-model.md](data-model.md).

## Technical Context

|                          |                                                                                                                                                                                                 |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Language/Version**     | TypeScript 6.0.3, React 19.3, Next.js 16.4.3 (App Router, Turbopack), Node 26.13.0                                                                                                              |
| **Primary Dependencies** | shadcn/ui (Radix, style nova) with `radix-ui`, `cn`, `class-variance-authority`, `lucide-react`, `tw-animate-css`; `sonner`; `yaml`; CodeMirror 6 through `@uiw/react-codemirror` (research R4) |
| **Storage**              | None; the session token lives in an HttpOnly cookie on the web origin                                                                                                                           |
| **Testing**              | Vitest 5 + Testing Library (jsdom), with the API stubbed at the HTTP boundary; the running stack for journeys                                                                                   |
| **Target Platform**      | Browsers of the last two years; the existing Docker image (`output: 'standalone'`)                                                                                                              |
| **Project Type**         | Web application: `apps/web` only, against the API's contracts ([001](../001-api-authentication/contracts/openapi.yaml), [002](../002-workflow-engine/contracts/openapi.yaml))                   |
| **Performance Goals**    | SC-002, SC-003                                                                                                                                                                                  |
| **Constraints**          | The API is the only authority; the API offers no push, so live views poll; Server Action bodies are capped at 2 MB, for 1 MiB documents                                                         |
| **Scale/Scope**          | 23 routes, 8 user stories                                                                                                                                                                       |

## Constitution Check (3.0.1)

| Gate                                         | Result                                                                                                                                                                                                                               |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| I. Web/API separation                        | Pass. Nothing is imported from `apps/api`. The client types are written in `libs/data-access` from the contracts. The browser talks only to the Next.js server                                                                       |
| II. Documentation first, first-party modules | Pass. Each mechanism cites the installed Next.js docs (research). `router.refresh()` serves polling, so no client data library is added. shadcn is used through its CLI                                                              |
| III. Clean Architecture (web tiers)          | Pass. The dependency order is entries → spaces/modules → libs, and no features or operations are needed yet (R2). Modules of one space share only through `__shared_context`                                                         |
| IV. DDD                                      | Not applicable: no domain in the web application. The builder edits a document; the API decides                                                                                                                                      |
| V. CQS                                       | Pass. Reads are Server Components; writes are Server Actions                                                                                                                                                                         |
| VI. Tests                                    | Pass. The table below lists the test types. Async Server Components are verified on the running stack, because Vitest cannot render them (docs, testing/vitest)                                                                      |
| VII. Security                                | Pass: R6. The token is in an HttpOnly cookie. The CSP carries a nonce, and HSTS and the hardening headers are sent. React escapes all output. Server Actions keep Next's origin check. Secret values and webhook URLs are never kept |
| VIII. OpenTelemetry                          | Deferred: the web instrumentation hook needs an exporter dependency, and the API's traces do not depend on it. Recorded in Complexity Tracking                                                                                       |
| IX. Simplicity                               | Pass. Every dependency is justified (R4). The design system's components are generated, not written                                                                                                                                  |

**Test plan:**

| What                                                           | Test type                         | Location                                              |
| -------------------------------------------------------------- | --------------------------------- | ----------------------------------------------------- |
| `libs/data-access` (session forwarding, problems, Result)      | Unit, `fetch` stubbed             | `src/libs/data-access/*.test.ts`                      |
| `libs/document-text` (parse, stringify, pointer → line)        | Unit                              | `src/libs/document-text/*.test.ts`                    |
| Draft-document operations (tasks, triggers, problems → fields) | Unit                              | `src/spaces/automation/__shared_context/**/*.test.ts` |
| Client modules (sign-in form, builder, live refresh, start)    | Component, Testing Library        | next to each module                                   |
| The journeys of each story                                     | Manual on the Compose stack + API | quickstart.md                                         |

## Project Structure

### Documentation (this feature)

```text
specs/003-web-console/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── tasks.md
└── checklists/requirements.md
```

### Source Code

```text
apps/web/src/
├── proxy.ts                         CSP nonce, the request URL for the app, the optimistic session check
├── app/                             entries: rendering instructions only
│   ├── layout.tsx                   html, fonts, Toaster, TooltipProvider
│   ├── not-found.tsx, global-error.tsx
│   ├── (anonymous)/layout.tsx       → spaces/shell/modules/auth-frame
│   │   ├── sign-in/                 → spaces/identity/modules/sign-in
│   │   ├── forgot-password/         → spaces/identity/modules/password-recovery
│   │   ├── reset-password/          → spaces/identity/modules/password-reset   (API link: /reset-password?token=)
│   │   └── invitations/accept/      → spaces/identity/modules/invitation-acceptance (API link)
│   └── (console)/layout.tsx         → spaces/shell/modules/console-frame
│       ├── page.tsx                 → redirect to /workflows
│       ├── workflows/ … new/, [namespace]/[name]/, …/edit/, …/versions/[version]/
│       ├── instances/, instances/[id]/
│       ├── webhooks/, secrets/, events/, subscriptions/, subscriptions/new/, subscriptions/[id]/
│       ├── conformance/
│       └── account/, team/
├── spaces/
│   ├── shell/modules/{console-frame, auth-frame}
│   ├── identity/modules/{sign-in, password-recovery, password-reset, invitation-acceptance, account, invitations}
│   └── automation/
│       ├── modules/{workflow-list, workflow-detail, workflow-editor, version-document, instance-list,
│       │            instance-detail, conformance, webhooks, secrets, event-sender, subscription-list,
│       │            subscription-form, subscription-detail}
│       └── __shared_context/{document, outline, vocabulary}
└── libs/
    ├── ui/                          design system: shadcn components + composites (page header, submit button, JSON block, copy, time)
    ├── data-access/                 the only API client (server-only): session cookie, problems, typed resources
    ├── live/                        route refresh while in flight, with its status
    └── document-text/               YAML and JSON text: parse with positions, stringify, JSON Pointer → range
```

**Structure decision**: Two bounded contexts of the API give two spaces, `identity` (001) and `automation` (002). The frames that every page shares are the `shell` space. Code that one space needs stays in its `__shared_context`; no feature or operation is created until a second space needs it (R2).

## Complexity Tracking

| Deviation                                 | Why                                                                                           | Simpler alternative rejected because                                            |
| ----------------------------------------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| No web OpenTelemetry hook in this feature | It needs an exporter package, and the console works without it; the API's traces are complete | Adding it now grows the dependency set for no story of this feature             |
| No Cypress suite                          | The constitution requires Cypress for features only, and this feature creates none (R2)       | A Cypress install for module journeys duplicates the manual quickstart journeys |
