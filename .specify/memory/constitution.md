<!--
Sync Impact Report
- Version change: 3.0.1 → 3.1.0 (MINOR: materially expanded guidance)
- Modified sections: Verification and Security Requirements › Input and output (data users feed
  into their automations is opaque, accepted within size and nesting-depth limits, with the
  envelope still schema-validated); › Automation execution (scripts run in a sandbox process;
  expressions run in a non-executing, allow-listed, bounded interpreter, which is the expression
  sandbox)
- Added sections: none
- Removed sections: none
- Templates: .specify/templates/plan-template.md ✅, spec-template.md ✅, tasks-template.md ✅,
  checklist-template.md ✅ (no references to input schemas or sandboxes)
- Follow-up TODOs: none
-->

# Workflow Platform Constitution

## Core Principles

### I. Strict Separation of Web and API (NON-NEGOTIABLE)

- `apps/web` and `apps/api` are independent applications with disjoint codebases. No source
  file, workspace package, type, schema, utility or test helper MAY be shared between them.
- The sole contract between the applications is the API's versioned HTTP interface, described
  by the OpenAPI document that the API publishes. The web application owns its own client
  types and generates or writes them inside its own tree.
- Business rules, persistence and integration with external systems reside exclusively in the
  API. The Next.js server is a Backend for Frontend: it composes and reshapes API responses
  for rendering and holds the user session; it MUST NOT implement business rules or access
  data stores.
- Rationale: shared code between a UI and its API is a hidden coupling. Independent
  codebases keep the contract explicit and let the applications evolve and deploy separately.

### II. Documentation-First Implementation

- Before implementing any capability, the implementer MUST read the official documentation
  of the framework in use, at the installed version, in full for that capability, and MUST
  use the mechanism the framework documents.
- First-party modules of the framework take precedence over third-party packages and over
  custom code. A custom implementation of a capability that the framework or its first-party
  modules provide is prohibited; custom code is permitted only where the documented mechanism
  does not cover the requirement, and the plan states the gap in one sentence.
- Deprecated APIs of the runtime, the framework or a library MUST NOT be used.
- Rationale: framework-provided mechanisms are maintained, tested and understood by every
  engineer; re-implementing them increases the volume of owned code and the defect surface.

### III. Clean Architecture

- Each application is organised in concentric layers with a strict dependency rule: source
  code dependencies point inward only. Inner layers MUST NOT reference names, types or data
  formats declared in outer layers.
- API layers, from inner to outer: `domain` (enterprise business rules), `application`
  (use cases and authorization policies), `interface-adapters` (controllers, presenters,
  repositories, queries, gateways, mappers, framework extension points) and `frameworks`
  (dependency assembly, bootstrap, configuration, technology clients).
- `domain` and `application` are framework-free: plain TypeScript classes with no imports
  from NestJS, Drizzle, SDKs or telemetry APIs. The single exception is the `@Policy()`
  marker of `@nestjs/authorization` on policy classes.
- Every abstraction that crosses a layer boundary is declared in the `interfaces.ts` of the
  inner layer as an abstract class, which outer layers implement and which serves as the
  injection token. Wrapper abstractions whose only purpose is to hide a framework are
  prohibited.
- Data crossing a boundary inward is a plain command or query object. A use case returns the
  entity or the read-model rows it worked with; presenters in `interface-adapters` map them
  into responses. Database rows never cross into `application`.
- Boundaries are enforced mechanically by lint in both applications; an allow-list of known
  violations MUST NOT exist.
- Rationale: business rules remain testable without UI, database or web server, while
  accepted framework coupling at the edges keeps the implementation small.

### IV. Domain-Driven Design, Simply Implemented

- The domain layer is designed with the tactical building blocks of Domain-Driven Design:
  entities, value objects, aggregates with a single root and domain errors. Boundaries follow
  the business (bounded contexts and aggregates), never technical layers.
- The model is rich and always valid: behaviour and invariants live inside entities and
  aggregates; state changes occur only through methods named in the ubiquitous language; a
  rule violation throws a domain error.
- Entities state facts (`isAdmin`, `suspended`); access decisions belong to policies in
  `application`.
- The model is pure: no I/O, persistence, logging or framework inside domain classes. Reading
  the current time and generating identifiers or secrets with the Node runtime is permitted.
