# Implementation Plan: API Authentication

**Branch**: `feat/001-api-authentication` | **Date**: 2026-10-10 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/001-api-authentication/spec.md`

## Summary

Email/password sign-in, password recovery, change password and invitation-by-link onboarding for the
API, built on the first-party NestJS authentication and authorization packages (cookie sessions, a
session guard built on `auth.api.getSession`, admin-plugin access control for roles). Invitations are
the only non-native part: an `Invitation` aggregate in the Identity & Access context; acceptance
creates the account with `auth.api.createUser` and issues the session with `auth.api.signInEmail`.
Commands run in one request-scoped transaction propagated with `nestjs-cls`; outbound email is
written to a transactional outbox (`@nestjs/outbox`) and delivered by its relay. The feature also
establishes the API platform baseline: configuration, logging, health, OpenTelemetry, Drizzle schema
and migrations, a production container image, a local Compose stack, exact dependency
pinning and vulnerability gates.

## Technical Context

**Language/Version**: TypeScript 6.0.x on Node.js 24.21.0 (pinned; `engines >=24.15.0`), ESM

**Primary Dependencies**: NestJS 12.1.2 (`@nestjs/common`, `core`, `platform-express`),
`@nestjs/authentication` 0.1.0, `@nestjs/authorization` 0.1.0, `@nestjs/throttler` 6.7.1, `@nestjs/mail` 0.0.1, `drizzle-orm` 0.45.4, `drizzle-kit` 0.31.11, `pg`
8.23.1, `@nestjs/config` 12.0.1 + `zod` 4.6.5 (environment schema),
`class-validator` 0.15.1 + `class-transformer` 0.5.1 (`ValidationPipe`), `@nestjs/terminus` 12.1.0,
`@nestjs/swagger` 12.0.2, `nestjs-pino` 5.3.1 + `pino` 10.4.0, `@nestjs/outbox` 0.1.1,
`@opentelemetry/sdk-node` 0.223.0 + `@opentelemetry/auto-instrumentations-node` 0.81.0, `nestjs-cls` 7.0.1 +
`@nestjs-cls/transactional` 4.0.1 + `@nestjs-cls/transactional-adapter-drizzle-orm` 2.0.1 (transaction
propagation), `@nestjs/outbox` 0.1.1 (transactional outbox for email). All pinned exactly (see research R12).

**Storage**: PostgreSQL 18.6 (tables `user`, `session`, `email_token`, `invitation` in the Drizzle schema;
one application table `invitation`; outbox tables in schema `nest_outbox`); migrations with drizzle-kit and
`nest-outbox migrate` as release steps

**Testing**: Vitest 5.0.3; domain unit tests (`src/**/*.spec.ts`); integration and component tests
under `apps/api/test/` against a real PostgreSQL started by `@testcontainers/postgresql` 12.2.0;
`supertest` 7.3.1 through the Nest HTTP server; `InMemoryMailTransport` of `@nestjs/mail` in place of `MailTransport` with
the outbox relay driven by `relay.runOnce()`; end-to-end journeys against the Compose stack (`test/e2e`)

**Target Platform**: Linux containers; runtime image `gcr.io/distroless/nodejs24-debian13:nonroot`
(digest-pinned); local stack via Docker Compose (PostgreSQL, Mailpit)

**Project Type**: web-service (API only; `apps/web` untouched)

**Performance Goals**: standard web expectations; sign-in and session lookup are single DB round trips

**Constraints**: only the mechanisms of the NestJS packages (no custom limiter, hashing or session code);
API is reached only through a trusted proxy (Web BFF or ingress) that sets `x-forwarded-for`; zero
known critical/high vulnerabilities in image and dependencies; exact dependency versions; no
real-time channels

**Scale/Scope**: single tenant, tens of users; 11 application endpoints under `/api/v1`

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Gate                        | Status | Evidence                                                                                                                                                                                                                                                                                                           |
| --------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| I. Web/API separation       | PASS   | Only `apps/api` changes; the contract is OpenAPI (`contracts/openapi.yaml`) ; links in emails use a configured public base URL                                                                                                                                                                                     |
| II. Documentation-first     | PASS   | NestJS docs (Authentication, Authorization, Guards, Middleware, Raw body), NestJS Authentication, Authorization, Rate limiting and CSRF pages                                                                                                                                                                      |
| III. Clean Architecture     | PASS   | `domain` and `application` import no framework except the `@Policy()` marker (lint-enforced); use cases are plain classes assembled by factory providers in `frameworks/di`; each layer declares the abstractions the outer layer implements in its `interfaces.ts` (abstract classes, also the injection tokens)  |
| IV. DDD, simply implemented | PASS   | One aggregate (`Invitation`, private fields, behaviour methods, errors thrown on rule violations) with the value object `InvitationToken` (link token: value and fingerprint); `User` states facts (`isAdmin`, `suspended`) and `InvitationPolicy` decides; email, role and password are validated at the boundary |
| V. CQS                      | PASS   | Commands: invite, revoke, accept (one transaction each, opened at the controller); queries: list pending, verify link; failures are domain errors thrown and translated by the HTTP filter                                                                                                                         |
| VI. Verified by tests       | PASS   | Research R10: sociable unit tests for the domain, solitary unit tests with in-memory fakes for use cases and policies, persistence and mailing integration tests on Testcontainers, component tests through HTTP, four end-to-end journeys                                                                         |
| VII. Security by design     | PASS   | Native scrypt, cookie sessions with HttpOnly/Lax (Secure under https), origin checks, enumeration-safe responses, hashed invitation tokens, `@nestjs/authorization` policies (deny by default) after the session guard, rate limiting, image hardening and scanning gates                                          |
| VIII. OpenTelemetry         | PASS   | Node SDK started in `src/instrumentation.ts`, preloaded with `--import` before Nest bootstrap and configured only through `OTEL_*`; http, express and pg auto-instrumentations cover every route; pino log correlation from the same auto-instrumentations; no telemetry calls in the layers                       |
| IX. Simplicity              | PASS   | No event emitter, no CQRS buses, no audit table; `nestjs-cls` and `@nestjs/outbox` are required by the constitution's transaction and outbox rules (Complexity Tracking); domain events deferred to features that need them                                                                                        |

Post-design re-check (after Phase 1 and the analysis pass): all PASS; additions and deviations are listed in Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/001-api-authentication/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # openapi.yaml
└── tasks.md             # Phase 2 output (/speckit-tasks)
```

