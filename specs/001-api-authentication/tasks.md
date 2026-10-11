# Tasks: API Authentication

**Input**: Design documents from `/specs/001-api-authentication/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/openapi.yaml, contracts/better-auth-endpoints.md, quickstart.md

**Tests**: Requested by the specification (DR-006, SC-005) and the constitution (test-first for known behaviour). Test tasks precede implementation in every story; each test task names the FR/scenario it covers.

**Organization**: Phases 1–2 build the API platform baseline (nothing user-visible yet); phases 3–6 are the four user stories in priority order; phase 7 polishes and verifies the delivery requirements.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1–US4)
- All paths are relative to the repository root

## Path Conventions

- API source: `apps/api/src/{domain,use-cases,interface-adapters,frameworks}` (flat layers, see plan.md)
- Unit tests: `apps/api/src/**/*.spec.ts`; integration tests: `apps/api/test/integration/*.int-spec.ts`; component tests: `apps/api/test/component/*.component-spec.ts`; end-to-end journeys: `apps/api/test/e2e/*.e2e-spec.ts`; test support: `apps/api/test/support/`
- Repository-level delivery files: `compose.yaml`, `.env.example`, `.dockerignore`, `apps/api/Dockerfile`, `pnpm-workspace.yaml`

---

## Phase 1: Setup (toolchain, pinning, delivery files)

**Purpose**: Exact dependency pinning, delivery files and test tooling that every later task relies on

- [x] T001 Add pinning and supply-chain settings to `pnpm-workspace.yaml`: `savePrefix: ''`, `engineStrict: true`, `minimumReleaseAge: 1440`, `blockExoticSubdeps: true`, `audit: { level: high }`; keep the existing `packages` and `allowBuilds` entries
- [x] T002 Pin the toolchain in root `package.json` (`devEngines.runtime: { name: "node", version: "24.21.0", onFail: "download" }`, keep `packageManager: pnpm@12.8.1`, keep `engines.node >=24.15.0`) and set `.nvmrc` to `24.21.0`
- [x] T003 Rewrite every `^`/`~` specifier in root `package.json` and `apps/api/package.json` to the exact version resolved in `pnpm-lock.yaml` (read `importers.<dir>.dependencies|devDependencies.<name>.version` from the second YAML document), run `pnpm install` (not frozen) and confirm the lockfile diff touches only `specifier:` lines; `apps/web/package.json` stays unchanged (DR-004 scope, DR-007)
- [x] T004 Add API runtime dependencies with exact versions via `pnpm --filter api add better-auth@1.7.7 @better-auth/drizzle-adapter@1.7.7 drizzle-orm@0.45.4 pg@8.23.1 @nestjs/drizzle@0.0.1 nestjs-cls@7.0.1 @nestjs-cls/transactional@4.0.1 @nestjs-cls/transactional-adapter-drizzle-orm@2.0.1 @nestjs/outbox@0.1.1 @nestjs/config@12.0.1 zod@4.6.5 class-validator@0.15.1 class-transformer@0.5.1 @nestjs/terminus@12.1.0 @nestjs/swagger@12.0.2 nestjs-pino@5.3.1 pino@10.4.0 pino-http@11.0.0 nodemailer@10.1.0 @opentelemetry/sdk-node@0.223.0 @opentelemetry/auto-instrumentations-node@0.81.0 @opentelemetry/api@1.9.1` and dev dependencies via `pnpm --filter api add -D drizzle-kit@0.31.11 @types/pg@8.23.1 @types/nodemailer@8.0.2 @testcontainers/postgresql@12.2.0 testcontainers@12.2.0 eslint-plugin-boundaries@7.2.0 pino-pretty@13.2.0`; verify `pnpm audit --prod --audit-level=high` exits 0
- [x] T005 [P] Update `apps/api/package.json`: add `"files": ["dist"]`; scripts `"start:prod": "node --enable-source-maps dist/frameworks/main.js"`, `"db:generate": "drizzle-kit generate"`, `"db:migrate": "drizzle-kit migrate"`, `"outbox:migrate": "nest-outbox migrate --url \"$DATABASE_URL\""`, `"auth:generate": "pnpm dlx auth@latest generate --config src/frameworks/auth/auth.cli.ts --adapter drizzle --dialect postgresql --output src/interface-adapters/persistence/schema/auth.ts -y"`, `"auth:create-admin": "node --import tsx scripts/create-admin.ts"` (or the compiled equivalent), `"test:int": "vitest run --config ./vitest.config.int.ts"`, `"test:e2e": "vitest run --config ./vitest.config.e2e.ts"`; set `nest-cli.json` `entryFile` to `frameworks/main` and confirm the emitted path after `pnpm --filter api build`
- [x] T006 [P] Create `.dockerignore` at the repository root excluding `**/node_modules`, `.git`, `**/dist`, `**/.next`, `**/coverage`, `.env*` (but not `.env.example`), `*.md`, `.husky`, `.specify`, `specs`, `docs`
- [x] T007 [P] Create `.env.example` at the repository root with the Compose interpolation variables (`POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `POSTGRES_PORT=55432`, `MAILPIT_SMTP_PORT=51025`, `MAILPIT_UI_PORT=58025`, `API_PORT=53000`) and the API variables for host runs (`NODE_ENV`, `PORT`, `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `WEB_BASE_URL`, `TRUSTED_ORIGINS`, `TRUSTED_PROXIES`, `OUTBOX_RELAY=on`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`, `LOG_LEVEL`, `OTEL_EXPORTER_OTLP_ENDPOINT`), each with a comment and a local-only placeholder value
- [x] T008 [P] Create `compose.yaml` per research R11: `name: workflow-platform`; `networks.default.name: workflow-platform`; volumes `postgres-data` (name `workflow-platform-postgres`) and `mailpit-data` (name `workflow-platform-mailpit`); service `postgres` (`postgres:18.6-alpine3.24@sha256:77f585114c32fbca283dc835b0596f4e52b51b4c6662d7810b2f4084f60a1873`, env from `.env`, `POSTGRES_INITDB_ARGS: --data-checksums`, volume at `/var/lib/postgresql`, `pg_isready` healthcheck, port `127.0.0.1:${POSTGRES_PORT:-55432}:5432`); service `mailpit` (`axllent/mailpit:v1.31.4@sha256:b68349e3a014b90c5610bfb26b2ae36f3892d7b8cf25ee140c6c71c98d2fcf48`, `MP_DATABASE=/data/mailpit.db`, `MP_MAX_MESSAGES=5000`, `MP_SMTP_AUTH_ACCEPT_ANY=1`, `MP_SMTP_AUTH_ALLOW_INSECURE=1`, volume `/data`, ports `127.0.0.1:${MAILPIT_SMTP_PORT:-51025}:1025` and `127.0.0.1:${MAILPIT_UI_PORT:-58025}:8025`); service `api` under `profiles: [app]` built from `apps/api/Dockerfile`, `depends_on` both with `condition: service_healthy`, environment `BETTER_AUTH_URL=http://127.0.0.1:${API_PORT:-53000}`, `init: true`, `read_only: true`, `tmpfs: [/tmp]`, `cap_drop: [ALL]`, `security_opt: [no-new-privileges:true]`, port `127.0.0.1:${API_PORT:-53000}:3000`
- [x] T009 [P] Create `apps/api/Dockerfile` per research R11: stages `base` (`ghcr.io/pnpm/pnpm:12.8.1@sha256:44cfd11d75b901dc7a83a16812d9134e4bf9d82f6b0eb28af6d666ebbf0fb4fb`, `pnpm runtime set node 24.21.0 -g`, `ENV CI=true`), `deps` (copy only `pnpm-lock.yaml` and `pnpm-workspace.yaml`, `pnpm fetch --store-dir /var/cache/pnpm` with `--mount=type=cache,id=pnpm,target=/var/cache/pnpm`), `build` (copy sources, `pnpm install -r --offline --frozen-lockfile --store-dir /var/cache/pnpm`, `pnpm --filter api run build`, `pnpm --filter api --prod deploy /prod/api --store-dir /var/cache/pnpm`), `runtime` (`gcr.io/distroless/nodejs24-debian13:nonroot@sha256:9eeb7f5887d0e239e78264b06f7f11d2e14be534050481803a9e4728fcdd278e`, `WORKDIR /app`, `ENV NODE_ENV=production`, `COPY --from=build --chown=65532:65532 /prod/api/ ./`, `EXPOSE 3000`, exec-form `HEALTHCHECK` calling `/nodejs/bin/node -e "fetch('http://127.0.0.1:3000/api/v1/health')..."`, `ENTRYPOINT ["/nodejs/bin/node", "--enable-source-maps", "dist/frameworks/main.js"]`)
- [x] T010 [P] Add layer-boundary lint rules to `apps/api/eslint.config.js` with `eslint-plugin-boundaries`: element types `domain`, `use-cases`, `interface-adapters`, `frameworks` by path under `src/`; allow `use-cases → domain`, `interface-adapters → use-cases, domain`, `frameworks → all`; forbid `domain` from importing anything outside `domain`; in `use-cases` allow only `@nestjs/common` (providers) and `@nestjs-cls/transactional` (`@Transactional`) among frameworks and forbid `@nestjs/platform-express`, `express`, `drizzle-orm`, `pg`, `better-auth`, `nodemailer`, `@nestjs/outbox`, `@opentelemetry/*` (`no-restricted-imports` scoped to those folders) — implemented with `no-restricted-imports` patterns per layer (no extra plugin; the ESM `.js` specifiers made a resolver-based plugin unreliable)
- [x] T011 [P] Configure Vitest: keep `apps/api/vitest.config.ts` for `src/**/*.spec.ts`; create `apps/api/vitest.config.int.ts` for `test/**/*.{int,component}-spec.ts` with `globalSetup: ['./test/support/global-setup.ts']`, `fileParallelism: false`, `hookTimeout: 120000`, `testTimeout: 30000`; rewrite `apps/api/vitest.config.e2e.ts` for `test/e2e/*.e2e-spec.ts` with no containers, reading `API_BASE_URL` (default `http://127.0.0.1:53000`) and `MAILPIT_URL` (default `http://127.0.0.1:58025`) from the environment, `testTimeout: 60000`
- [x] T012 [P] Create `apps/api/drizzle.config.ts` (`dialect: 'postgresql'`, `schema: './src/interface-adapters/persistence/schema/index.ts'`, `out: './drizzle'`, `dbCredentials: { url: process.env.DATABASE_URL }`, `casing: 'snake_case'`)

