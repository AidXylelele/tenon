# Quickstart: API Authentication

Validation guide for the feature. Contract: [contracts/openapi.yaml](contracts/openapi.yaml). Data: [data-model.md](data-model.md).

## Prerequisites

- Docker Desktop (Compose v2, BuildKit)
- pnpm 12.8.1 (`packageManager` pin); Node 24.21.0 is installed by pnpm from `devEngines.runtime`
- Trivy (`brew install trivy`) or the `aquasec/trivy` container

## Local stack

```bash
cp .env.example .env                      # set POSTGRES_PASSWORD
docker compose up -d                      # postgres (127.0.0.1:55432), mailpit (SMTP 51025, UI http://127.0.0.1:58025)
pnpm install --frozen-lockfile
pnpm --filter api db:migrate              # drizzle-kit migrate (user, session, email_token, invitation + seed)
pnpm --filter api outbox:migrate          # nest-outbox migrate (schema nest_outbox)
pnpm --filter api dev                     # API on http://127.0.0.1:3000
```

The migrations seed the administrator `admin@example.com` without a password. Set it through recovery (the
link appears in Mailpit):

```bash
curl -i -X POST http://127.0.0.1:3000/api/v1/auth/password-recovery -H 'content-type: application/json' -d '{"email":"admin@example.com"}'
curl -i -X POST http://127.0.0.1:3000/api/v1/auth/password-recovery/complete -H 'content-type: application/json' -d '{"token":"<token from Mailpit>","newPassword":"first-admin-password"}'
```

Expected: `docker compose ps` shows both services healthy; `docker volume ls` lists
`workflow-platform-postgres` and `workflow-platform-mailpit`; `docker network ls` lists
`workflow-platform`; `GET /api/v1/health` returns 200. Re-running the migrations never seeds a second administrator.

Requests sent directly to the API count against the connecting address: 20 sign-in requests and 20
recovery requests per 10 minutes per address and endpoint.

## Scenario 1: sign in and sign out (US1)

```bash
curl -i -c jar.txt -X POST http://127.0.0.1:3000/api/v1/auth/session \
  -H 'content-type: application/json' -d '{"email":"admin@example.com","password":"<admin password>"}'
curl -i -b jar.txt http://127.0.0.1:3000/api/v1/invitations
curl -i -b jar.txt -X DELETE http://127.0.0.1:3000/api/v1/auth/session
curl -i -b jar.txt http://127.0.0.1:3000/api/v1/invitations
```

Expected: 200 with `{ user }` and `Set-Cookie: sid=…; HttpOnly; SameSite=Lax` (the `Secure`
attribute and the `__Host-` prefix appear with `SESSION_COOKIE_SECURE=true`); 200 list; 204 sign-out; 401 afterwards
with Nest's standard error body (`statusCode`, `message`, `error`). A wrong password and an unknown email both return 401 with
the same body. The 21st sign-in request within 10 minutes returns 429 with `Retry-After`.

## Scenario 2: invite and accept (US2)

```bash
curl -s -b jar.txt -X POST http://127.0.0.1:3000/api/v1/invitations \
  -H 'content-type: application/json' -d '{"email":"editor@example.com","role":"editor"}'
```

Expected: 201 with the pending invitation; within about a second the outbox relay delivers the
message with the link and it appears in Mailpit (http://127.0.0.1:58025). Then:

```bash
curl -s -X POST http://127.0.0.1:3000/api/v1/invitations/verify -H 'content-type: application/json' -d '{"token":"<token from link>"}'
curl -i -c jar2.txt -X POST http://127.0.0.1:3000/api/v1/invitations/accept \
  -H 'content-type: application/json' -d '{"token":"<token>","name":"Editor","password":"correct-horse-battery"}'
curl -s -X POST http://127.0.0.1:3000/api/v1/invitations/verify -H 'content-type: application/json' -d '{"token":"<token>"}'
```

Expected: 200 `{ email, role, expiresAt }`; 200 with `Set-Cookie` and `user.role = "editor"`;
410 (`message` names the reason). Inviting `editor@example.com` again returns 409.
A second invitation for a still-pending email revokes the first link (verify returns 410).
`POST /api/v1/invitations` with the editor's cookie returns 403.
Accepting an invitation while sending the admin's cookie ends the admin session first (`jar.txt` is
refused afterwards with 401).

