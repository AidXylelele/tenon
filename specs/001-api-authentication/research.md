# Research: API Authentication

Sources: NestJS 12.1 documentation (Authentication, Authorization, Guards, Rate limiting, CSRF,
Mail, Outbox, Terminus, Drizzle and Middleware pages), pnpm documentation (docker, deploy, fetch,
install, settings, audit, supply-chain security), Docker documentation (build best practices,
cache, Dockerfile reference, secrets, Compose specification), Node.js 24 documentation, Google
Distroless, Mailpit, PostgreSQL image documentation, Trivy documentation and the microservice
testing strategy article (martinfowler.com). Research date: 2026-10-10, revised 2026-10-11.

## R1. Authentication stack

- Decision: the first-party NestJS packages `@nestjs/authentication` 0.1.0 and `@nestjs/authorization`
  0.1.0 (NestJS 12.1 Authentication and Authorization pages). `AuthenticationModule.forRootAsync` with
  `session: { absoluteTtl: '30d', idleTtl: '7d', cookie: { secure, sameSite: 'lax' }, trustedOrigins,
metadata }` and `passwordReset: { url: WEB_BASE_URL/reset-password, ttl: '1h' }`. The application
  supplies a `SessionCookieProvider` (`SessionAuthenticationProvider`: `validate` → `UserRepository.findActiveById`), a `PasswordResetHandler` (`PasswordRecoveryHandler`: `UserRepository.findActiveByEmail`, outbox mail,
  `ResetPassword` use case) and two Drizzle
  stores registered with `AuthenticationStorage.registerSource` (`DrizzleSessionStore`,
  `DrizzleEmailTokenStore`). Passwords are hashed by the package's scrypt `PasswordHasher`, bound to
  the application port `PasswordHasher`. Sign-in, sign-out, recovery and password change are
  application routes under `/api/v1/auth` (`AuthController`); `SignInService` issues and rotates the
  session cookie, `SessionService.revokeAll` ends other sessions.
- Rationale: the package covers sessions with rotation and CSRF defence, hashed single-use reset
  tokens bound to the password they replace, timing-safe generic recovery answers, `@Public()` /
  `@CurrentUser()` and the global guard, with no third-party dependency; the authorization package is
  designed to run behind its guard.
- Alternatives considered: Better Auth 1.7.7 with the Drizzle adapter (first implementation; replaced
  after the design review: provider configuration and client types spread across the layers, its own
  routes and error shape, admin plugin for roles); `@thallesp/nestjs-better-auth` (third-party,
  duplicates the first-party guard and decorators).

## R2. CSRF and cookies

- Decision: Nest 12.1 `app.enableCsrfProtection({ trustedOrigins })` (Sec-Fetch-Site / Origin
  check on unsafe methods) plus the session provider's refusal of the cookie on cross-origin writes;
  cookie `sid` (`__Host-sid` once `SESSION_COOKIE_SECURE=true`), `HttpOnly`, `SameSite=Lax`,
  `Secure` from `SESSION_COOKIE_SECURE`.
- Rationale: native mechanisms, one list of trusted origins for both checks.
- Alternatives considered: CSRF tokens (unnecessary for a JSON API with SameSite cookies and
  origin checks).

## R3. Authorisation

- Decision: `@nestjs/authorization` 0.1.0 (NestJS 12.1 Authorization page): `AuthorizationModule.forRoot({ policies: [InvitationPolicy] })` imported after `AuthenticationModule`, so its global guard evaluates after the session guard; `@Can(InvitationPolicy, 'manage')` on the administrative routes, `@Can.Anyone()` on routes open to every signed-in user, `@Public()` on the anonymous ones; a route without a declaration is denied. The policy receives the `User` the session guard resolved.
- Rationale: the first-party mechanism; policies are plain classes, unit-testable; use cases stay free of authorisation code and frameworks.
- Alternatives considered: role guard with `@Roles()` metadata (replaced); authorisation inside use cases through `AuthorizationService.authorize()` (duplicates the route policy for routes without object-level rules).

## R4. Invitations

- Decision: application-owned `Invitation` aggregate (private fields, getters,
  `accept`/`revoke`/`assertPending` throwing domain errors; `version` for optimistic concurrency)
  and the value object `InvitationToken` (32 random bytes, base64url; `hash` is its SHA-256). The
  aggregate keeps only `tokenHash`; the repository looks an invitation up by the token's hash.
  `InviteUser` refuses an email with an account, revokes a pending invitation for the same email,
  stores the new one and hands the token to the `Mailing` port; `InvitationMail` builds the link
  from `WEB_BASE_URL` and the token. `AcceptInvitation` ends any carried session (controller),
  loads by token, asserts pending, refuses when an account appeared meanwhile, creates the `User`
  with the hashed password and the invited role, marks the invitation accepted and signs the new
  account in (controller). The pending list is a read model query filtered in SQL.