- Implementation is the simplest that satisfies the principles: plain classes, no base-class
  hierarchies, no generic repositories, no pattern introduced without a present need.
- Rationale: concentrated invariants cannot be bypassed; a pure, simple model is cheap to
  test and to change.

### V. Command–Query Separation (CQS)

- Every operation exposed by a use case is either a command, which changes state, or a
  query, which returns data and has no observable side effect. An operation MUST NOT do both.
- Commands load aggregates through repositories, invoke aggregate behaviour and persist
  through repositories inside one transaction. Queries read raw rows through query
  abstractions whose filtering, ordering and aggregation happen in SQL; they MUST NOT load
  aggregates or filter in memory.
- No command bus, mediator, event sourcing or separate read database is required by this
  principle. Use cases are invoked directly through dependency injection.
- Rationale: separating state changes from reads keeps writes under the domain model's
  invariants and keeps reads simple and side-effect free.

### VI. Verified by Tests

- Tests follow the microservice testing strategy: sociable unit tests for the domain,
  solitary unit tests for use cases and policies, integration tests for persistence and
  outbound adapters, in-process component tests for the HTTP interface, and a small
  end-to-end suite of persona journeys. The pyramid is wide at the bottom; a behaviour is
  tested at the lowest level that can observe it and not repeated above.
- Tests verify observable behaviour through public interfaces, never structure or internal
  interactions: state and output assertions, no interaction verification on mocks, no
  recomputation of expected values with the production algorithm.
- Only unmanaged out-of-process dependencies (SMTP, external services) are replaced by test
  doubles, behind the application's own ports or the framework's documented test transport.
  The database is never mocked.
- Tests are deterministic and isolated: no fixed delays; a wait is a bounded poll on
  observable state; data is self-provisioned; suites run in any order.
- Work is complete only when every suite runs and passes and the evidence is presented; a
  failing or skipped test blocks completion.
- Rationale: the value of a test is its ability to catch regressions without false alarms;
  coupling tests to implementation details removes that value.

### VII. Security by Design

- Every change is designed and reviewed against the attack vectors listed in Verification and
  Security Requirements. Security controls are part of the specification and the acceptance
  criteria, not an afterthought.
- Deny by default: every API endpoint declares its access (public, any signed-in user, or a
  policy); every input is validated against a schema at the boundary; every secret is
  externalised; every outbound call from user-defined automations is constrained.
- Static analysis, dependency audit and secret scanning are mandatory gates; a known high or
  critical vulnerability blocks merge.
- Rationale: the platform executes user-defined automations and holds user credentials; its
  threat surface demands controls that are verifiable, not assumed.

### VIII. Observability with OpenTelemetry

- OpenTelemetry is the single telemetry API for traces, metrics and logs in both
  applications. Only stable, actively maintained OpenTelemetry components and the official
  instrumentation of the frameworks in use are permitted.
- Telemetry is configured in the outermost layer of each application (`instrumentation.ts`
  preloaded with `--import` in the API; the Next.js instrumentation hook in the web
  application), configured only through `OTEL_*` variables, and relies on automatic
  instrumentation. Manual spans are added only where automatic instrumentation leaves a gap
  that matters for diagnosis, and only in interface adapters; domain, application, module,
  feature and operation code contains no telemetry calls.
- Trace context is propagated from browser to BFF to API using the W3C Trace Context
  standard; every log record carries the trace and span identifiers.
- Telemetry attributes and log records MUST NOT contain secrets, credentials, tokens or
  personal data beyond identifiers.
- Rationale: one standard, applied at the edges, yields correlated signals without polluting
  business code or breaching layer boundaries.

### IX. Simplicity

- The simplest correct implementation is the required implementation. Layers, abstractions,
  patterns and packages are introduced only when a rule of this constitution or a present
  requirement demands them, and each such addition is justified in the plan's Complexity
  Tracking table.
- Program flow is explicit and linear: results are returned and passed on; interfaces exist
  only for ports and genuine polymorphism; dependencies are explicit constructor parameters.
- Dependency cycles between modules, tiers or classes are prohibited.
- Rationale: simplicity is the primary defence against defects and the primary enabler of
  change.

## API Rules (apps/api)

### Stack

