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

- Before implementing any capability, the implementer MUST consult the official documentation
  of the framework in use, at the installed version, and MUST use the mechanism the framework
  documents for that capability.
- A custom implementation of a capability that the framework or its first-party modules
  already provide is prohibited. Custom code is permitted only where the documented mechanism
  does not cover the requirement; the plan states the gap in one sentence.
- Package selection is an engineering decision made in the plan; no separate research
  document, comparison table or inventory of chosen packages is produced.
- Rationale: framework-provided mechanisms are maintained, tested and understood by every
  engineer; re-implementing them increases the volume of owned code and the defect surface.

### III. Clean Architecture

- Each application is organised in concentric layers with a strict dependency rule: source
  code dependencies point inward only. Inner layers MUST NOT reference names, types or data
  formats declared in outer layers.
- API layers, from inner to outer: `domain` (enterprise business rules), `use-cases`
  (application business rules), `interface-adapters` (controllers, presenters, repositories,
  gateways, mappers) and `frameworks` (composition root, bootstrap, configuration,
  third-party SDK wiring).
- The `domain` layer is framework-free: plain TypeScript, no decorators, no imports from
  NestJS, Drizzle, SDKs or telemetry APIs.
- Coupling to frameworks is accepted outside the domain layer. Use cases MAY be NestJS
  providers; adapters use NestJS, Drizzle and vendor SDKs directly. Wrapper abstractions whose
  only purpose is to hide a framework are prohibited; the only abstractions are the ports
  that inner layers declare and outer layers implement.
- Data crossing a boundary is a simple data structure shaped for the inner layer. Domain
  entities and database rows MUST NOT cross boundaries outward or inward.
- Boundaries are enforced mechanically by lint in both applications; an allow-list of known
  violations MUST NOT exist.
- Rationale: business rules remain testable without UI, database or web server, while
  accepted framework coupling at the edges keeps the implementation small.

### IV. Domain-Driven Design, Simply Implemented

- The domain layer is designed with the tactical building blocks of Domain-Driven Design:
  entities, value objects, aggregates with a single root, domain services, domain events and
  one repository per aggregate root. Boundaries follow the business (bounded contexts and
  aggregates), never technical layers.
- The model is rich and always valid: behaviour and invariants live inside entities and
  aggregates; an invalid instance cannot be constructed; state changes occur only through
  methods named in the ubiquitous language.
- The model is pure: no I/O, persistence, clock or logging inside domain classes; external
  data and the current time are passed in as values.
- Implementation is the simplest that satisfies the principles: plain classes or readonly
  objects, no base-class hierarchies beyond identity and value equality, no generic
  repositories, no pattern introduced without a present need.
- Rationale: concentrated invariants cannot be bypassed; a pure, simple model is cheap to
  test and to change.

### V. Command–Query Separation (CQS)

- Every operation exposed by a use case is either a command, which changes state and returns
  at most an acknowledgement or the identifier of what it created, or a query, which returns
  data and has no observable side effect. An operation MUST NOT do both.
- Commands execute through the domain model and its repositories inside one transaction.
  Queries read through dedicated read adapters or repositories and return DTOs; they MUST NOT
  mutate state.
- No command bus, mediator, event-sourcing or separate read database is required by this
  principle. Use cases are invoked directly through dependency injection.
- Rationale: separating state changes from reads keeps writes under the domain model's
  invariants and keeps reads simple and side-effect free.

### VI. Verified by Tests

- Every behaviour is covered by the test type appropriate to its layer: domain logic by unit
  tests without test doubles; use cases, repositories and adapters by integration tests
  against a real PostgreSQL instance; HTTP endpoints by component tests through the HTTP
  layer; user journeys by a small end-to-end suite.
- Tests verify observable behaviour through public interfaces, never structure or internal
  interactions. Only unmanaged out-of-process dependencies (external services, brokers,
  email) MAY be replaced by test doubles behind the application's own ports. The database is
  never mocked.
- Tests are deterministic and isolated: no sleeps or delays; time is injected; data is
  self-provisioned; suites run in any order.
- Work is complete only when every suite (unit, integration, end-to-end) runs and passes and
  the evidence is presented; a failing or skipped test blocks completion.
- Rationale: the value of a test is its ability to catch regressions without false alarms;
  coupling tests to implementation details removes that value.