- Rationale: one value object with one responsibility (the link token) keeps the aggregate free of
  the secret; building the link where the mail is rendered keeps the use case free of URLs.
- Alternatives considered: returning the link in the HTTP response for manual sharing (dropped: the
  link exists only in the email); a separate fingerprint value object (merged into `InvitationToken`).

## R5. Rate limiting and client address

- Decision: `@nestjs/throttler` 6.7.1: `ThrottlerModule.forRoot({ throttlers: [{ ttl: 600000, limit: 20 }] })`
  and `@UseGuards(ThrottlerGuard)` on `POST /auth/session` and `POST /auth/password-recovery`; the
  client address is Express `req.ip` with `trust proxy` set from `TRUSTED_PROXIES`; the 21st request
  answers 429 with `Retry-After`. Storage is the in-memory default (one process); a shared
  `ThrottlerStorage` is needed before scaling out.
- Rationale: the official package, per-route and per-address, counted separately per endpoint
  (FR-017).
- Alternatives considered: a database-backed limiter (deferred until more than one instance).

## R6. Sessions

- Decision: server-side sessions in the `session` table (id = SHA-256 of the cookie token,
  `expires_at`, `last_active_at`, metadata with ip and user agent); idle timeout 7 days slid on use,
  absolute 30 days; `SessionService.revokeAll(userId, { except })` after a password change,
  `PasswordResetService` revokes every session after recovery; a suspended user's sessions stop at
  the next request because `validate()` returns `null`.
- Rationale: FR-002, FR-004, FR-015, FR-021 with the package's own services.
- Alternatives considered: JWT bearer tokens (not needed for a cookie-based web client).

## R7. Email delivery

- Decision: `@nestjs/mail` 0.0.1 with the transactional outbox as its transport. `MailModule.forRootAsync({ transport: OutboxMailTransport, from, retry: false })`; mail classes `InvitationMail` and `PasswordResetMail` implement `Mailable` with auto-escaped `html`. The `Mailing` port (`sendInvitation`) is implemented by `MailGateway`, which calls `Mailer.send(MailClass, { to, data })`; the password reset handler calls `MailGateway.sendPasswordReset`. `Mailer` renders the message and hands it to `OutboxMailTransport.send`, which writes the rendered fields (`from`, `to`, `subject`, `html`, `text`, `headers`) to `@nestjs/outbox` (`Outbox.add(tx, { topic: 'mail' })`) through the current transaction, so the row is committed with the command and never for a rolled-back one. The relay delivers it to `MailOutboxHandler`, which rebuilds the message with `Mailer.render` and sends it through the `SmtpTransport` provider (`SMTP_HOST`, `SMTP_PORT`, `SMTP_STARTTLS`, `SMTP_USER`, `SMTP_PASSWORD`; `idempotencyKey: message.id`, the handler `signal`), turning a permanent `MailError` into `NonRetryableMessageError` (dead letter); transient failures are retried by the outbox (20 attempts). Tests replace `SmtpTransport` with `InMemoryMailTransport` and drive the relay with `relay.runOnce()`. Local stack captures mail in Mailpit.
- Rationale: the constitution routes effects that leave the process through a transactional outbox;
  `@nestjs/outbox` is the first-party module and joins the Drizzle transaction natively; SMTP is the
  clarified transport; `@nestjs/mail` is the first-party client with no dependencies; the port keeps
  templates and transport out of use cases and lets tests replace the SMTP transport and drive the relay with
  `relay.runOnce()`.
- Alternatives considered: direct SMTP from the use case (sends mail for rolled-back commands, no
  retry); provider HTTP APIs (rejected in clarification).

## R8. Security events

- Decision: deferred (FR-019). `AuthenticationEvents.events$` of `@nestjs/authentication` emits
  sign-in, sign-out, password-reset-requested and password-reset events and is the hook for a later
  structured log.
- Rationale: design review 2026-10-11 removed the hook-based event log.
- Alternatives considered: audit table (rejected in clarification).

## R9. Database access and migrations

- Decision: Drizzle over a `pg.Pool` created in `DatabaseModule` (`frameworks/drizzle/client.ts`), exposed to the adapters as the abstract class `Database`;
  transaction propagation with `nestjs-cls` 7.0.1 + `@nestjs-cls/transactional` 4.0.1 +
  `@nestjs-cls/transactional-adapter-drizzle-orm` 2.0.1 (`ClsPluginTransactional` with
  `drizzleInstanceToken: Database`): command use cases are decorated with `@Transactional()`,
  repositories and `OutboxMailTransport` write through `TransactionHost.tx`. Tables `user`, `session`, `email_token` and `invitation` (with a `version` column) in `schema/`; `drizzle-kit generate` into `apps/api/drizzle`, applied with `drizzle-kit migrate`
  as a release step and by the test setup; outbox tables applied with `nest-outbox migrate` (automatic
  outside production).