NestJS 12 (ESM, SWC) with its first-party modules `@nestjs/authentication`,
`@nestjs/authorization`, `@nestjs/mail`, `@nestjs/outbox`,
`@nestjs/terminus`, `@nestjs/config` and `@nestjs/swagger`; `nestjs-cls` with
`@nestjs-cls/transactional` for transaction propagation; Drizzle ORM over `pg` on PostgreSQL;
`zod` for the environment schema; `nestjs-pino` logging; the OpenTelemetry Node SDK with
auto-instrumentations; Vitest, supertest and Testcontainers for tests. Versions are pinned
exactly; Node and pnpm are pinned at the repository root.

### Layers and layout

```text
apps/api/src/
  main.ts              bootstrap
  instrumentation.ts   OpenTelemetry Node SDK, preloaded with --import
  domain/              entities, value objects, errors.ts, interfaces.ts (props and types)
  application/         use-cases/ (one interactor per command or query), policies/
                       (authorization policies), interfaces.ts (commands, outputs, ports)
  interface-adapters/  http/ (controllers, dto, presenters, filters, middleware),
                       auth/ (framework extension points and stores of the authentication
                       module), mailing/ (gateway, outbox transport, handler, templates),
                       persistence/ (repositories, mappers, queries, schema),
                       interfaces.ts (what frameworks provide)
  frameworks/          di/ (NestJS modules: dependency assembly only) and one folder per
                       technology with its factory function
```

- Dependency direction: `frameworks` → `interface-adapters` → `application` → `domain`.
  Layers are flat: no sub-folders per bounded context; context membership is expressed by the
  NestJS module that assembles the providers.
- NestJS modules are dependency-injection assemblies only. A module binds ports to adapters
  and registers controllers and use cases for one bounded context; it contains no logic and
  is not an architectural layer. Use cases are assembled by factory providers.
- All SQL, Drizzle usage and HTTP mapping are confined to `interface-adapters`. Adapters are
  grouped by what they adapt (inbound and outbound together), not by direction.
- Nest CLI scaffolds MAY be used to generate files, which are then placed into this layout.
  Nest's own monorepo mode (`nest g app|library`) is prohibited.

### Domain layer

- Naming follows the ubiquitous language of the bounded context; core-domain classes carry no
  technical suffixes.
- Entities have `#private` fields, getters, a public constructor taking the props declared in
  `interfaces.ts` (used by mappers to reconstitute) and a static factory returning the
  entity. Properties have no setters; state changes go through behaviour methods.
- Secrets handed to users (link tokens) are value objects that generate the value and derive
  its fingerprint; the entity keeps only the fingerprint.
- Aggregates are kept small, reference other aggregates by identifier and carry the
  `version` used by the repository for optimistic concurrency; they contain no persistence
  logic.
- Validation constants of the transport (lengths, formats) live in the request models, not
  in the domain.

### Application layer

- A use case is one class with one `execute` method and a linear body: load through a
  repository, invoke entity behaviour, persist, return the entity or nothing. Rule violations
  are domain errors thrown by the entity, the use case or the repository; use cases contain
  no `try`/`catch`, no framework imports and no transport concerns.
- Recurring conditions on stored data are repository query methods (for example
  `findActiveById`), not conditions repeated in use cases or adapters.
- Authorization policies are plain classes in `application/policies` marked with
  `@Policy()`; they decide on facts exposed by entities and are declared on routes with
  `@Can`. Routes open to every signed-in user declare `@Can.Anyone()`; anonymous routes
  declare `@Public()`.
- Output ports (repositories, queries, hasher, mailing) are abstract classes in
  `application/interfaces.ts`; the framework's own services (session issue, password reset
  tokens) are used from adapters, not re-declared as ports.

### Transactions and outbound effects

- One command equals one transaction, opened at the controller with `@Transactional()` and
  propagated by `nestjs-cls`; repositories write through `TransactionHost.tx`.
- Effects that leave the process (email, webhooks, notifications) are written to the
  `@nestjs/outbox` store in the same transaction and delivered by its relay, so a message is
  sent if and only if the transaction committed. Handlers are idempotent; permanent failures
  go to the dead letter table.
- Concurrency control is optimistic through the `version` column on aggregate-root tables; a
  stale update is a domain conflict error (HTTP 409) and is not retried automatically.
- Application-wide uniqueness is guaranteed by a database unique index.

### HTTP interface

- Routes are versioned under `/api/v1`. Controllers are thin: they validate transport input
  with explicit DTO classes (`ValidationPipe` with whitelist, forbid-non-whitelisted and
  transform; all validation errors returned at once), invoke one use case and return the
  presenter's response model.