### Source Code (repository root)

```text
apps/api/
├── Dockerfile                        # multi-stage: pnpm fetch → build → deploy → distroless runtime
├── drizzle.config.ts, drizzle/       # drizzle-kit migrations (committed), incl. the bootstrap-administrator seed
├── src/
│   ├── main.ts, instrumentation.ts  # bootstrap; OpenTelemetry Node SDK preload
│   ├── domain/                       # invitation.ts, user.ts (entities), invitation-token.ts (value object), errors.ts, interfaces.ts
│   ├── application/                  # use-cases/ (authenticate-user, change-password, reset-password, invite-user,
│   │                                 # list-pending-invitations, revoke-invitation, verify-invitation-link, accept-invitation),
│   │                                 # policies/invitation.policy; interfaces.ts (commands, outputs, ports: UserRepository,
│   │                                 # InvitationRepository, InvitationQueries, PasswordHasher, Mailing)
│   ├── interface-adapters/
│   │   ├── interfaces.ts             # what frameworks provide: Database, DrizzleTx; row and mail types
│   │   ├── http/                     # controllers/ (auth, invitations, health), dto/, presenters/ (user, invitation),
│   │   │                             # filters/domain-error.filter, middleware/security-headers
│   │   ├── auth/                     # session-authentication.provider, password-recovery.handler, stores/ (session, email-token)
│   │   ├── mailing/                  # mail.gateway (port Mailing), outbox-mail.transport (Mailer transport → outbox),
│   │   │                             # mail-outbox.handler (outbox → SmtpTransport), templates/ (invitation.mail, password-reset.mail)
│   │   └── persistence/              # schema/ (user, session, email_token, invitation), repositories/, mappers/, queries/
│   └── frameworks/
│       ├── di/                       # app, config, logging, database, outbox, mail, identity-access modules
│       └── drizzle/, pino/           # one factory function per technology
└── test/
    ├── support/                      # testcontainers setup, app factory, in-memory mail transport, fakes, builders, probe routes
    ├── unit/{domain,application,mailing}/   # sociable domain tests, solitary use-case tests on fakes, template rendering
    ├── integration/{persistence,mailing}/   # repositories, queries, seed migration, outbox transport on real PostgreSQL
    ├── component/                    # HTTP flows through the Nest app (supertest)
    └── e2e/                          # persona journeys against the Compose stack (built image, Mailpit API)

compose.yaml, .env.example, .dockerignore, .github/workflows/ci.yml, pnpm-workspace.yaml (pinning settings)
```