- Rationale: the NestJS Drizzle page
  names the `nestjs-cls` transactional plugin for propagating a transaction across providers; the
  constitution requires one request-scoped transaction per command.
- Alternatives considered: `@nestjs/drizzle` 0.0.1 (replaced by the direct provider after the design review); passing `tx`
  by hand (leaks the database handle into use cases).

## R10. Test strategy

- Decision (constitution VI and the microservice testing strategy article), layout
  `apps/api/test/{unit,integration,component,e2e,support}`:

| Layer                                                                          | Test type               | What is verified                                                                                                                                                   |
| ------------------------------------------------------------------------------ | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Domain (`Invitation`, `InvitationToken`, `User`)                               | Sociable unit tests     | Status rules and edge cases (exclusive expiry, double accept, revoke after accept), token uniqueness and fingerprint behaviour; no doubles                         |
| Use cases and `InvitationPolicy`                                               | Solitary unit tests     | Each interactor against in-memory fakes of its ports (`test/support/fakes.ts`); outcomes read back through the fakes; no interaction assertions                    |
| Mail templates                                                                 | Unit tests              | Rendered subject, text and HTML, the link with the token, escaping                                                                                                 |
| Repositories, queries, seed migration                                          | Persistence integration | Round trips by id and token, fingerprint-only storage, SQL filtering and ordering of the pending list, version conflicts, unique index, seed                       |
| `OutboxMailTransport` and relay                                                | Mailing integration     | Rollback leaves nothing queued, commit queues and the relay delivers, a failed delivery stays queued                                                               |
| HTTP (sign-in, invitations, recovery, change password, authorization, headers) | Component tests         | The Nest application in process through supertest on a real database; `SmtpTransport` replaced by `InMemoryMailTransport`; relay driven by `OutboxRelay.runOnce()` |
| Persona journeys (US1–US4)                                                     | End-to-end              | Against the Compose stack (built image, PostgreSQL, Mailpit API for links)                                                                                         |

- Rationale: each behaviour is asserted once, at the lowest level that can observe it; domain and
  use-case tests run without containers; the database is managed and never mocked; SMTP is the only
  unmanaged dependency and is replaced by the framework's documented in-memory transport; contract
  tests are added when a consumer of the API exists.
- Alternatives considered: use-case tests on the real database (duplicated the persistence suite and
  hid the rules behind setup); PGlite for persistence tests (deferred; Testcontainers runs the same
  image as production).

## R11. Container image and local stack

- Decision: `apps/api/Dockerfile` with build context at the repository root: `ghcr.io/pnpm/pnpm:12.8.1`
  (digest-pinned) + `pnpm runtime set node 24.21.0 -g`; `deps` stage copies only `pnpm-lock.yaml` and
  `pnpm-workspace.yaml` and runs `pnpm fetch` with a BuildKit cache mount at `/var/cache/pnpm`;
  `build` stage copies sources, `pnpm install -r --offline --frozen-lockfile`, `pnpm --filter api run
build`, `pnpm --filter api --prod deploy /prod/api`; runtime stage
  `gcr.io/distroless/nodejs24-debian13:nonroot` (digest-pinned, uid 65532, Node 24.21.0),
  `NODE_ENV=production`, `COPY --chown=65532:65532`, exec-form `ENTRYPOINT ["/nodejs/bin/node",
"--enable-source-maps", "--import", "./dist/instrumentation.js", "dist/main.js"]`, `HEALTHCHECK` with the same binary against
  `/api/v1/health`.
  `apps/api/package.json` gets `"files": ["dist"]` so deploy copies only runtime files. Root
  `.dockerignore` excludes `node_modules`, `.git`, `dist`, `.next`, `coverage`, `.env*`, docs and specs.
  Compose: `compose.yaml` with `name: workflow-platform`, default network named
  `workflow-platform`, volumes `workflow-platform-postgres` and `workflow-platform-mailpit`,
  `postgres:18.6-alpine3.24` (digest-pinned, volume at `/var/lib/postgresql`, `pg_isready`
  healthcheck), `axllent/mailpit:v1.31.4` (digest-pinned, `MP_DATABASE` persistence), ports bound to
  `127.0.0.1` on uncommon host ports (55432, 51025, 58025, 53000), `api` service under profile `app`
  with `init: true`, `read_only: true`, `cap_drop: [ALL]`, `no-new-privileges`, `SESSION_COOKIE_SECURE=false` (cookies follow the http scheme locally).