- Errors are standard Nest `HttpException` bodies: `DomainErrorFilter` maps each domain error
  class to an HTTP exception; no custom error envelope exists.
- Health checks (`@nestjs/terminus`) report process liveness only and never query the
  database; shutdown is graceful through Terminus and `enableShutdownHooks()`.
- The OpenAPI document is generated from the DTO classes. Breaking changes follow parallel
  change: expand, migrate consumers, contract.

### Code style

- No comments in code; names carry the meaning. Names reveal the abstraction type
  (`…Repository`, `…Queries`, `…Gateway`, `…Presenter`, `…Handler`, `…Mail`).
- Readability over compactness: an awaited call is assigned to a named variable before it is
  used in a condition or as an argument; it is never inlined.
- A guard clause (`if (…) throw …`, `if (…) return …`) is separated from the surrounding
  statements by blank lines so that every point where execution can stop is visible.
- No tiny private helpers without repetition; no `Symbol` injection tokens; no `let` or
  `null` checks where a repository query method can carry the condition.

### Testing

| Layer                                      | Test type                   | Location and constraints                                                                                                                                                 |
| ------------------------------------------ | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Domain                                     | Sociable unit tests         | `test/unit/domain`: real entities and value objects, no doubles, state and output assertions, hard-coded expected values                                                 |
| Use cases, policies                        | Solitary unit tests         | `test/unit/application`: in-memory fakes of the ports from `test/support`, state verification through the fakes, no interaction assertions                               |
| Mail templates                             | Unit tests                  | `test/unit/mailing`: rendered content                                                                                                                                    |
| Repositories, queries, stores, migrations  | Persistence integration     | `test/integration/persistence`: real PostgreSQL (Testcontainers); round trips, SQL filtering, optimistic concurrency, constraints, seed migrations                        |
| Outbox transport and handler               | Integration                 | `test/integration/mailing`: rollback and commit semantics, relay delivery, retry on failure, with the framework's in-memory mail transport in place of SMTP               |
| Controllers, guards, filters, policies     | Component tests             | `test/component`: the whole application in process through HTTP (supertest), real database, SMTP replaced by the in-memory transport, relay driven explicitly            |
| System                                     | End-to-end                  | `test/e2e`: few persona journeys against the Compose stack and the built image, self-provisioned data, minutes-scale budget                                              |
| Consumers of the API                       | Consumer-driven contracts   | Added when a consumer exists; the OpenAPI document is the contract until then                                                                                            |

Tests are named as plain-English statements of fact with underscores and never include the
name of the method under test. Production code contains no members or switches that exist
only for tests. Unit test commands: `pnpm --filter api test`; persistence, mailing and
component suites: `pnpm --filter api test:int`; journeys: `pnpm --filter api test:e2e`.

## Web Rules (apps/web)

### Stack

Next.js (App Router), React, Tailwind CSS, Vitest with Testing Library, Cypress,
OpenTelemetry through the Next.js instrumentation hook.

### Element types

The web application is built from five tiers of elements: entries (pages and layouts),
modules, features, operations and libs. `data-access` is a lib. Every element has an owner
recorded in `CODEOWNERS`.

```text
apps/web/src/
  app/                        entries: page.tsx and layout.tsx route files
  spaces/<space>/
    modules/<module>/         page-specific logic and composition
    __shared_context/         context shared by the modules of one space
    e2e/                      Cypress specs of the space
  features/<feature>/         business-level UI and logic, with playground and tests
  operations/<operation>/     business-level logic and data processing, no JSX
  libs/<lib>/                 infrastructure-level tools, including data-access
```

### Dependency graph

- Imports are strictly unidirectional: a higher tier MAY import a lower tier, never the
  reverse. Skipping tiers is permitted (a module MAY import a lib directly).
- Cross imports within one tier are prohibited, with exactly three exceptions: modules of the
  same space MAY share through `__shared_context`; libs MAY import each other; a
  "composites" operations group MAY import from specific other operations groups only after an
  amendment defines it.
- Several elements of the same tier are combined by composing them in the higher-tier
  element (for example two features inside a module), never by importing one from the other.
- The tier graph is enforced by lint with no allow-listed violations.

### Application layers

The functional composition is UI, Logic and Data; the level of abstraction is Domain,
Business and Infrastructure.

