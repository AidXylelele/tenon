# Security

## Authentication

| Aspect        | Value                                                                                                                                                                                                                                                                                                                 |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Mechanism     | `@nestjs/authentication` in the API: server-side sessions (`session` table, hashed ids, idle 7 d, absolute 30 d), scrypt password hashes, hashed single-use recovery tokens                                                                                                                                           |
| Browser       | Holds only the session cookie; the Web BFF proxies `/api/v1/auth/*` and forwards the cookie to the API                                                                                                                                                                                                                |
| Tokens        | Access tokens never reach the browser                                                                                                                                                                                                                                                                                 |
| Configuration | `trustedOrigins` set once for `app.enableCsrfProtection` and the session provider; cookie `sid` (`__Host-sid` under https) HttpOnly, SameSite=Lax, Secure from `SESSION_COOKIE_SECURE`                                                                                                                                |
| Sign-up       | Self-service registration disabled; the first administrator is seeded by a database migration without a password and sets it through recovery; administrators invite users by link                                                                                                                                    |
| Invitations   | Single-use link valid 7 days; only the SHA-256 of the secret is stored; acceptance creates the account with the invited role and signs the person in; an existing session is ended first                                                                                                                              |
| Recovery      | Single-use link valid 1 hour, bound to the password it replaces; completion ends every session; requests answered identically and in constant time                                                                                                                                                                    |
| Password      | 12 to 128 characters; change requires the current password and ends every other session                                                                                                                                                                                                                               |
| Rate limit    | Enforced by the API gateway (Envoy Gateway, delivered with the platform's Helm chart) per client address on every public route, sign-in and recovery included; the API contains no rate limiter. `TRUSTED_PROXIES` decides which `x-forwarded-for` the API trusts for the client address in logs and session metadata |
| Suspension    | A suspended (banned) user is refused sign-in and loses every session                                                                                                                                                                                                                                                  |
| Events        | No dedicated security event log; request logs carry route, status, client address and trace identifiers; `AuthenticationEvents` of `@nestjs/authentication` is the hook for a later event log; logs never contain passwords, tokens or links                                                                          |

## Authorisation

| Aspect      | Value                                                                                                                                                                                                                                                                |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Model       | Roles `admin`, `editor`, `viewer` on the user; policies in `application/policies` decide on the facts of `User` (`isAdmin`, `isActive`)                                                                                                                              |
| Roles       | `admin` (all statements plus user administration and invitations), `editor` (manage workflows, credentials, runs), `viewer` (read)                                                                                                                                   |
| Enforcement | `@nestjs/authentication` global guard (`@Public()` opts out) sets the current `User`; `@nestjs/authorization` policies in `application/policies` (`@Can(InvitationPolicy, 'manage')`, `@Can.Anyone()`) evaluated afterwards; a route without a declaration is denied |
| Scope       | Object-level checks on every workflow, credential and run accessed                                                                                                                                                                                                   |

## Secrets

| Aspect           | Value                                                                                      |
| ---------------- | ------------------------------------------------------------------------------------------ |
| Credentials      | AES-GCM with a versioned key from the environment; decrypted only inside execute node step |
| Exposure         | Secrets never enter the engine journal, artifacts, logs or telemetry                       |
| Platform secrets | Environment variables only                                                                 |

## Webhooks

| Aspect        | Value                                                                  |
| ------------- | ---------------------------------------------------------------------- |
| Secret        | One secret per webhook endpoint                                        |
| Verification  | Signature over the raw body; unverified deliveries rejected            |
| Deduplication | Instance id derived from the delivery id                               |
| Limits        | Request size limits in the API; request-rate limits at the API gateway |

## Code Sandbox

| Aspect    | Value                                                                  |
| --------- | ---------------------------------------------------------------------- |
| Access    | Worker only, `localhost`, bearer token                                 |
| Isolation | No network namespace sharing; read-only system mounts; seccomp profile |
| Limits    | CPU, wall clock, memory, processes, output                             |
| Startup   | `-no-fallback`: the sandbox refuses to run without cgroup limits       |
| Requests  | Fixed `args` and `env`; `src` is never sent                            |

## Outbound calls

| Aspect        | Value                                                                                                       |
| ------------- | ----------------------------------------------------------------------------------------------------------- |
| Timeouts      | Per step from the manifest; abort signal propagated to the HTTP client                                      |
| Response size | Bounded per node type                                                                                       |
| SSRF          | User-supplied URLs resolve to public addresses only; private and link-local ranges rejected at connect time |

## General

| Aspect           | Value                                                                                                                                                            |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Input validation | Every request validated against a schema that rejects unknown fields                                                                                             |
| Errors           | Standard Nest error body `{ statusCode, message, error }`; domain errors mapped to 400, 401, 403, 404, 409, 410; no internal details                             |
| API headers      | `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, `Cache-Control: no-store`; no server banner                          |
| Web headers      | Content Security Policy, HSTS and standard hardening headers set by the Web BFF                                                                                  |
| Dependencies     | Exact versions in the root and the API; lockfile committed; `pnpm audit` and Trivy (lockfile and image) in CI; zero critical or high findings, no exception list |
| Image            | Distroless Node runtime pinned by digest, non-root (uid 65532), runtime files only, configuration from the environment                                           |