- Rationale: pnpm's documented Docker recipes (no corepack: experimental in Node 24, removed in 25);
  `pnpm fetch` makes the dependency layer depend only on the lockfile; `pnpm deploy` no longer needs
  injected workspaces since 12.2; distroless has no shell or npm, runs non-root, and scanned with
  31 medium/low findings versus 185–262 for Debian slim images; project and resource names isolate
  the stack from other projects on the machine; named volumes persist across `down`.
- Alternatives considered: `node:24.21.0-alpine` (shell available, exact Node pin, but musl is an
  "Experimental" tier for Node and the image carries npm findings); Chainguard free tier (only
  `latest`, currently Node 26); MailHog (last release 2020).

## R12. Dependency pinning and vulnerability gates

- Decision: `pnpm-workspace.yaml` gains `savePrefix: ''`, `engineStrict: true`, `minimumReleaseAge:
1440`, `blockExoticSubdeps: true`, `audit: { level: high }`; every existing `^`/`~` specifier in
  the root and `apps/api` is rewritten to the exact version resolved in `pnpm-lock.yaml` (`apps/web` is
  outside this feature, DR-007); Node is
  pinned with `devEngines.runtime` (`node 24.21.0`, `onFail: download`) and `.nvmrc` 24.21.0; the
  `packageManager` field stays. Gates: `pnpm audit --prod --audit-level=high` and Trivy on
  `pnpm-lock.yaml` and on the built image (`--severity HIGH,CRITICAL --exit-code 1`; unfixed findings
  count), locally and in CI; base image digests refreshed by Dependabot (`docker` ecosystem).
- Rationale: pnpm 12 reads only auth and registry settings from `.npmrc`; `pnpm update --latest`
  keeps range operators, so the one-off rewrite is the documented-behaviour way to get exact pins;
  Trivy covers Debian, Alpine, distroless and `node_modules` with one database; `pnpm audit` is
  registry-backed with no install. Current state: `pnpm audit --prod` is clean; two high findings
  exist in dev tooling (`http-cache-semantics` fixed in >= 4.3.0 via `pnpm audit --fix`; `braces`
  has no fix and is reached only through `eslint-config-next`).
- Alternatives considered: `.npmrc save-exact` (ignored by pnpm 12); Docker Scout (needs a Docker
  Hub login; repository limits on the personal plan); OSV-Scanner (equivalent lockfile coverage,
  no Wolfi/distroless image support listed).

## R13. Platform baseline established by this feature

- Decision: `@nestjs/config` with a zod environment schema (fail fast at startup), `nestjs-pino`
  logging with request id and trace correlation from the pino auto-instrumentation, `@nestjs/terminus` health endpoint without dependency checks (`health.check([])`, `shutting_down` during the graceful shutdown delay of `TerminusModule.forRoot({ gracefulShutdownTimeoutMs })`),
  OpenTelemetry Node SDK preloaded with `--import ./dist/instrumentation.js` (configured only through `OTEL_*` variables), `@nestjs/swagger` document for the application routes, a `DomainErrorFilter` mapping domain errors to Nest `HttpException`s (standard error body), hardening headers from a small Express middleware
  (`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Cache-Control: no-store`; Nest
  12.1 ships no `useSecurityHeaders`), `app.enableShutdownHooks()`, request validation with
  `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })`, `nestjs-cls`
  transaction propagation (R9) and `@nestjs/outbox` (R7).
- Rationale: these are constitution requirements for any API feature and the first feature must
  provide them; each uses the mechanism documented by NestJS.
- Alternatives considered: `nestjs-zod` for DTO validation (peer range excludes Nest 12); deferred.

## Resolved unknowns

| Unknown                                     | Resolution                                                                |
| ------------------------------------------- | ------------------------------------------------------------------------- |
| Authentication stack                        | First-party `@nestjs/authentication` and `@nestjs/authorization` (R1, R3) |
| Invitation mechanism                        | Application-owned aggregate and token value object (R4)                   |
| "Failed attempts" semantics of the limiter  | Requests counted per endpoint and address (R5)                            |
| Client address behind the BFF               | Express `trust proxy` from `TRUSTED_PROXIES` (R5)                         |
| Password "not equal to email" rule          | Dropped (spec adjusted)                                                   |
| Newer recovery link invalidating older ones | Each link works once until its own expiry; FR-014 adjusted (R6)           |
| Transaction propagation                     | `nestjs-cls` transactional plugin, named by the NestJS Drizzle page (R9)  |
| Outbound email                              | `@nestjs/mail` with the `@nestjs/outbox` transport (R7)                   |
| Runtime base image                          | distroless `nodejs24-debian13:nonroot` (R11)                              |
| Where pinning settings live in pnpm 12      | `pnpm-workspace.yaml` (R12)                                               |
| Test layout and levels                      | Microservice testing strategy mapping (R10)                               |