| Level | Meaning | Elements |
|---|---|---|
| Domain | The current user experience: code specific to one page or a set of related pages | Modules (span UI, Logic and Data) |
| Business | Functionality repeated across domains that reflects business flows | Features (UI and Logic), operations (Logic and Data) |
| Infrastructure | Business-agnostic foundations used everywhere | Design system (UI), libs (Logic), data-access (Data) |

### Page (entry)

- A page defines a Next.js sub-application mapped to a route: `page.tsx` references exactly
  one module, declares its metadata and performs the server-side preparation that the BFF
  needs; the layout reference is given by the route hierarchy.
- All logic is offloaded to the module; the page is a rendering instruction.
- A page has an owner.

### Layout (entry)

- A layout (`layout.tsx`) builds the bundle shared by several pages and references a layout
  module that composes header, footer and other common items.
- All logic is offloaded to the module; the layout is a rendering instruction.
- A layout has an owner.

### Module

- A module is the main container of page-specific logic and the composition of lower-tier
  elements: a skeleton of features and operations arranged for the context of its domain.
  Modules isolate one domain from the others, limiting the blast radius of change.
- Modules are stored in spaces. A space contains one or more modules and, in the latter case,
  shares context between them; the space also groups its end-to-end tests and TypeScript
  and ESLint configuration.
- A module has an owner.

### Feature

- A feature is a composition of UI and logic repeated across domains, abstracted to the
  business level. Features are widely shared and therefore strictly governed.
- A feature has an owner; creating a feature requires an approved specification; a feature
  has a Playground and a Cypress test (a smoke test is the minimum); a feature has
  comprehensive test coverage.

### Operation

- An operation is a concise, focused piece of repetitive logic or data processing abstracted
  to the business level. Operations do not deal with UI.
- An operation has an owner; creating an operation requires an approved specification; an
  operation has a Playground; an operation has at least 75% test coverage; an operation MUST
  NOT contain JSX.

### Lib

- Libs are fundamental, business-agnostic tools at the infrastructure level, each focused on
  one task. `data-access` is the only lib that communicates with the API's HTTP interface.
- Libs are owned by the web-foundation role; creating a lib requires an approved
  specification; creating or modifying a lib requires web-foundation approval; a lib has
  comprehensive test coverage and MUST NOT contain business logic.

### Composition patterns

- To vary a shared element per variant (brand, tenant, market), expose an optional slot on
  the shared feature and let the consuming module decide through configuration what to
  inject; the shared feature does not import the variant feature.
- Behaviour required by some pages, not all, is plugged into those pages, not into the
  layout; layouts stay independent of unrelated logic.
- A variant-specific experience is a separate page with its own module that reuses the shared
  features and adds custom parts; code is variant-agnostic by default, and variant-specific
  code is guarded by configuration.
- Functionality is protected against regressions by test coverage at pull-request level, not
  by structural isolation.
- No application-wide state container exists; shared state logic is an operation, shared UI
  is a feature.

### Backend for Frontend

- Server components, route handlers, server actions and middleware MAY call the API through
  `data-access`, compose several API calls for one view, reshape responses into view models,
  hold the user session and forward the access token, and configure caching and
  revalidation.
- They MUST NOT implement business rules or domain validation (UX-level validation only),
  access databases, brokers or other backend resources, import anything from `apps/api`, or
  expose an API for third parties.
- The browser communicates only with the Next.js server; the API is reached only from the
  BFF. The client follows Postel's law and ignores unknown fields.

### Testing

- Components, hooks and modules are tested with Vitest and Testing Library through
  user-visible behaviour. Features, operations and libs meet the coverage rules of their
  tier. Each feature has a Cypress smoke test. Pages and route handlers are tested with the
  API stubbed at the HTTP boundary.

## Verification and Security Requirements

### Definition of done

A change is complete only when all of the following have been executed and their output
presented as evidence:

1. `pnpm lint` and `pnpm check-types` pass with no warnings suppressed.
2. `pnpm --filter api test`, `pnpm --filter api test:int` (persistence, mailing and
   component suites on a real PostgreSQL) and `pnpm --filter api test:e2e` pass with zero
   failures and zero skipped tests; `.only` and `.skip` markers are not committed.
3. The security gates below pass.
4. The OpenAPI document and affected documentation are regenerated or updated.