### VII. Security by Design

- Every change is designed and reviewed against the attack vectors listed in Verification and
  Security Requirements. Security controls are part of the specification and the acceptance
  criteria, not an afterthought.
- Deny by default: every API endpoint requires authentication and explicit authorisation;
  every input is validated against a schema at the boundary; every secret is externalised;
  every outbound call from user-defined automations is constrained.
- Static analysis, dependency audit and secret scanning are mandatory gates; a known high or
  critical vulnerability blocks merge.
- Rationale: the platform executes user-defined automations and holds user credentials; its
  threat surface demands controls that are verifiable, not assumed.

### VIII. Observability with OpenTelemetry

- OpenTelemetry is the single telemetry API for traces, metrics and logs in both
  applications. Only stable, actively maintained OpenTelemetry components and the official
  instrumentation of the frameworks in use are permitted.
- Telemetry is configured in the outermost layer of each application (`frameworks` in the
  API; the Next.js instrumentation hook in the web application) and relies on automatic
  instrumentation. Manual spans are added only where automatic instrumentation leaves a gap
  that matters for diagnosis, and only in interface adapters or infrastructure-level
  libraries; domain, use-case, module, feature and operation code contains no telemetry
  calls.
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
- Program flow is explicit: results are returned and passed on; interfaces exist only for
  ports and genuine polymorphism; dependencies are explicit constructor or method parameters.
- Dependency cycles between modules, tiers or classes are prohibited.
- Rationale: simplicity is the primary defence against defects and the primary enabler of
  change.

## API Rules (apps/api)

### Stack

NestJS (ESM, SWC), Drizzle ORM, PostgreSQL, Vitest, supertest, OpenTelemetry. Node and
TypeScript versions are pinned at the repository root.

### Layers and layout

```text
apps/api/src/
  domain/              entities, value objects, aggregates, domain services, domain events,
                       repository interfaces
  use-cases/           one interactor per use case (command or query), input and output
                       models, output ports for external services
  interface-adapters/  HTTP controllers and presenters, repositories and read adapters on
                       Drizzle, Drizzle schema and migrations, gateways to external services,
                       mappers
  frameworks/          NestJS modules (dependency assembly), bootstrap, configuration,
                       OpenTelemetry setup, third-party SDK initialisation
```

- Dependency direction: `frameworks` → `interface-adapters` → `use-cases` → `domain`. Layers
  are flat: no sub-folders per bounded context; context membership is expressed by the NestJS
  module that assembles the providers.
- NestJS modules are dependency-injection assemblies only. A module binds ports to adapters
  and registers controllers and use cases for one bounded context; it contains no logic and
  is not an architectural layer.
- All SQL, Drizzle usage and HTTP mapping are confined to `interface-adapters`. Use cases
  depend on ports; the domain depends on nothing.
- Nest CLI scaffolds MAY be used to generate files, which are then placed into this layout.
  Nest's own monorepo mode (`nest g app|library`) is prohibited.

### Domain layer

- Naming follows the ubiquitous language of the bounded context; core-domain classes carry no
  technical suffixes.
- Entities have a surrogate, immutable identity and identity-based equality. Value objects are
  immutable, compared by value, created through a factory that validates its input, and
  persisted inline in the owning entity's table.
- An aggregate is a consistency boundary with exactly one root. Child entities and value
  objects are created, modified and removed only through root methods; collections are
  exposed read-only; properties have no public setters. Aggregates are kept small and
  reference other aggregates by identifier only.
- Invariants are enforced in constructors and mutating methods; a mutation validates all
  inputs before changing any state. Invalid input yields a `Result` failure carrying a domain
  error code; an invariant violation inside the domain throws, because it is a defect.
- Domain services hold stateless rules that span aggregates. Domain events are immutable
  past-tense facts raised by aggregates and collected on the root.
- Repository interfaces are declared in `domain`, one per aggregate root, exposing only the
  operations commands need.

### Use cases

- A use case is one class with one public method. A command use case loads or creates the
  aggregate through its repository, invokes aggregate behaviour, persists through the
  repository and returns a `Result`; it contains no domain logic. A query use case returns
  DTOs through a read port.
- Input validation at the HTTP boundary is schema-based and executed before the use case;
  domain invariants are enforced by the aggregate regardless.