## Scenario 3: password recovery (US3)

```bash
curl -i -X POST http://127.0.0.1:3000/api/v1/auth/password-recovery \
  -H 'content-type: application/json' -d '{"email":"editor@example.com"}'
curl -i -X POST http://127.0.0.1:3000/api/v1/auth/password-recovery/complete \
  -H 'content-type: application/json' -d '{"token":"<token from Mailpit>","newPassword":"new-correct-horse-battery"}'
```

Expected: 202 with an empty body for both existing and unknown emails; the recovery email is
delivered by the relay to Mailpit; completion returns 204; the editor's earlier session cookie
(`jar2.txt`) is rejected with 401; a second completion with the same token returns 400;
a token older than one hour is rejected; a link issued before the password changed is refused.

## Scenario 4: change password (US4)

```bash
curl -i -b jar2.txt -X PATCH http://127.0.0.1:3000/api/v1/auth/password \
  -H 'content-type: application/json' \
  -d '{"currentPassword":"new-correct-horse-battery","newPassword":"another-long-password"}'
```

Expected: 204 with a fresh session cookie (the caller stays signed in); other sessions of the user
are rejected with 401; a wrong current password returns 400; a 6-character password returns 400.

## Automated tests

```bash
pnpm --filter api test                    # unit: entities, policy, presenter, mapper; no containers
pnpm --filter api test:int                # integration + component on Testcontainers PostgreSQL; relay driven by runOnce()
docker compose --profile app up -d        # built image + postgres + mailpit for the journeys
pnpm --filter api test:e2e                # end-to-end persona journeys against http://127.0.0.1:53000 and the Mailpit API
# Repeated runs within 10 minutes share one in-memory rate-limit budget: restart the api container between runs
# docker compose --profile app restart api
pnpm lint && pnpm check-types
```

Expected: all suites pass; no skipped tests. Component suites cover every acceptance scenario and
edge case of the spec; the rate-limit suite sends 21 requests with `x-forwarded-for` and expects the
last to be 429; the end-to-end suite runs the four quickstart scenarios unattended.

## Image and security gates

```bash
docker build -f apps/api/Dockerfile -t workflow-platform/api:dev .
docker build -f apps/api/Dockerfile -t workflow-platform/api:dev . --progress=plain 2>&1 | grep -E 'CACHED|deps|fetch'
docker image inspect workflow-platform/api:dev --format '{{.Size}}'
docker history workflow-platform/api:dev
trivy image --scanners vuln --severity HIGH,CRITICAL --exit-code 1 workflow-platform/api:dev
trivy fs --scanners vuln --severity HIGH,CRITICAL --exit-code 1 pnpm-lock.yaml
pnpm audit --prod --audit-level=high
docker compose --profile app down -v && time (docker compose up -d --wait && pnpm --filter api db:migrate && pnpm --filter api outbox:migrate) && docker compose --profile app up -d --wait && curl -s http://127.0.0.1:53000/api/v1/health
```

Expected: a rebuild after a source-only change shows the `deps` stage as `CACHED`; image size and
build times are recorded in plan.md (Complexity Tracking); Trivy and `pnpm audit` exit 0 with unfixed
findings counted; the container runs as uid 65532 (`docker inspect --format '{{.Config.User}}'`; the
image has no shell); the clean start completes in under 5 minutes (SC-007; measured 15 s from empty volumes to a
seeded database) and the API answers through the Compose network with mail captured by Mailpit.
On a fresh database the API container starts only after the migrations have been applied.

## Pinning check

```bash
grep -nE '"[\^~]' package.json apps/api/package.json && echo "ranges found" || echo "all exact"
pnpm install --frozen-lockfile
```

Expected: "all exact" (the web application's manifest is outside this feature, DR-007); frozen
install succeeds without lockfile changes.