---

## Phase 2: Foundational (platform baseline and authentication provider)

**Purpose**: Everything every story needs: configuration, database with transaction propagation, outbox, logging, telemetry, the Better Auth instance mounted in Nest, the session guard, error envelope, health, mail port and outbox handler, security log, test support, bootstrap administrator

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T013 Replace the scaffold: delete `apps/api/src/app.controller.ts`, `apps/api/src/app.service.ts`, `apps/api/src/app.controller.spec.ts`, `apps/api/test/app.e2e-spec.ts`; create the layer directories `apps/api/src/domain`, `apps/api/src/use-cases/ports`, `apps/api/src/interface-adapters/{http,auth,persistence/schema,mail}`, `apps/api/src/frameworks/{config,database,outbox,logging,telemetry,auth}`, `apps/api/test/{support,integration,component,e2e}`, `apps/api/scripts`; move `apps/api/src/main.ts` to `apps/api/src/frameworks/main.ts` and `app.module.ts` to `apps/api/src/frameworks/app.module.ts`
- [x] T014 [P] Write unit tests for the value objects first: `apps/api/src/domain/email-address.spec.ts` (`User@Example.com` and `user@example.com` are equal; invalid format rejected; normalised form is lower-case), `apps/api/src/domain/role.spec.ts` (only `admin`, `editor`, `viewer` accepted; others rejected) and `apps/api/src/domain/password.spec.ts` (11 characters rejected with `password_too_short`; 12 accepted; 128 accepted; 129 rejected with `password_too_long`; the value never appears in `toString`/JSON)
- [x] T015 [P] Implement the domain seedwork in `apps/api/src/domain/`: `result.ts` (`Result<T, E>` with `ok`/`fail`), `domain-error.ts` (`DomainError` with stable `code` values used by the error envelope), `email-address.ts`, `role.ts` (closed set `admin | editor | viewer`), `password.ts` (12 to 128 characters, held in memory only), `principal.ts` (`userId`, `role`); no framework imports
- [x] T016 [P] Implement configuration in `apps/api/src/frameworks/config/env.schema.ts` (zod schema for every variable in `.env.example`, `BETTER_AUTH_SECRET` min 32 characters, `TRUSTED_ORIGINS` and `TRUSTED_PROXIES` parsed as comma-separated lists, `SMTP_PORT`/`PORT` as integers, `OUTBOX_RELAY` as `on | off` default `on`) and `apps/api/src/frameworks/config/config.module.ts` (`ConfigModule.forRoot({ isGlobal: true, validate })`, startup fails on an invalid environment)
- [x] T017 [P] Implement the database module in `apps/api/src/frameworks/database/database.module.ts`: `DrizzleModule.forRootAsync` (`drizzle-orm/node-postgres`, `pg.Pool` from `DATABASE_URL`, schema from `interface-adapters/persistence/schema/index.ts`, `casing: 'snake_case'`) and `ClsModule.forRoot({ global: true, middleware: { mount: true }, plugins: [new ClsPluginTransactional({ imports: [DrizzleModule], adapter: new TransactionalAdapterDrizzleOrm({ drizzleInstanceToken: getDrizzleToken() }) })] })`; export the typed adapter alias `DrizzleTx = TransactionalAdapterDrizzleOrm<Database>` for `TransactionHost<DrizzleTx>`
- [x] T018 [P] Implement the outbox module in `apps/api/src/frameworks/outbox/outbox.module.ts`: `OutboxModule.forRootAsync({ useFactory: (config) => ({ relay: { enabled: config.OUTBOX_RELAY === 'on' }, retry: { attempts: 20 } }) })` and the store provider `{ provide: PostgresOutboxStore, inject: [getDrizzleToken(), OutboxStorage], useFactory: (db, storage) => new PostgresOutboxStore({ executor: fromDrizzle(db) }, storage) }` from `@nestjs/outbox/postgres`; export nothing else (handlers register themselves with `@OnOutboxMessage`)
- [x] T019 [P] Implement logging in `apps/api/src/frameworks/logging/logging.module.ts` with `nestjs-pino` (`LoggerModule.forRootAsync`: level from config, request id from `x-request-id` or generated, redact `req.headers.cookie`, `req.headers.authorization`, `*.password`, `*.token`, `*.newPassword`, `*.currentPassword`; pretty transport only when `NODE_ENV !== 'production'`); trace and span ids come from the pino auto-instrumentation started in T020 (no manual injection)
- [x] T020 [P] Implement telemetry bootstrap in `apps/api/src/frameworks/telemetry/otel.ts` (`NodeSDK` with `getNodeAutoInstrumentations()` including the pino instrumentation for log correlation, OTLP exporter only when `OTEL_EXPORTER_OTLP_ENDPOINT` is set, `sdk.start()` on import, `sdk.shutdown()` on `SIGTERM`); it is the first import of `main.ts` — implemented as a `--import` preload (`frameworks/telemetry/otel.ts` → `@opentelemetry/auto-instrumentations-node/register`), required for ESM instrumentation
- [x] T021 [P] Define the ports in `apps/api/src/use-cases/ports/`: `mailer.ts` (`send({ to, subject, text, html })`, enqueued in the current transaction), `security-event-log.ts` (`record(event: { type, userId?, email?, clientAddress?, outcome })`), `clock.ts` (`now(): Date`), `token-generator.ts` (`generate(): { token, hash }`), `user-directory.ts` (`existsByEmail(email): Promise<boolean>`), `account-provisioner.ts` (`createAccount({ email, name, password, role }): Promise<Result<{ userId }, 'account_exists'>>` and `signIn({ email, password, requestHeaders }): Promise<{ setCookieHeaders }>`), `sessions.ts` (`read(headers): Promise<Principal | null>`, `end(headers): Promise<void>`)
- [x] T022 Define access control in `apps/api/src/interface-adapters/auth/access-control.ts`: `statement = { ...defaultStatements, invitation: ['create', 'list', 'revoke'] }`, `ac = createAccessControl(statement)`, roles `admin` (`...adminAc.statements`, all `invitation` actions), `editor` (no `invitation` actions), `viewer` (none); export `roles` for the admin plugin
- [x] T023 Implement the single options builder `apps/api/src/frameworks/auth/auth.options.ts` (`buildAuthOptions({ env, db, hooks?, sendResetPassword?, onPasswordReset?, logger? })` returning the `betterAuth` options per research R5–R8: `baseURL`, `basePath: '/api/auth'`, `secret`, `trustedOrigins`, `database: drizzleAdapter(db, { provider: 'pg', schema, transaction: true })`, `advanced: { database: { generateId: 'uuid' }, ipAddress: { ipAddressHeaders: ['x-forwarded-for'], trustedProxies }, cookiePrefix: 'app' }` (no `useSecureCookies`: the default follows the `baseURL` scheme), `emailAndPassword: { enabled: true, disableSignUp: true, minPasswordLength: 12, maxPasswordLength: 128, resetPasswordTokenExpiresIn: 3600, revokeSessionsOnPasswordReset: true }`, `session: { expiresIn: 604800, updateAge: 86400 }`, `rateLimit: { enabled: true, storage: 'database', customRules: { '/sign-in/email': { window: 600, max: 20 }, '/request-password-reset': { window: 600, max: 20 }, '/reset-password': { window: 600, max: 20 } } }`, `plugins: [admin({ ac, roles, defaultRole: 'viewer', adminRoles: ['admin'] }), openAPI()]`, `telemetry: { enabled: false }` (anonymous product telemetry)) and the CLI config `apps/api/src/frameworks/auth/auth.cli.ts` that calls `buildAuthOptions` with env-only inputs (no hooks, no mailer); run `pnpm --filter api auth:generate` to produce `apps/api/src/interface-adapters/persistence/schema/auth.ts` (including `rate_limit`), then create `apps/api/src/interface-adapters/persistence/schema/index.ts` exporting all tables — the options builder lives in `interface-adapters/auth/auth.options.ts` so that adapters can type the `AUTH` instance without importing `frameworks`
- [x] T024 Implement the Better Auth instance factory in `apps/api/src/frameworks/auth/better-auth.factory.ts` (`createBetterAuth({ env, db, hooks, mailer, securityEventLog, logger })` calling `buildAuthOptions` with the injected `hooks.after`/`databaseHooks`, `sendResetPassword`/`onPasswordReset` callbacks and the pino logger) and export the `AUTH` injection token; `apps/api/src/frameworks/auth/auth.module.ts` provides `AUTH` through `useFactory` with `getDrizzleToken()`, `ConfigService`, `Mailer`, `SecurityEventLog`, `SECURITY_EVENT_HOOKS` and the logger, and exports it; run `pnpm --filter api db:generate` to create the first migration in `apps/api/drizzle/` — provider defined in `frameworks/auth/auth.provider.ts`, registered by `IdentityAccessModule` (no separate `AuthModule`)
- [x] T025 [P] Write unit tests for the security event hooks first in `apps/api/src/interface-adapters/auth/security-event-hooks.spec.ts` using a fake `ctx` (`path`, `body`, `headers`, `context.newSession`, `context.returned` as `APIError`): sign-in success records `sign_in` with user id and client address; sign-in failure records `sign_in_failed` without the password; sign-out, `password_reset_requested`, `password_changed` recorded; ban via `user.update.after` records `suspended`; no record contains `token`, `password` or a link
- [x] T026 [P] Implement `apps/api/src/interface-adapters/auth/security-event-hooks.ts` (`createSecurityEventHooks(log)` returning `{ after: createAuthMiddleware(...), databaseHooks: { session: { create.after, delete.after }, user: { update.after } } }` per research R8, exported under the `SECURITY_EVENT_HOOKS` token) and `apps/api/src/interface-adapters/auth/pino-security-event-log.ts` implementing `SecurityEventLog` as structured info-level log lines with `event`, `userId`, `email` (lower-cased), `clientAddress`, `outcome`
- [x] T027 [P] Write unit tests for the HTTP guards first in `apps/api/src/interface-adapters/http/auth/session.guard.spec.ts` (public handler passes without a session; missing session throws `UnauthorizedException`; valid session attaches `Principal` to the request) and `apps/api/src/interface-adapters/http/auth/roles.guard.spec.ts` (no `@Roles` metadata passes; role not in list throws `ForbiddenException`; `admin` passes an admin-only route) using fake `Sessions` and `Reflector`
- [x] T028 [P] Implement the HTTP authentication adapters in `apps/api/src/interface-adapters/http/auth/`: `public.decorator.ts` (`SetMetadata(IS_PUBLIC_KEY, true)`), `roles.decorator.ts` (`SetMetadata(ROLES_KEY, roles)`), `current-principal.decorator.ts` (`createParamDecorator` reading `request.principal`), `session.guard.ts` (`CanActivate`; `reflector.getAllAndOverride(IS_PUBLIC_KEY, [handler, class])`; `sessions.read(fromNodeHeaders(request.headers))`; `UnauthorizedException` when null; sets `request.principal`), `roles.guard.ts` (`getAllAndOverride(ROLES_KEY)`, `ForbiddenException` when the principal's role is not listed); and `apps/api/src/interface-adapters/auth/better-auth-sessions.ts` implementing `Sessions` with `auth.api.getSession({ headers })` mapped to `Principal` and `auth.api.signOut({ headers })`
- [x] T029 [P] Implement the error filter in `apps/api/src/interface-adapters/http/error.filter.ts` (`@Catch()`): `DomainError` codes → HTTP status map (`invitation_not_found` 404; `invitation_used`, `invitation_revoked`, `invitation_expired` 410; `account_exists`, `invitation_conflict` 409; `forbidden` 403; `password_too_short`, `password_too_long` 400); Nest `HttpException`s → envelope with `code` `unauthenticated` (401), `forbidden` (403), `not_found` (404), `validation_failed` (400 with `details[]` of `{ field, message }` from class-validator); Better Auth `APIError` → its status and `code`; anything else → 500 with code `internal_error` and no internals; every response uses `{ code, message, details[] }`
- [x] T030 [P] Implement health in `apps/api/src/interface-adapters/http/health.controller.ts` (`GET /health`, `@Public()`, Terminus `HealthCheckService`) with `apps/api/src/interface-adapters/persistence/drizzle-health.indicator.ts` (`HealthIndicatorService`, `SELECT 1`)
- [x] T031 [P] Write unit tests first for mail message building in `apps/api/src/interface-adapters/mail/templates/templates.spec.ts` (invitation message contains the link, the inviter's name, the role and the expiry date; password-reset message contains the link and the one-hour validity; no message contains a raw token outside the link) and for the outbox handler in `apps/api/src/interface-adapters/mail/mail-outbox.handler.spec.ts` (payload is passed to the SMTP transport once; a transport error propagates so the relay retries; a failure after the last attempt is logged without the message body)
- [x] T032 [P] Implement `apps/api/src/interface-adapters/mail/templates/invitation.ts`, `apps/api/src/interface-adapters/mail/templates/password-reset.ts` (text and HTML bodies), `apps/api/src/interface-adapters/mail/nodemailer-mailer.ts` (SMTP transport over `nodemailer.createTransport` with settings from config), `apps/api/src/interface-adapters/mail/outbox-mailer.ts` (implements `Mailer`: `outbox.add(txHost.tx, { topic: 'mail.send', key: to, payload })`; when no transaction is active, opens one with `txHost.withTransaction` so the provider callback can enqueue) and `apps/api/src/interface-adapters/mail/mail-outbox.handler.ts` (`@OnOutboxMessage('mail.send', { consumer: 'smtp' })` → `NodemailerMailer.send(payload)`; subscribes to `OutboxEvents.events$` to log `dead-lettered` events)
- [x] T033 Implement `apps/api/src/frameworks/main.ts`: import `./telemetry/otel.js` first; `NestFactory.create<NestExpressApplication>(AppModule, { bodyParser: false, bufferLogs: true })`; `app.useLogger(app.get(Logger))`; `app.set('trust proxy', trustedProxies)`; `app.useSecurityHeaders()`; `app.use('/api/auth', toNodeHandler(app.get(AUTH)))`; `app.useBodyParser('json', { limit: '100kb' })`; `app.setGlobalPrefix('api/v1')`; `app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))`; `app.useGlobalFilters(app.get(ErrorFilter))`; Swagger document at `/api/v1/docs` from `@nestjs/swagger`; `app.enableShutdownHooks()` (relay drain); `await app.listen(PORT)`
- [x] T034 Implement `apps/api/src/frameworks/identity-access.module.ts` (imports `AuthModule`; providers: `BetterAuthSessions` as `Sessions`, `PinoSecurityEventLog` as `SecurityEventLog`, `OutboxMailer` as `Mailer`, `NodemailerMailer`, `MailOutboxHandler`, `SystemClock` as `Clock`, `{ provide: APP_GUARD, useClass: SessionGuard }` then `{ provide: APP_GUARD, useClass: RolesGuard }`, `ErrorFilter`, `DrizzleHealthIndicator`; controllers: `HealthController`) and `apps/api/src/frameworks/app.module.ts` (imports `ConfigModule`, `LoggingModule`, `DatabaseModule`, `OutboxModule` (frameworks/outbox), `TerminusModule`, `IdentityAccessModule`)
- [x] T035 Implement test support: `apps/api/test/support/global-setup.ts` (start `PostgreSqlContainer('postgres:18.6-alpine3.24')`, run drizzle migrations from `apps/api/drizzle`, export `DATABASE_URL`, `OUTBOX_RELAY=off` and the other required variables to `process.env`, stop the container in teardown; the outbox store migrates itself outside production), `apps/api/test/support/in-memory-smtp.ts` (replaces `NodemailerMailer`: stores messages, exposes `lastTo(email)`, can be switched to throw), `apps/api/test/support/deliver-outbox.ts` (`await app.get(OutboxRelay).runOnce()`), `apps/api/test/support/create-test-app.ts` (builds the Nest app exactly as `main.ts` does with the in-memory SMTP override, config `TRUSTED_PROXIES=127.0.0.1`, `rateLimit.enabled: true`, and a test-only `ProbeController` (`GET /probe/admin` with `@Roles('admin')`, `GET /probe/user`) registered only here), `apps/api/test/support/db.ts` (truncate `invitation`, `session`, `account`, `user`, `verification`, `rate_limit`, `nest_outbox.messages`, `nest_outbox.inbox`, `nest_outbox.dead_letters` between tests), `apps/api/test/support/auth-helpers.ts` (`createUser({ email, password, role })` through `auth.api.createUser`; `signIn(app, email, password)` returning the cookie header; `authHeaders(cookie)`; `expireSession(db, cookie)` setting `session.expires_at` into the past)
- [x] T036 Implement the bootstrap administrator seed in `apps/api/scripts/create-admin.ts` (operational seed, outside the layers like a migration; plan Complexity Tracking): parse `--email`, `--name`, `--password` (or prompt), validate with the domain value objects `EmailAddress` and `Password`, refuse with a non-zero exit when a user with role `admin` already exists (query through Drizzle), otherwise call `auth.api.createUser({ body: { email, name, password, role: 'admin', data: { emailVerified: true } } })` using the CLI auth options; log the outcome without the password — split into `frameworks/bootstrap-administrator.ts` (function) and `frameworks/create-admin.ts` (CLI) so the seed ships in the image and is testable
- [x] T037 Write the integration test for the bootstrap seed in `apps/api/test/integration/create-admin.int-spec.ts` (creates the first admin; second run is refused; password shorter than 12 characters is refused; invalid email is refused) and make it pass

**Checkpoint**: `pnpm --filter api test` and `pnpm --filter api test:int` run (green on the foundational suites); `GET /api/v1/health` and `GET /api/auth/ok` return 200 against the Compose stack

---

## Phase 3: User Story 1 - Sign in with email and password (Priority: P1) 🎯 MVP

**Goal**: A user signs in with email and password, stays signed in for 7 days of inactivity, signs out; failures never reveal whether the email exists; suspended users are refused; 20 requests per client address per 10 minutes

**Independent Test**: Create the bootstrap administrator, sign in with the correct password, call a protected endpoint, sign out, confirm the endpoint refuses the old cookie

### Tests for User Story 1

- [x] T038 [P] [US1] Write the component test `apps/api/test/component/sign-in.component-spec.ts` covering US1 scenarios 1–6, FR-001…FR-004, FR-017 and the session edge cases: correct credentials → 200 with `Set-Cookie app.session_token` (`HttpOnly`, `SameSite=Lax`, no `Secure` under the http test base URL); wrong password and unknown email → 401 with byte-identical bodies (SC-004); sign-out → 200 and the cookie is refused afterwards with 401; a session whose `expires_at` is moved into the past (`expireSession`) → 401; banned user (`auth.api.banUser` with admin headers) → 403 `BANNED_USER` on sign-in and the user's existing session cookie → 401 (sessions ended at suspension); email case-insensitivity (`User@Example.com`); 21st `POST /api/auth/sign-in/email` from one `x-forwarded-for` address within the window → 429 with `X-Retry-After`, while another address still gets 401/200
- [x] T039 [P] [US1] Write the component test `apps/api/test/component/session-guard.component-spec.ts` using the test-only probe routes: `GET /api/v1/health` is public; `GET /api/v1/probe/user` without a cookie → 401 `{ code: "unauthenticated" }`; an `editor` on `GET /api/v1/probe/admin` → 403 `{ code: "forbidden" }`; an unknown route → 404 `{ code: "not_found" }`; `POST /api/auth/sign-up/email` → 400 `EMAIL_PASSWORD_SIGN_UP_DISABLED` (FR-005)
- [x] T040 [P] [US1] Write the component test `apps/api/test/component/security-events.component-spec.ts` capturing pino output (test transport): successful sign-in, failed sign-in and sign-out each produce exactly one structured record with `event`, `userId` or `email`, `clientAddress`, `trace_id` and `span_id`, and no `password` or `token` fields (FR-019)

### Implementation for User Story 1

- [x] T041 [US1] Make the sign-in and guard suites pass: confirm the options from T023 (`disableSignUp`, password lengths, `customRules`, `trustedProxies`, `cookiePrefix`) and the `HttpException` mapping of T029; no production stub is added
- [x] T042 [US1] Make the security-events suite pass: wire `createSecurityEventHooks` into the factory (T024) and the pino log sink; verify `clientAddress` comes from `ctx.context.newSession.session.ipAddress` on success and from the forwarded header on failure
- [x] T043 [US1] Run quickstart Scenario 1 against the Compose stack (`docker compose up -d`, `pnpm --filter api db:migrate`, `pnpm --filter api outbox:migrate`, `pnpm --filter api auth:create-admin`, sign-in/sign-out with curl) and record the result in this file's notes

**Checkpoint**: US1 complete and independently testable; MVP deployable

---

## Phase 4: User Story 2 - Invite a user by link (Priority: P2)

**Goal**: Administrators create single-use, 7-day invitations with a role; invitees set name and password and are signed in; pending invitations can be listed and revoked

**Independent Test**: As admin create an invitation for a new email with role `editor`; verify the link; accept it; the new user is signed in as `editor`; the link is refused afterwards

### Tests for User Story 2

- [x] T044 [P] [US2] Write the domain unit test `apps/api/src/domain/invitation.spec.ts`: `Invitation.create(email, role, invitedBy, now)` sets `status = pending`, `version = 1` and `expiresAt = now + 7 days` exactly; `accept(now, userId)` before expiry → `accepted` with `acceptedAt = now`, `acceptedUserId` set and `version` incremented; `accept` at `expiresAt` exactly → refused `invitation_expired` (expiry is exclusive); second `accept` → `invitation_used`; `revoke(now)` on pending → `revoked` with `revokedAt` and `version` incremented; `revoke` on accepted → `invitation_used`; `accept` on revoked → `invitation_revoked`; `statusAt(now)` reports `expired` for a pending invitation past `expiresAt`; the raw token is never part of the aggregate state (only `tokenHash`)
- [x] T045 [P] [US2] Write the integration test `apps/api/test/integration/invitations.int-spec.ts` on the real database: `DrizzleInvitationRepository` round trip (save, find by hash, list pending, `version` incremented on update, stale version → `invitation_conflict`); `CreateInvitation` revokes the previous pending invitation for the same email in the same transaction (FR-009), refuses an email that already has an account via `DrizzleUserDirectory` (`account_exists`), writes exactly one `mail.send` outbox message that is delivered by `deliverOutbox` to the in-memory SMTP transport, and leaves no outbox message and no invitation when the transaction fails (throwing repository stub on the second write); a non-admin `Principal` → `forbidden` for create, list and revoke (FR-012); `AcceptInvitation` sequence: account created first, then the conditional update, so two concurrent acceptances yield one `ok` and one `account_exists`; `BetterAuthAccountProvisioner.createAccount` creates a user with the given role and `emailVerified = true`, `signIn` returns `Set-Cookie` headers; invitation security events are recorded
- [x] T046 [P] [US2] Write the component test `apps/api/test/component/invitations.component-spec.ts` covering US2 scenarios 1–7 and the edge cases against `contracts/openapi.yaml`: `POST /api/v1/invitations` as admin → 201 with `link` and, after `deliverOutbox`, an email captured by the in-memory transport; as editor → 403; without session → 401; existing account → 409 `account_exists`; `POST /invitations/verify` → 200 `{ email, role, expiresAt }`; `POST /invitations/accept` with a 6-character password → 400 `validation_failed` with `details[0].field = "password"` and with a 129-character password → 400; valid accept → 200 with `Set-Cookie` and `user.role = "editor"`; accept while sending the admin's cookie → 200 and the admin cookie is refused afterwards (existing session ended before the account is created); verify after accept → 410 `invitation_used`; `DELETE /invitations/:id` → 204 and verify → 410 `invitation_revoked`; `DELETE` of an accepted invitation → 410 `invitation_used` and the account still signs in; a second invitation for a pending email makes the first link return 410 `invitation_revoked`; `GET /invitations` lists only pending ones; with the SMTP transport switched to throw, `POST /invitations` still returns 201 with `link`, `deliverOutbox` schedules a retry and a log record names the failure

### Implementation for User Story 2

- [x] T047 [P] [US2] Implement the aggregate `apps/api/src/domain/invitation.ts` (fields and invariants from data-model.md: `id`, `email: EmailAddress`, `role: Role`, `tokenHash`, `status: pending | accepted | revoked`, `expiresAt`, `invitedBy`, `acceptedAt`, `acceptedUserId`, `createdAt`, `revokedAt`, `version`; methods `create`, `accept(now, userId)`, `revoke(now)`, `statusAt(now)`; failures as `DomainError` codes `invitation_expired`, `invitation_used`, `invitation_revoked`) and the port `apps/api/src/domain/repositories/invitation-repository.ts` (`save(invitation): Promise<Result<void, 'invitation_conflict'>>` (insert, or update guarded by `version`), `findByTokenHash`, `findById`, `findPendingByEmail`, `listPending`, `tryAccept(tokenHash, now, userId): Promise<Invitation | null>`)
- [x] T048 [P] [US2] Implement the Drizzle schema `apps/api/src/interface-adapters/persistence/schema/invitation.ts` exactly as in data-model.md (`id uuid` default generated primary key; `email text` not null; `role text` with check in (`admin`, `editor`, `viewer`); `token_hash text` unique not null; `status text` with check in (`pending`, `accepted`, `revoked`) default `pending`; `expires_at timestamptz` not null; `invited_by uuid` references `user.id`; `accepted_at timestamptz`; `accepted_user_id uuid` references `user.id`; `created_at timestamptz` not null default now; `revoked_at timestamptz`; `version integer` not null default 1; partial unique index on `email` where `status = 'pending'`), export it from `schema/index.ts`, run `pnpm --filter api db:generate` and commit the migration in `apps/api/drizzle/`
- [x] T049 [US2] Implement `apps/api/src/interface-adapters/persistence/drizzle-invitation-repository.ts` over `TransactionHost<DrizzleTx>` (`txHost.tx` for every statement; `save` updates with `SET …, version = version + 1 WHERE id = $id AND version = $expected` and maps zero rows and the partial-unique-index violation (`23505` on the pending-email index) to `invitation_conflict`, rethrowing everything else; `tryAccept` as a single `UPDATE … SET status='accepted', accepted_at=$now, accepted_user_id=$userId, version=version+1 WHERE token_hash=$hash AND status='pending' AND expires_at > $now RETURNING *`) and `apps/api/src/interface-adapters/persistence/drizzle-user-directory.ts` (`existsByEmail` on the Better Auth `user` table, lower-cased comparison)
- [x] T050 [P] [US2] Implement `apps/api/src/interface-adapters/auth/crypto-token-generator.ts` (`randomBytes(32)` base64url token, `sha256` hex hash), `apps/api/src/interface-adapters/auth/system-clock.ts`, and `apps/api/src/interface-adapters/auth/better-auth-account-provisioner.ts` (`createAccount`: `auth.api.createUser({ body: { email, name, password, role, data: { emailVerified: true } } })` with no headers, mapping `USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL` to `account_exists`, returning the new `userId`; `signIn`: `auth.api.signInEmail({ body: { email, password }, headers: forwardedHeadersOnly(requestHeaders), returnHeaders: true })` returning `headers.getSetCookie()`)
- [x] T051 [US2] Implement the use cases in `apps/api/src/use-cases/` (commands decorated with `@Transactional()` from `@nestjs-cls/transactional`; every administrative use case checks `principal.role === 'admin'` first and returns `forbidden` otherwise): `create-invitation.ts` (`EmailAddress`/`Role` parsing; `userDirectory.existsByEmail` → `account_exists`; revoke `findPendingByEmail` and `save` it; `tokenGenerator.generate()`; `Invitation.create`; `repository.save`; `mailer.send(invitationTemplate(link = `${WEB_BASE_URL}/invitations/accept?token=…`))` (outbox write in the same transaction); `securityEventLog.record('invitation_created')`; returns the invitation and the link), `list-pending-invitations.ts` (query), `revoke-invitation.ts` (`invitation_not_found`; `securityEventLog.record('invitation_revoked')`), `verify-invitation.ts` (query returning `{ email, role, expiresAt }` or the status code), `accept-invitation.ts` (`Password` and name parsing; `sessions.read(headers)` → if a principal exists, `sessions.end(headers)`; `repository.findByTokenHash` → refuse unless `statusAt(now) === 'pending'`; `accountProvisioner.createAccount` → `account_exists` leaves the invitation pending and is logged; `repository.tryAccept(hash, now, userId)` → `null` after a concurrent revoke is logged and answered `invitation_revoked`; `accountProvisioner.signIn`; `securityEventLog.record('invitation_accepted')`; returns the user and the `Set-Cookie` headers)
- [x] T052 [US2] Implement `apps/api/src/interface-adapters/http/invitations.controller.ts` (`@Controller('invitations')`; `POST /` and `GET /` and `DELETE /:id` with `@Roles('admin')`; `POST /verify` and `POST /accept` with `@Public()`; `accept` appends every `Set-Cookie` header to the response; responses shaped per `contracts/openapi.yaml`; Swagger decorators) and the DTOs `apps/api/src/interface-adapters/http/dto/{create-invitation,verify-invitation,accept-invitation}.dto.ts` with class-validator rules (`@IsEmail`, `@IsIn(['admin','editor','viewer'])`, `@MinLength(32)` token, `@Length(1, 120)` name, `@Length(12, 128)` password as boundary validation); register the controller, repository, user directory, token generator, clock and account provisioner in `apps/api/src/frameworks/identity-access.module.ts`
- [x] T053 [US2] Make the US2 suites pass; run quickstart Scenario 2 against the Compose stack and confirm the invitation email in Mailpit after relay delivery

**Checkpoint**: US1 and US2 independently functional

---

## Phase 5: User Story 3 - Recover a forgotten password (Priority: P3)

**Goal**: A user requests recovery by email; if the account exists a single-use link valid for 1 hour is sent; completing recovery replaces the password and ends every other session

**Independent Test**: Request recovery for an existing email, take the link from the captured email, set a new password, sign in with it, confirm the old password and the link no longer work

### Tests for User Story 3

- [x] T054 [P] [US3] Write the component test `apps/api/test/component/password-recovery.component-spec.ts` covering US3 scenarios 1–6, FR-013…FR-015 and the edge cases: request for an existing email → 200 generic body and, after `deliverOutbox`, one captured email whose link contains `token=`; request for an unknown email → identical 200 body and no email; request for a banned user → 200 and no email; `POST /api/auth/reset-password` with the token and a valid password → 200, old password refused, pre-existing session cookie refused with 401, second use of the token → 400 `INVALID_TOKEN`; expired token (move `verification.expires_at` into the past) → 400; two requests for the same account → two links that each work once (FR-014); password of 6 characters → 400 `PASSWORD_TOO_SHORT`; with the SMTP transport switched to throw, the request still returns the generic 200 and `deliverOutbox` schedules a retry with a log record; a request for an email that has only a pending invitation → 200, no email, the invitation still verifies as pending; a link issued before `banUser` and used afterwards → 200 on reset but sign-in → 403 `BANNED_USER`; 21st recovery request from one address within 10 minutes → 429
- [x] T055 [P] [US3] Extend `apps/api/test/component/security-events.component-spec.ts` with `password_reset_requested` (email only, no token) and `password_reset_completed` (user id) records

### Implementation for User Story 3

- [x] T056 [US3] Implement the recovery wiring in `apps/api/src/frameworks/auth/better-auth.factory.ts`: `sendResetPassword({ user, token })` skips banned users, builds `${WEB_BASE_URL}/reset-password?token=${token}` and calls `mailer.send(passwordResetTemplate(...))` (the `OutboxMailer` opens its own transaction because the provider callback carries none) without awaiting delivery; `onPasswordReset({ user })` records `password_reset_completed`; keep `revokeSessionsOnPasswordReset: true`
- [x] T057 [US3] Make the US3 suites pass and run quickstart Scenario 3 against the Compose stack (link visible in Mailpit after relay delivery, old session rejected)

**Checkpoint**: US1–US3 independently functional

---

## Phase 6: User Story 4 - Change own password (Priority: P4)

**Goal**: A signed-in user changes the password with the current one; every other session ends; the caller stays signed in through a newly issued session

**Independent Test**: Sign in twice (two cookies), change the password with cookie A, confirm cookie B is refused, the old password fails and the new one works

### Tests for User Story 4

- [x] T058 [P] [US4] Write the component test `apps/api/test/component/change-password.component-spec.ts` covering US4 scenarios 1–4 and FR-021: correct current password and valid new password with `revokeOtherSessions: true` → 200 with a fresh `Set-Cookie`, the other session's cookie → 401, old password refused on sign-in, new password accepted; wrong current password → 400 `INVALID_PASSWORD` and the password is unchanged; new password of 6 characters → 400 `PASSWORD_TOO_SHORT`; request without a session → 401; the built-in `/change-password` limit (3 per 10 s) is handled by truncating the `rate_limit` table between cases (no sleeps)
- [x] T059 [P] [US4] Extend `apps/api/test/component/security-events.component-spec.ts` with `password_changed` success and failure records

### Implementation for User Story 4

- [x] T060 [US4] Confirm the options need no change for FR-021 (native `changePassword` with `revokeOtherSessions` ends all sessions and issues a fresh one), make the US4 suites pass, and run quickstart Scenario 4 against the Compose stack

**Checkpoint**: All four user stories independently functional

---

## Phase 7: Polish, delivery gates and documentation

**Purpose**: Delivery requirements DR-001…DR-006, the end-to-end journey suite, documentation that this feature changes, final verification

- [x] T061 [P] Build the image and record measurements in the plan's Complexity Tracking table (`specs/001-api-authentication/plan.md`): `docker build -f apps/api/Dockerfile -t workflow-platform/api:dev .` (wall time of a cold build), a second build after a one-line change in `apps/api/src` with `--progress=plain` confirming the `deps` stage is `CACHED` (wall time), `docker image inspect workflow-platform/api:dev --format '{{.Size}}'`, `docker history workflow-platform/api:dev`; confirm `docker inspect --format '{{.Config.User}}'` reports the non-root user and that the entrypoint is fixed
- [x] T062 [P] Run the vulnerability gates and record results in this file's notes: `trivy image --scanners vuln --severity HIGH,CRITICAL --exit-code 1 --exit-on-eol 1 workflow-platform/api:dev` (unfixed findings count), `trivy fs --scanners vuln --severity HIGH,CRITICAL --exit-code 1 pnpm-lock.yaml`, `pnpm audit --prod --audit-level=high`; resolve every finding by bumping, overriding via `pnpm audit --fix` or removing the dependency; no `.trivyignore`
- [x] T063 [P] Verify the Compose stack from a clean state and time it (SC-007): `time (docker compose down -v && docker compose --profile app up -d --wait)`, both infrastructure services healthy, `curl http://127.0.0.1:53000/api/v1/health` → 200, sign in through the container with `BETTER_AUTH_URL=http://127.0.0.1:53000` (cookie reused by curl over http), `docker compose down` then `up -d` and confirm the user still exists (volume persistence); confirm `docker network ls` and `docker volume ls` show only `workflow-platform*` names for this stack; record the elapsed time in this file's notes
- [x] T064 [P] Add the CI workflow `.github/workflows/ci.yml`: install with `pnpm install --frozen-lockfile`, `pnpm lint`, `pnpm check-types`, `pnpm --filter api test`, `pnpm --filter api test:int` (Docker available for Testcontainers), `pnpm audit --prod --audit-level=high`, `aquasecurity/trivy-action@v0.36.0` on `pnpm-lock.yaml`, `docker build` of `apps/api/Dockerfile` followed by `trivy-action` on the image with `exit-code: '1'`, `severity: 'CRITICAL,HIGH'`, `ignore-unfixed: false`, then `docker compose --profile app up -d --wait` and `pnpm --filter api test:e2e`; add `.github/dependabot.yml` for `docker` and `npm` ecosystems
- [x] T065 [P] Write the end-to-end journey suite `apps/api/test/e2e/{sign-in,invitation,password-recovery,change-password}.e2e-spec.ts` against the running Compose stack (`API_BASE_URL`, `MAILPIT_URL`): each spec is one quickstart scenario executed unattended with `fetch`, reading links from the Mailpit API (`GET /api/v1/messages`, `GET /api/v1/message/{id}`), provisioning its own users through the invitation flow of a bootstrap administrator created by `auth:create-admin`, and cleaning up Mailpit messages it created; `apps/api/test/e2e/support/mailpit.ts` and `apps/api/test/e2e/support/api.ts` hold the helpers
- [x] T066 [P] Update architecture documentation for the Identity & Access context: `docs/architecture/01-domain.md` (Invitation aggregate with `version`; `EmailAddress`, `Role`, `Password` value objects in the contexts table and class diagram), `docs/architecture/03-api.md` (Identity & Access use cases and `invitations` controller; `interface-adapters/auth` and `interface-adapters/mail` folders; `SessionGuard` instead of `AuthGuard`; transaction propagation with `nestjs-cls`; `@nestjs/outbox` for email; terminology note: spec "suspended" = provider "banned"), `docs/architecture/06-security.md` (rate limit values, trusted proxy requirement and the shared `no-trusted-ip` budget, invitation token hashing, recovery tokens stored as issued by the provider, first administrator created by the operator seed command instead of the Better Auth CLI)
- [x] T067 [P] Update `apps/api/README.md` (scripts added in T005, Compose usage, outbox migration, create-admin command, the three test suites) and root `README.md` (Compose stack and ports, `.env.example`)
- [x] T068 Run the full quickstart (`specs/001-api-authentication/quickstart.md`) end to end and the pinning check (`grep -nE '"[\^~]' package.json apps/api/package.json` must find nothing; `pnpm install --frozen-lockfile` succeeds); run `pnpm lint && pnpm check-types && pnpm --filter api test && pnpm --filter api test:int && docker compose --profile app up -d --wait && pnpm --filter api test:e2e` and attach the summary output to this file's notes
- [x] T069 Compare the generated Swagger document (`GET /api/v1/docs-json`) with `specs/001-api-authentication/contracts/openapi.yaml` and reconcile differences in either the code or the contract; confirm `GET /api/auth/reference` serves the Better Auth reference

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies; T003 depends on T001 (settings) and T004 depends on T003 (clean exact-version baseline before adding packages)
- **Foundational (Phase 2)**: depends on Phase 1; blocks all user stories. Internal order: T013 → (T014–T021 in parallel) → T022 → T023 → T024 → (T025–T032 in parallel) → T033 → T034 → T035 → T036 → T037
- **User Stories (Phases 3–6)**: depend on Phase 2. US1 first (MVP). US2 is independent of US1 beyond the shared platform. US3 and US4 are independent of US2 and of each other
- **Polish (Phase 7)**: depends on the stories being complete; T061–T067 parallel; T068 and T069 last

### User Story Dependencies

- **US1 (P1)**: platform only
- **US2 (P2)**: platform; uses the admin role from US1's bootstrap admin for tests but no US1 code
- **US3 (P3)**: platform; needs an existing user (created through `auth.api.createUser` in test support, not through US2)
- **US4 (P4)**: platform; same as US3

### Within Each User Story

- Tests are written first and must fail before implementation
- Domain → ports/adapters → use cases → controller → module wiring → make tests green → quickstart scenario

### Parallel Opportunities

- Phase 1: T005–T012 in parallel after T004
- Phase 2: T014–T021 in parallel; T025–T032 in parallel
- US2: T044, T045, T046 in parallel; then T047, T048, T050 in parallel; T049 after T048; T051 after T047–T050; T052 after T051
- Phase 7: T061–T067 in parallel

---

## Parallel Example: User Story 2

```bash
# Tests first, in parallel:
Task: "Domain unit test apps/api/src/domain/invitation.spec.ts"
Task: "Integration test apps/api/test/integration/invitations.int-spec.ts"
Task: "Component test apps/api/test/component/invitations.component-spec.ts"

# Then the independent building blocks:
Task: "Aggregate and repository port apps/api/src/domain/invitation.ts"
Task: "Drizzle schema apps/api/src/interface-adapters/persistence/schema/invitation.ts"
Task: "Token generator, clock, account provisioner in apps/api/src/interface-adapters/auth/"
```

---

## Implementation Strategy

### MVP First (User Story 1 only)

1. Phase 1 (pinning, Compose, Dockerfile, test tooling)
2. Phase 2 (platform baseline, transaction propagation, outbox, Better Auth mounted, guard, health, mail, logs, test support, bootstrap admin)
3. Phase 3 (sign-in/sign-out suites green, quickstart Scenario 1)
4. Stop and validate: the bootstrap administrator can sign in and out against the Compose stack

### Incremental Delivery

1. US2 adds onboarding by invitation (the only way to add users)
2. US3 adds self-service recovery
3. US4 adds self-service password change
4. Phase 7 closes the delivery requirements (image, scans, CI, end-to-end journeys, docs)

---

## Notes

- Tests precede implementation in every story (constitution Principle VI; DR-006)
- DR-004 scope is the repository root and `apps/api`; `apps/web/package.json` keeps its ranges (DR-007)
- The built-in Better Auth limit for `/change-password` (3 requests per 10 s) stays in force; it is not covered by FR-017 and is handled in the tests of US4 by truncating `rate_limit`
- Build measurements go to plan.md (Complexity Tracking); scan results, the clean-start time (SC-007) and the final test summary go here after T062, T063 and T068

## Results

- Cold image build 74 s; rebuild after a one-line source change 39 s with the `deps` stage `CACHED`; image 611 MB, non-root (uid 65532), fixed entrypoint; measurements also in plan.md
- Trivy image scan (unfixed findings counted): 0 critical/high; Trivy lockfile scan: 0; `pnpm audit --prod --audit-level=high`: no known vulnerabilities
- Quickstart scenarios 1–4 executed against the Compose stack (scenarios 1 and 2 by script against the built `dist`, 3 and 4 through the end-to-end suite against the container image); invitation and recovery emails observed in Mailpit
- Security events verified in the container logs: `sign_in`, `sign_in_failed`, `sign_out`, `invitation_created`, `invitation_accepted`; trace and span identifiers appear only when an OTLP endpoint is configured (no tracer provider without an exporter)
- Clean-state start (SC-007): `docker compose --profile app down -v`, infrastructure healthy in 8 s, migrations, outbox schema and the seeded administrator in 15 s in total; after `down`/`up` the administrator signs in again (named volumes persist); every network, volume and container is named `workflow-platform*`; on an empty database the API container exits until the migrations are applied, so the infrastructure starts first
- End-to-end runs from the host carry no forwarded client address, so they share the `no-trusted-ip` budget: more than two runs within 10 minutes hit 429 on sign-in; `truncate table rate_limit` between runs (quickstart)
- Final verification (2026-10-11): `pnpm lint` (api, web) clean; `pnpm check-types` (api, web) clean; unit 41/41 (api) and 1/1 (web); integration + component 59/59 on Testcontainers PostgreSQL 18.6; end-to-end journeys 4/4 against the container image; `pnpm audit --prod --audit-level=high` clean; Trivy image and lockfile 0 critical/high; pinning check "all exact" for the root and the API; `pnpm install --frozen-lockfile` succeeds
- Generated OpenAPI document (`/api/v1/docs-json`) matches `contracts/openapi.yaml`: same paths and status codes (plus a controller-wide 400 for validation), response schemas from explicit DTO classes, cookie security scheme; `/api/auth/reference` served by the provider
- Incremental `pnpm add` calls left the lockfile with two peer variants of `vitest` (with and without `@opentelemetry/api`), which broke the web type check through the `jest-dom` augmentation; `pnpm install --fix-lockfile` re-resolved one variant for the workspace; `apps/web` sources and manifest are untouched (DR-007)

## Design review after implementation (2026-10-11)

- Value objects `EmailAddress`, `Password`, `Role` and the `Result` type removed: validation lives in the DTOs, rule violations are domain errors thrown by the aggregate and the adapters and translated by `HttpErrorFilter`
- `Clock`, `IdGenerator`, `TokenGenerator`, `Links` ports replaced by `new Date()`, `node:crypto`, `InvitationToken` and the `Links` interface; the provider ports merged into `Accounts`; every layer declares one `interfaces.ts` for the layer outside it
- Use cases are plain classes without framework imports (`InviteUser`, `ListPendingInvitations`, `RevokeInvitation`, `VerifyInvitationLink`, `AcceptInvitation`), assembled by factory providers in `frameworks/di`; the transaction is opened at the controller (`@Transactional()`)
- Authorization through `@nestjs/authorization` policies (`InvitationPolicy`, `@Can`) behind the session guard; `RolesGuard` removed
- Clients (Better Auth, nodemailer transport, Drizzle, outbox store) are created only in `frameworks/di`; the aggregate uses private fields and getters, all row mapping is in the repository
- The bootstrap administrator is a data migration (`drizzle/0001_bootstrap_administrator.sql`, no password); the `auth:create-admin` command and its tests are gone, the first password is set through recovery (covered by a component test and the end-to-end journeys)
- Constitution clauses to amend for consistency: `Result` return type, repository interfaces in `domain`, injected time, authorisation inside use cases

## Second design review (2026-10-11): rewrite by layer

- Entities: `Invitation` (private fields, getters, `create()` issues the link secret and keeps its SHA-256, `accept`/`revoke`/`assertPending`, `version` carried only) and `User` (`isAdmin`); no password or name constants in the domain
- Use cases: five interactors plus `InvitationPolicy` (`@nestjs/authorization` policy delegating to `User`); `interfaces.ts` declares input/output models and the output ports `InvitationRepository`, `UserRepository`, `Mailer`, `Links` as abstract classes (also the injection tokens; no symbols)
- Interface adapters: controllers → presenters (`InvitationPresenter`, `WebLinks`, `MailPresenter`), repositories with data mappers (`DrizzleInvitationRepository` + `InvitationMapper`, `BetterAuthUserRepository` + `UserMapper`), `BetterAuthSessionProvider` (`@nestjs/authentication` provider), `SmtpGateway`, `OutboxMailer`, `DomainErrorFilter` (domain errors → Nest `HttpException`; the custom envelope, validation pipe and guards are gone)
- Frameworks: `di/` holds modules only; one factory per technology (`better-auth/client.ts`, `drizzle/client.ts`, `nodemailer/transport.ts`, `pino/http-logger.ts`); `src/main.ts` is a plain bootstrap; `src/instrumentation.ts` registers OpenTelemetry through `import-in-the-middle/register-hooks.mjs` (no deprecated `module.register`) and is configured only by `OTEL_*` variables
- Health: `@nestjs/terminus` `health.check([])` (no dependency probes) and `TerminusModule.forRoot({ gracefulShutdownTimeoutMs: 5000 })` with `enableShutdownHooks()`
- Removed: security event log and provider hooks (FR-019 deferred), `@nestjs/drizzle`, `IdentityAccessModule`, `Clock`/`Result`/value objects, comments in code
- Tests: unit (entities, policy, presenter, mapper), integration + component on Testcontainers, end-to-end against the Compose stack; error assertions use the standard Nest bodies
- Constitution clauses to amend: `Result` return type, repository interfaces in `domain`, injected time, "data crossing a boundary ... entities MUST NOT cross boundaries outward" (use cases return entities to presenters), security event requirement (FR-019 deferred)

## Third design review (2026-10-11): NestJS authentication stack

- Better Auth removed; `@nestjs/authentication` (cookie sessions, scrypt hasher, password reset tokens), `@nestjs/authorization` (policies) and `@nestjs/throttler` (20 requests per 10 minutes per address on sign-in and recovery) replace it
- `use-cases/` became `application/` with `use-cases/`, `policies/` and `interfaces.ts`; new use cases `AuthenticateUser`, `ChangePassword`, `ResetPassword`; `UserRepository.findActiveById/findActiveByEmail` carry the active-account conditions used by the session provider and the recovery handler; `User` entity with `passwordHash`, `suspended`, `isAdmin`; access decisions stay in `InvitationPolicy` and the use cases
- Adapters: `SessionAuthenticationProvider`, `PasswordRecoveryHandler`, `DrizzleUserRepository`, `DrizzleSessionStore`, `DrizzleEmailTokenStore`, `AuthController` (`/auth/session`, `/auth/password-recovery`, `/auth/password`)
- Frameworks: `IdentityAccessModule` assembles the bounded context; `main.ts` enables `trust proxy` and `enableCsrfProtection`
- Schema regenerated (`user`, `session`, `email_token`, `invitation`); seed migration rewritten; `BETTER_AUTH_*` variables replaced by `SESSION_COOKIE_SECURE`
- Domain: `InvitationSecret` (generation, hashing) and `InvitationToken` (fingerprint held by the invitation) value objects; `Invitation.create` returns the entity; `InvitationQueries.listPending` reads raw rows filtered in SQL for the list endpoint, `InvitationPresenter.pending` maps them
- Mail: `@nestjs/mail` replaces nodemailer; the transactional outbox is the `Mailer` transport (`OutboxMailTransport` stores the rendered message), `MailGateway` implements the `Mailing` port over `Mailer.send(MailClass)`, one `MailOutboxHandler` rebuilds the message with `Mailer.render` and sends it through `SmtpTransport`; tests replace `SmtpTransport` with `InMemoryMailTransport`; `interface-adapters/mailing/` holds the inbound `MailOutboxHandler` and `templates/` with the mail classes; `persistence/` is split into `repositories/`, `mappers/`, `queries/`, `schema/` (one handler per topic, `Mailer.send` with `idempotencyKey`/`signal`/`retry: false`); `SMTP_STARTTLS` added to the environment

## Fourth design review (2026-10-11): domain model, mail links, stores, tests

- Domain: one value object `InvitationToken` (`generate()`, `value`, `hash`) replaces `InvitationSecret` + `InvitationToken`; `Invitation` keeps `tokenHash` only
- The invitation link is built by `InvitationMail` from `WEB_BASE_URL` and the token; the `Links` port and `WebLinks` are removed; `POST /invitations` returns the invitation without a link (spec FR-007, US2 scenarios and `contracts/openapi.yaml` adjusted)
- `DrizzleSessionStore` and `DrizzleEmailTokenStore` moved to `interface-adapters/auth/stores`
- Code style: awaited calls assigned to named variables before use; guard clauses separated by blank lines; `OutboxMailTransport` joins or opens the transaction through `withTransaction` (propagation `Required`)
- Tests moved out of `src` into `test/{unit,integration,component,e2e,support}` per the microservice testing strategy (research R10): unit (domain, use cases on in-memory fakes, templates), persistence and mailing integration, component, end-to-end
- Dependencies removed: `import-in-the-middle`, `source-map-support`, `testcontainers` (transitive through `@testcontainers/postgresql`)
- Constitution amended to 3.0.0: `application` layer, errors thrown instead of `Result`, ports in `application/interfaces.ts`, standard Nest error bodies, testing strategy per layer, code style