- Use cases MAY be NestJS providers. They MUST NOT import HTTP, Drizzle, SDK or telemetry
  types.

### Transactions and events

- One command equals one transaction, scoped to the request and opened by the mechanism the
  framework documents for transaction propagation.
- Domain events are dispatched in process after the aggregate is persisted and, by default,
  within the same transaction. Dispatching before commit is the default; eventual
  consistency requires an explicit decision in the plan.
- Effects that leave the process (email, webhooks, message brokers, notifications to other
  systems) are published through a transactional outbox so that a message is sent if and
  only if the transaction committed. Consumers are idempotent.
- Long-running or multi-step automations use the durable execution mechanisms documented by
  the framework; hand-written state machines over timers are prohibited.
- Concurrency control is optimistic through a version column on aggregate-root tables; a
  conflict is returned to the caller as HTTP 409 and is not retried automatically.
- Application-wide uniqueness is guaranteed by a database unique index; the adapter maps the
  specific constraint violation to a `Result` failure and rethrows everything else.

### HTTP interface

- Routes are versioned under `/api/v1`. Controllers are thin: they validate transport input,
  invoke one use case, and map the `Result` to an HTTP status and the single error envelope
  `{ code, message, details[] }`. All validation errors are returned at once.
- The OpenAPI document is generated from explicit DTO classes. Breaking changes follow
  parallel change: expand, migrate consumers, contract.
- Unexpected exceptions are handled only by the global exception filter, which logs them with
  the trace identifier and returns HTTP 500 without internal details.

### Testing

| Element | Test type | Constraints |
|---|---|---|
| Domain | Unit tests | Real domain objects, output or state verification, the aggregate is the unit |
| Use cases, repositories, read adapters | Integration tests | Real PostgreSQL; one happy path per use case plus edge cases unit tests cannot reach; assert by reading the database back |
| Controllers | Component tests | Whole application in process through HTTP; real database; test doubles only for unmanaged dependencies |
| Gateways to external services | Unit and gateway integration tests | Request building and response mapping; failure modes via a controllable stub |
| System | End-to-end | Few persona journeys, minutes-scale budget, self-provisioned data |

Tests are named as plain-English statements of fact with underscores and never include the
name of the method under test. Expected values are hard-coded facts, never recomputed with
the production algorithm. Production code contains no members or switches that exist only
for tests.

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
2. `pnpm test` (unit), the integration and component suites against a real PostgreSQL, and
   `pnpm test:e2e` pass with zero failures and zero skipped tests; `.only` and `.skip`
   markers are not committed.
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
- Every API endpoint requires an authenticated principal unless explicitly declared public in
  the specification. Authorisation is enforced in the use case for every object accessed
  (object-level) and every operation invoked (function-level); identifiers supplied by the
  client are never trusted as proof of access.
- The BFF holds the session in a secure, HttpOnly, SameSite cookie; access tokens never reach
  the browser. State-changing requests are protected against CSRF.

Input and output
- All input (HTTP bodies, query strings, headers, path parameters, webhook payloads,
  automation definitions) is validated against an explicit schema that rejects unknown
  fields; size limits and timeouts apply to every request.
- Database access uses parameterised queries only; string-built SQL is prohibited.
- Responses contain no stack traces, SQL, internal paths or secrets. The web application sets
  Content Security Policy, HSTS and the standard hardening headers and escapes all rendered
  user content.

Secrets and data
- Secrets are supplied only through the environment, never stored in the repository, logs,
  telemetry or error messages. User credentials used by automations are encrypted at rest and
  resolved only at execution time, scoped to the owning user.
- Transport is TLS everywhere. Database roles follow least privilege.

Automation execution
- User-defined automations run with explicit resource and time limits. Outbound HTTP from
  automations is restricted by an allow-list or by blocking private and link-local address
  ranges, with DNS resolution checked at connect time. Expression or script evaluation, where
  offered, executes in an isolated sandbox with no access to process state or secrets beyond
  its scope.

Supply chain
- The lockfile is committed; dependency install scripts are allowed per package only;
  dependencies are kept current, and a dependency with a known high or critical vulnerability
  blocks merge until updated or removed.

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

**Version**: 2.0.1 | **Ratified**: 2026-10-04 | **Last Amended**: 2026-10-04