**Structure Decision**: flat Clean Architecture layers inside `apps/api/src` as prescribed by the
constitution and `docs/architecture/03-api.md`; `IdentityAccessModule` assembles the bounded context, `AppModule` the application; the
`AutomationModule` is not touched by this feature. Tests live in `test/{unit,integration,component,e2e}`
with shared helpers in `test/support`.

## Complexity Tracking

| Addition or deviation                                                                                     | Why it is needed                                                                                                                                          | Simpler alternative rejected because                                                                                      |
| --------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `nestjs-cls` + `@nestjs-cls/transactional` + Drizzle adapter                                              | Constitution: one command equals one request-scoped transaction opened by the documented propagation mechanism; the NestJS Drizzle page names this plugin | Passing `tx` by hand leaks the database handle into use cases; `create-invitation` writes two rows and one outbox message |
| `@nestjs/outbox` with `PostgresOutboxStore`                                                               | Constitution: effects that leave the process go through a transactional outbox                                                                            | Direct SMTP from the use case sends mail for rolled-back commands and has no retry                                        |
| Bootstrap administrator as the data migration `drizzle/0001_bootstrap_administrator.sql`                  | Operational seed executed once at install time; the first password is set through recovery                                                                | A use case for a one-off seed adds a port and a provider for a single run                                                 |
| Outbox inbox and dead-letter pruning deferred                                                             | Tens of users and a few messages per day; pruning belongs to the platform retention job of the Automation context                                         | A timer in this feature duplicates the retention mechanism                                                                |
| Domain errors are thrown, use cases return entities or nothing                                            | Constitution 3.0.0 (Application layer): adapters throw, the HTTP filter translates                                                                        | A `Result` type doubled every call site                                                                                   |
| Ports live in `application/interfaces.ts` as abstract classes; the current time is read with `new Date()` | Constitution 3.0.0 (Clean Architecture, DDD): one interfaces file per layer, no clock port                                                                | Extra ports with one implementation                                                                                       |
| Authorization through `@nestjs/authorization` policies at the route                                       | Constitution 3.0.0 (Application layer): policies in `application/policies`, declared on routes with `@Can`                                                | Role checks duplicated in use cases                                                                                       |

Build time and image size measured by the tasks are recorded here after the build:

| Measurement                        | Value (2026-10-11, Docker 24.0.7, macOS, BuildKit cache mount for the pnpm store)                                                 |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Cold build                         | 74 s wall (`docker build -f apps/api/Dockerfile .`, base images pulled beforehand)                                                |
| Rebuild after a source-only change | 39 s wall; `deps` stage (`pnpm fetch`) `CACHED`, offline install, build and deploy re-run                                         |
| Image size                         | 611 MB (`/prod/api` layer 457 MB: production `node_modules` incl. OpenTelemetry auto-instrumentations; Node runtime layer 127 MB) |
| Vulnerability scan                 | Trivy 0 critical/high on the image (Debian 13.7, node packages) and on `pnpm-lock.yaml`; `pnpm audit --prod` clean                |