### Security requirements

Scope: both applications, the automations the platform executes on behalf of users, and the
credentials it stores. Threat model baseline: injection, broken authentication and session
management, broken object- and function-level authorisation, cross-site scripting,
cross-site request forgery, server-side request forgery, mass assignment, insecure
deserialisation, race conditions, denial of service, information leakage, supply-chain
compromise and secret exposure.

Authentication and authorisation
- Every API endpoint declares its access: `@Public()`, `@Can.Anyone()` or a policy with
  `@Can`; a route without a declaration is denied. Object-level rules are policy decisions
  on the aggregate; identifiers supplied by the client are never trusted as proof of access.
- Sessions are HttpOnly, SameSite cookies issued by `@nestjs/authentication`; state-changing
  requests are protected against CSRF by the origin check; link secrets are stored only as
  fingerprints; anonymous endpoints that reveal account existence answer identically and are
  rate limited by the API gateway; the applications contain no rate limiter.

Input and output
- All input (HTTP bodies, query strings, headers, path parameters, webhook payloads,
  automation definitions) is validated against an explicit schema that rejects unknown
  fields; size limits and timeouts apply to every request.
- Data that users feed into their own automations (webhook and resume call bodies, trigger
  items, pinned sample items) is opaque to the platform: it is accepted only as well-formed
  JSON, or as text where the trigger allows it, within size and nesting-depth limits, and it
  is never interpreted as platform configuration. The envelope around it (route, headers,
  identifiers, parameters) is still validated against an explicit schema.
- Database access uses parameterised queries only; string-built SQL is prohibited.
- Responses contain no stack traces, SQL, internal paths or secrets. The API sets the
  hardening headers and no server banner; the web application sets Content Security Policy,
  HSTS and the standard hardening headers and escapes all rendered user content.

Secrets and data
- Secrets are supplied only through the environment, never stored in the repository, logs,
  telemetry or error messages. User credentials used by automations are encrypted at rest and
  resolved only at execution time, scoped to the owning user.
- Transport is TLS everywhere. Database roles follow least privilege.

Automation execution
- User-defined automations run with explicit resource and time limits. Outbound HTTP from
  automations is restricted by an allow-list or by blocking private and link-local address
  ranges, with DNS resolution checked at connect time.
- Scripts written by users execute in an isolated sandbox process with no access to process
  state or secrets beyond their scope.
- Expressions in automation parameters are evaluated by an interpreter that executes no host
  code (no `eval`, `Function` or `vm`), reaches only allow-listed operations on copies of the
  data, and is bounded in time and result size; such an interpreter is the expression
  sandbox.

Supply chain
- The lockfile is committed; dependency install scripts are allowed per package only;
  dependencies are kept current, every declared dependency is used, and a dependency with a
  known high or critical vulnerability blocks merge until updated or removed.

### Security gates

- Static analysis (type-aware lint with security rules) and secret scanning run on every pull
  request; dependency audit runs on every pull request and on a schedule.
- Every pull request includes a review of the attack vectors above for the code it touches;
  findings are fixed before merge.

## Governance

- This constitution supersedes README files, `AGENTS.md` and informal conventions where they
  conflict. READMEs describe how to run the applications; this document defines what is
  permitted.
- Amendments are made by pull request to this file with a Sync Impact Report, a semantic
  version bump and an updated "Last Amended" date. MAJOR: a principle is removed or
  redefined, or governance changes incompatibly; MINOR: a principle or section is added or
  materially expanded; PATCH: clarification or wording. Dependent templates in
  `.specify/templates` are checked on every amendment.
- Compliance is verified at the `/speckit-plan` Constitution Check gate (before research and
  after design) and at pull-request review. The gate confirms: separation of web and API (I);
  documented framework mechanism used (II); layer placement and dependency direction (III);
  bounded context, aggregates and invariants named (IV); each operation classified as command
  or query (V); test types per layer planned (VI); attack vectors reviewed (VII); telemetry
  confined to the outer layer (VIII); every added abstraction justified (IX).
- A deviation is accepted only with a Complexity Tracking entry approved by a maintainer, or
  through an amendment.
- Runtime guidance for engineers and agents: this file first, then `README.md` and
  `apps/*/README.md` for commands and local setup.

**Version**: 3.1.0 | **Ratified**: 2026-10-04 | **Last Amended**: 2026-10-12
