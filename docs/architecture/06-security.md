# Security

## Authentication

| Aspect        | Value                                                                                                                        |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Provider      | Better Auth in the API; Drizzle adapter; cookie session                                                                      |
| Browser       | Holds only the session cookie; the Web BFF proxies `/api/auth/*` and forwards the cookie to the API                          |
| Tokens        | Access tokens never reach the browser                                                                                        |
| Configuration | `baseURL` and `trustedOrigins` set explicitly; secure, HttpOnly, SameSite cookies                                            |
| Sign-up       | Self-service registration disabled; the first administrator is created with the Better Auth CLI; administrators create users |

## Authorisation

| Aspect      | Value                                                                                                              |
| ----------- | ------------------------------------------------------------------------------------------------------------------ |
| Model       | Admin plugin access control: statement `workflow`, `credential`, `run`, `settings` × actions                       |
| Roles       | `admin` (all statements plus user administration), `editor` (manage workflows, credentials, runs), `viewer` (read) |
| Enforcement | Every use case checks the Principal through the authorisation port; route decorators are a pre-filter only         |
| Scope       | Object-level checks on every workflow, credential and run accessed                                                 |

## Secrets

| Aspect           | Value                                                                                      |
| ---------------- | ------------------------------------------------------------------------------------------ |
| Credentials      | AES-GCM with a versioned key from the environment; decrypted only inside execute node step |
| Exposure         | Secrets never enter the engine journal, artifacts, logs or telemetry                       |
| Platform secrets | Environment variables only                                                                 |

## Webhooks

| Aspect        | Value                                                       |
| ------------- | ----------------------------------------------------------- |
| Secret        | One secret per webhook endpoint                             |
| Verification  | Signature over the raw body; unverified deliveries rejected |
| Deduplication | Instance id derived from the delivery id                    |
| Limits        | Request size limit and rate limit per endpoint              |

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

| Aspect           | Value                                                                           |
| ---------------- | ------------------------------------------------------------------------------- |
| Input validation | Every request validated against a schema that rejects unknown fields            |
| Errors           | Single envelope `{ code, message, details[] }`; no internal details             |
| Web headers      | Content Security Policy, HSTS and standard hardening headers set by the Web BFF |
| Dependencies     | Lockfile committed; dependency audit and secret scanning in CI                  |
