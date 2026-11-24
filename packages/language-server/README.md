# language-server

The workflow language server of the console's editor. It runs in a Web Worker, analyses a workflow document with the
interpreter's front end and answers the Language Server Protocol (diagnostics, completion, hover, code actions) and
its own `workflow/*` methods for the forms, the flow and publishing, described in
[`lsp-extensions.md`](lsp-extensions.md).

## Entries

- `language-server/worker`: `startServer(scope)` serves the protocol in a dedicated worker; it downloads the jq
  engine and loads a Temporal polyfill where the browser has none.
- `language-server/protocol`: the types of the custom methods and their method names, for the client.
- `language-server/structure`: `structureOf(analysis)`, a workflow's steps and triggers as the flow draws them; the
  api uses it too.

The client configures the server with `initializationOptions` on `initialize`: the host's `profile` (the
interpreter's) and the `draft` the editor holds.

## Scripts

`build` compiles `src` into `dist`, `dev` does it in watch mode; `lint`, `check-types` and `test` (Vitest) check it.
`tests/protocol` drives the server through the protocol, `tests/ide` the analyses behind it and `tests/differential`
compares the analysis under the Temporal polyfill with Node's own Temporal.
