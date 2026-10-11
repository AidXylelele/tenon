# Feature Specification: API Authentication

**Feature Branch**: `001-api-authentication`

**Created**: 2026-10-05

**Status**: Draft

**Input**: User description: "Authentication in the application: email and password sign-in, password recovery, invitations via links. Better Auth, strictly per the constitution and Clean Architecture. API only; web is out of scope. Production Dockerfile for the API and a docker compose setup for local testing with persistent volumes, all required infrastructure, and no collisions with other projects. Secure, vulnerability-free base image and dependencies; exact version pinning. Tests per Martin Fowler's microservice testing guidance, covering business rules and edge cases per layer."

## Clarifications

### Session 2026-10-05

- Q: What throttling policy applies to failed sign-in attempts and password-recovery requests? → A: Address-only limit: 20 failed attempts per client address per 10 minutes, applied separately to sign-in and to recovery requests; no per-email tracking and no account lockout; provided by the authentication provider's built-in rate limiting, no custom limiter.
- Q: Should a signed-in user be able to change their own password by entering the current password? → A: Yes: the change requires the current password, applies the password policy, ends all other sessions of the user, and uses the authentication provider's built-in flow.
- Q: Where are security events kept? → A: Application logs only: structured records with event type, user id and client address, searched in the central logging service; no audit table and no in-product event history.
- Q: How does the platform send email in production? → A: SMTP: host, port, credentials and sender address come from configuration; the local environment runs an SMTP capture service with a web inbox.
- Planning adjustment (native mechanisms only): the rate limiter counts requests, not failed attempts, so the limit is 20 requests per client address per 10 minutes per endpoint; the "password must not equal the email address" rule is dropped because the provider has no native hook for it; the operator command is replaced by a database seed migration and the first password is set through recovery (the provider creates the credential on completion); a newer recovery link does not invalidate earlier unexpired links because the provider keeps each token until its own expiry; recovery-link secrets are stored as the provider issues them, so FR-020 applies to invitation links.

### Session 2026-10-12

