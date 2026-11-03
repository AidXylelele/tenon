# Quickstart: Web Console

How to run the console against the API and walk through every story. The commands are run from the repository root.

## Run

```sh
docker compose up -d postgres mailpit go-judge      # PostgreSQL, the SMTP inbox, the sandbox
set -a; . ./.env; set +a                             # the API's settings (see .env.example)
pnpm --filter api db:migrate && pnpm --filter api outbox:migrate && pnpm --filter api engine:migrate
pnpm --filter api dev                                # http://127.0.0.1:3000
cp apps/web/.env.example apps/web/.env.local         # API_URL, SESSION_COOKIE_SECURE=false for http
pnpm --filter web dev                                # http://127.0.0.1:3001
```

- **The first sign-in.** The seeded administrator (`admin@example.com`) has no password yet. Open **Forgot it?** on the sign-in page, then follow the link from Mailpit at http://127.0.0.1:58025.
- **Your environment file.** `.env` needs every key of `.env.example`; `SANDBOX_TOKEN`, `SECRETS_KEY` and `SANDBOX_URL` came with feature 002.

## Journeys

| Story | Walk through                                                                                                                                                                                               |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| US1   | Sign in, sign out from the user menu, and open a console address while signed out: you are asked to sign in and returned to it.                                                                            |
| US2   | **Workflows → New workflow.** Add steps from the palette and type a cron of `every monday`: the problem shows on the cron field. Fix it, then **Publish**.                                                 |
| US3   | **Start** a run, with a JSON input or the form. The run page fills its run line live, then shows the output. Add a **Stop with an error** step: the faulting step is marked and the error is shown.        |
| US4   | In the editor, switch to **Code**, break the YAML and see the error at its line. Paste a document, or **Load a file**.                                                                                     |
| US5   | Give a workflow the trigger **On a schedule**, publish it and turn it **On**. Its first scheduled run appears under **Recent runs**.                                                                       |
| US6   | **Runs**: filter by workflow and phase. The address keeps the filters.                                                                                                                                     |
| US7   | **Secrets**, then **Webhooks**: copy the URL and run the example `curl`. A workflow **When an event arrives** with that type starts. **Subscriptions → Any run that completes** shows its deliveries live. |
| US8   | **Invitations**: invite an editor, open the emailed link in another browser, and create the account. **Account** changes the password.                                                                     |

## Checks

```sh
pnpm --filter web lint && pnpm --filter web check-types && pnpm --filter web test
pnpm --filter web build                              # every route is dynamic, so each page carries its CSP nonce
```