- Q: Where are request rates on sign-in and recovery limited? → A: At the API gateway (Envoy Gateway, delivered with the platform's Helm chart), like every public route; the API contains no rate limiter. This supersedes the throttling answer of 2026-10-05 and the rate-limiter part of its planning adjustment.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Sign in with email and password (Priority: P1)

A registered user opens the platform, enters the email address and password, and gains access to the platform under their assigned role. The user stays signed in across requests until the session expires or the user signs out.

**Why this priority**: Without sign-in nothing else in the platform is reachable; the bootstrap administrator can use the platform with this story alone.

**Independent Test**: Apply the migrations, set the seeded administrator's password through recovery, sign in with the correct password, call a protected endpoint, sign out, and confirm the endpoint is no longer accessible.

**Acceptance Scenarios**:

1. **Given** an active user with a known password, **When** the user submits the correct email and password, **Then** a session is established and protected operations succeed under the user's role.
2. **Given** an active user, **When** the user submits a wrong password, **Then** access is refused and the response does not reveal whether the email is registered.
3. **Given** no user with the submitted email, **When** sign-in is attempted, **Then** the response is identical to a wrong-password response.
4. **Given** a signed-in user, **When** the user signs out, **Then** the session is ended and subsequent requests with it are refused.
5. **Given** a suspended user, **When** the user submits correct credentials, **Then** access is refused with a suspension message.
6. **Given** many sign-in requests from one client address, **When** they exceed the rate the API gateway allows, **Then** the gateway refuses them before they reach the API, and requests from other addresses are unaffected (FR-017).

---

### User Story 2 - Invite a user by link (Priority: P2)

An administrator invites a new person by entering their email address and choosing a role. The platform creates a single-use invitation link and sends it by email. The invited person opens the link, enters a name and a password, and is signed in with the assigned role. Administrators see pending invitations and can revoke them.

**Why this priority**: Self-registration is disabled; invitations are the only way to add users after the bootstrap administrator.

**Independent Test**: As an administrator, create an invitation for a new email with role `editor`; open the link from the email, set name and password; confirm the new user is signed in as `editor`; confirm the link cannot be used again.

**Acceptance Scenarios**:

1. **Given** an administrator, **When** an invitation is created for an email that has no account, **Then** a pending invitation with the chosen role exists and an email with the link is sent.
2. **Given** a pending invitation, **When** the invited person opens the link and submits a valid name and password, **Then** an active account with the invitation's role is created, the invitation is marked accepted, and the person is signed in.
3. **Given** an accepted, revoked or expired invitation, **When** its link is opened, **Then** the platform refuses it and states the reason category (used, revoked, expired).
4. **Given** an email that already belongs to an account, **When** an administrator tries to invite it, **Then** the invitation is refused.
5. **Given** a pending invitation for an email, **When** a new invitation is created for the same email, **Then** the previous invitation is revoked and only the new link works.
6. **Given** a pending invitation, **When** an administrator revokes it, **Then** its link stops working.
7. **Given** a non-administrator user, **When** the user tries to create, list or revoke invitations, **Then** the operation is refused.

---

### User Story 3 - Recover a forgotten password (Priority: P3)

A user who forgot the password requests recovery by email. If an account exists, the platform sends a single-use link valid for a limited time. The user opens the link, sets a new password, and all other sessions of the user are ended.

**Why this priority**: Users locked out of their accounts need a self-service path; until then an administrator can re-invite them.

**Independent Test**: Request recovery for an existing email, open the link from the captured email, set a new password, sign in with it, and confirm the old password and the link no longer work.

**Acceptance Scenarios**:

1. **Given** an active account, **When** recovery is requested for its email, **Then** a recovery email with a single-use link is sent and the response is a generic confirmation.
2. **Given** no account for the email, **When** recovery is requested, **Then** the response is the same generic confirmation and no email is sent.
3. **Given** a valid recovery link, **When** the user submits a password that meets the policy, **Then** the password is replaced, the link is invalidated, and every other session of the user is ended.
4. **Given** an expired or already used recovery link, **When** it is opened, **Then** the platform refuses it.
5. **Given** two recovery requests for the same account, **When** both links are issued, **Then** issuing the newer link does not invalidate the earlier one, and once either link sets a new password the other is refused (FR-014).
6. **Given** many recovery requests from one client address, **When** they exceed the rate the API gateway allows, **Then** the gateway refuses them before they reach the API (FR-017).

---

### User Story 4 - Change own password (Priority: P4)

A signed-in user changes the password by entering the current password and a new one. After the change every other session of the user is ended; the caller stays signed in with a newly issued session.

**Why this priority**: Routine hygiene for signed-in users; until then the recovery flow covers password changes.

**Independent Test**: Sign in, change the password with the correct current password, confirm the old password no longer works and the new one does, and confirm a second session opened before the change is ended.

**Acceptance Scenarios**:

1. **Given** a signed-in user, **When** the user submits the correct current password and a new password that meets the policy, **Then** the password is replaced, the caller stays signed in with a new session, and every other session of the user is ended.
2. **Given** a signed-in user, **When** the user submits a wrong current password, **Then** the change is refused and the password is unchanged.
3. **Given** a signed-in user, **When** the new password violates the policy, **Then** the change is refused with the policy explained.
4. **Given** a request without a valid session, **When** a password change is attempted, **Then** it is refused.

---

### Edge Cases

- Email addresses differ only by letter case: treated as the same address.
- Password shorter than the minimum or longer than the maximum: refused with the policy explained.
- Invitation accepted exactly at its expiry moment: refused (expiry is exclusive).
- Invitation link opened by a signed-in user: the existing session is ended before the new account is created.
- Email delivery fails when creating an invitation: the invitation still exists; delivery is retried automatically from the outbox, a final failure is logged, and the administrator can issue a new invitation, which replaces the pending one.
- Email delivery fails when requesting recovery: the response stays generic; delivery is retried automatically and a final failure is logged.
- Recovery requested for a suspended account: no email is sent; the response stays generic.
- Session used after the user's password was reset elsewhere: refused.
- Session reaches its lifetime: refused; the user signs in again.
- The seed migration runs on a database that already has an administrator: no second administrator is created.
- Recovery link issued before the account was suspended and used afterwards: the completion is refused like an invalid link.
- Recovery requested for an email that has only a pending invitation and no account: no email is sent; the response stays generic; the invitation is unaffected.
- Two simultaneous acceptances of one invitation: exactly one creates the account; the other is refused.
- Revoking an accepted invitation: refused as already used; the account is unaffected.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: Users MUST be able to sign in with an email address and password and sign out.
- **FR-002**: A session MUST remain valid for 7 days of inactivity and MUST be extended on use, up to an absolute lifetime of 30 days from sign-in; sign-out MUST end the current session.
- **FR-003**: Sign-in responses MUST NOT disclose whether an email address is registered; wrong-password and unknown-email outcomes MUST be indistinguishable.
- **FR-004**: Suspended users MUST be refused sign-in and MUST hold no valid session once suspended; the act of suspending is outside this feature (the `suspended` flag of the user record); no administration interface is part of this feature
- **FR-005**: Self-service registration MUST be disabled; accounts MUST be created only through invitations; the first administrator is created by the database seed migration.
- **FR-006**: The database seed migration MUST create the first administrator (configurable email, default `admin@example.com`, role `admin`, verified email, no password) only when no administrator exists; the administrator sets the first password through password recovery.
- **FR-007**: An invitation MUST be creatable for an email address with one role from `admin`, `editor`, `viewer`; the platform MUST send the invitation link by email.
- **FR-008**: An invitation MUST be single-use, MUST expire 7 days after creation, and MUST be refused when accepted, revoked or expired.
- **FR-009**: Creating an invitation for an email that already has an account MUST be refused; creating one for an email with a pending invitation MUST revoke the pending one.
- **FR-010**: Pending invitations MUST be listable and revocable.
- **FR-011**: Accepting an invitation MUST require a name and a password, MUST create an active account with the invitation's role, MUST mark the invitation accepted, and MUST sign the person in.
- **FR-012**: Only administrators MUST be able to create, list or revoke invitations (FR-007, FR-010); the restriction MUST be an authorization policy declared on each of these operations (deny by default), not inferred from the route path or from the client hiding the action.
- **FR-013**: Users MUST be able to request password recovery by email; the response MUST be a generic confirmation regardless of whether an account exists.
- **FR-014**: A recovery link MUST be single-use and MUST expire 1 hour after issue; several unexpired links MAY exist for one account, and a link issued before the password changed is refused.
- **FR-015**: Completing recovery MUST replace the password, invalidate the link, and end every other session of the user.
- **FR-016**: Passwords MUST be 12 to 128 characters; the policy MUST apply to invitation acceptance, recovery and password change.
- **FR-017**: Request rates on sign-in and recovery MUST be limited per client address by the API gateway (Envoy Gateway, delivered with the platform's Helm chart), as on every public route; the API itself contains no rate limiter. There MUST be no per-email counting and no account lockout.
- **FR-018**: Email addresses MUST be compared case-insensitively.
- **FR-019** (deferred, design review 2026-10-11: no application-level security event log in this iteration; request logs only): The platform MUST record security events (sign-in success and failure, sign-out, password change success and failure, invitation created, accepted, revoked, recovery requested and completed, suspension) as structured application log records carrying the event type, user id and client address, without passwords, links or tokens; no audit table or in-product event history is kept.
- **FR-020**: Secrets embedded in invitation links MUST be stored only in a form that does not allow the link to be reconstructed from stored data; recovery-link secrets are stored the same way (SHA-256 of the token)
- **FR-021**: Signed-in users MUST be able to change their own password by providing the current password and a new password that meets the policy; a successful change MUST end every other session of the user and keep the caller signed in through a newly issued session.

### Delivery Requirements

- **DR-001**: The API MUST ship as a production container image built from a minimal, actively maintained base image that runs the application as a non-root user, contains only runtime files, reads configuration from the environment, embeds no secrets, and is pinned by digest.
- **DR-002**: The image build MUST be layered so that unchanged dependencies are reused from cache; the cold build time, the rebuild time after a source-only change and the image size MUST be measured and recorded in the implementation plan.
- **DR-003**: The image and all dependencies MUST pass a vulnerability scan with zero known critical or high findings at build time, with no exception list; findings block the build.
- **DR-004**: All dependency versions of the repository root and the API application MUST be pinned exactly; version ranges are not allowed there; the lockfile MUST be committed. The web application's manifest is outside this feature (DR-007). Upgrades change the exact version explicitly; proposals come from the dependency bot.
- **DR-005**: A single command MUST start a local environment with every infrastructure dependency the API needs at this stage (database, SMTP capture service with a web inbox); its data MUST persist across restarts in named volumes; its containers, volumes and network MUST carry a project-specific name that cannot collide with other projects on the same machine; host ports MUST bind to the loopback interface only, on uncommon port numbers.
- **DR-006**: Automated tests MUST cover every functional requirement and every edge case in this specification. Test types follow the constitution's layer mapping: business rules in unit tests without test doubles, use cases and persistence in integration tests against a real database, endpoints in component tests through the HTTP layer, user journeys in a small end-to-end suite, and the email gateway behind a test double. Each test states in its name the requirement or scenario it verifies.
- **DR-007**: The web application MUST NOT be modified by this feature.

### Key Entities

- **User**: a person with access to the platform; email (unique, case-insensitive), name, role, status (active, suspended), creation time.
- **Session**: a signed-in presence of a user; expiry, last use, originating client information.
- **Invitation**: an offer to join; email, role, status (pending, accepted, revoked, expired), expiry, inviting administrator, acceptance time.
- **Recovery request**: a time-limited, single-use permission to set a new password for a user; expiry, used-at time.
- **Role**: exactly one of `admin`, `editor`, `viewer` per user; only `admin` manages invitations.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: An invited person completes acceptance, from opening the link to being signed in, in under 2 minutes; measured as the end-to-end journey of the API calls involved.
- **SC-002**: A user completes password recovery, from request to signing in with the new password, in under 5 minutes; measured as the end-to-end journey of the API calls involved.
- **SC-003**: 100% of attempts with wrong credentials, suspended accounts, and used, revoked or expired links are refused.
- **SC-004**: Status code and body of responses for unknown and known email addresses are byte-for-byte identical for sign-in failures and recovery requests.
- **SC-005**: Every functional requirement and edge case in this specification is covered by at least one automated test, and all test suites pass.
- **SC-006**: The production image passes the vulnerability scan with zero critical or high findings and runs as a non-root user.
- **SC-007**: A clean checkout reaches a running local environment with one command in under 5 minutes on a developer workstation, excluding the first download of base images; data created before a restart is present after it.

## Assumptions

- The platform is self-hosted and single-tenant; roles are `admin`, `editor`, `viewer` as defined in the architecture documentation.
- Authentication is built on the first-party NestJS packages (`@nestjs/authentication`, `@nestjs/authorization`); their documented mechanisms are used for sessions, password hashing, recovery tokens and CSRF defence; request-rate limits belong to the API gateway
- Outbound email is sent over SMTP; host, port, credentials and sender address come from configuration; the local environment captures outgoing email in an SMTP capture service with a web inbox instead of delivering it.
- Links in emails point to the web application; its public base URL comes from configuration, and the API does not depend on the web application being present.
- Invitation links are valid for 7 days; recovery links for 1 hour; sessions for 7 days of inactivity and at most 30 days from sign-in.
- Password policy: 12 to 128 characters; no further complexity rules; it applies to invitation acceptance, recovery and password change.
- Invitation emails carry the link, the inviting administrator's name, the assigned role and the expiry date; recovery emails carry the link and its validity period. The secret travels in the link as the query parameter `token`.
- A session used at least once every 7 days stays valid until its absolute lifetime of 30 days from sign-in ends (docs/architecture/06-security.md); the user then signs in again.
- Invitation records are kept indefinitely; used recovery tokens are removed when consumed; expired records are retained until a platform-wide retention job covers them.
- Recovery links expire at the configured moment (1 hour): refused once the expiry moment has passed; two simultaneous completions of one recovery link follow the provider's behaviour and the link is unusable afterwards.
- Outbound mail delivery uses a connection timeout and automatic retries with back-off; mail credentials never appear in logs or error messages.
- User management beyond invitations (changing roles, suspending, deleting users) is out of scope; suspension is referenced only as an existing account state.
- Email verification is not required: an accepted invitation proves control of the email address.
- Infrastructure needed at this stage is the database and email capture; object storage and the code sandbox are not part of this feature's local environment.
- The API is reached only through a trusted proxy (the web application's server or an ingress) that supplies the client address; the gateway limits request rates per client address.
- Outbound email is queued together with the operation that produces it and delivered afterwards with automatic retries; no email is sent for an operation that did not complete.
- The implementation plan reads the constitution's testing rules and Martin Fowler's "Testing Strategies in a Microservice Architecture" before test design.
