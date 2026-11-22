# language-client

The console's side of the Language Server Protocol: it connects `@codemirror/lsp-client` to a language server running in a worker, keeps what the server publishes, asks it for quick fixes and applies the edits it sends. Infrastructure: it speaks LSP and knows nothing of workflows; the server and its custom methods are the language server package's.

Owner: the web foundation. Decisions: the web stage's language server in a worker (`specs/000-platform/web-stage.md`); the web rubric's editor rows ED-5 (LSP through `@codemirror/lsp-client` over a transport) and ED-6 (positions are UTF-16, as LSP and CodeMirror count them).

## API

- `connectLanguageServer(worker, options)`: an `LSPClient` connected to the worker over a transport that sends each message as structured data (`initializationOptions`, `extensions`, `notificationHandlers`, a 15 s request timeout). It returns a `LanguageConnection`: the `client` and `close()`, which disconnects and ends the worker.
- `useLanguageConnection(connect)`: a React hook that connects once on mount and gives the `LanguageState` — `starting`, `ready` with the connection once the server initialized, or `failed` with the server's reason; leaving closes the connection.
- `DiagnosticsBoard`: the diagnostics the server publishes, per document (`receive` is the `textDocument/publishDiagnostics` handler, `subscribe` and `diagnosticsOf(uri)` read them).
- `diagnosticText(diagnostic)`: a diagnostic's words, plain or markdown. `isSameDiagnostic(one, other)`: the same words at the same start.
- `offersCodeActions(client)`: whether the server announced code actions. `codeActionsFor(client, uri, diagnostics)`: the quick fixes for the lines the diagnostics cover, commands left out. `applyCodeAction(client, view, uri, action)`: resolves the action first where the server resolves and the action has no edit, then applies its edits to this document (`changes` and `documentChanges`).
- `applyTextEdits(view, edits, remembered = true)`: the server's edits applied where it meant them, mapped through the typing it has not seen yet, as one `input.language-server` change; `remembered` false keeps them out of the undo history.
- `isOutdated(failure)`: the server refused a request because the document changed meanwhile (`ContentModified`). `reasonOf(failure)`: a failure's words.

## Tests

The tests drive a real `LSPClient` against a scripted server behind a transport (`language-server.test-support.ts`), the boundary of the process: quick fixes, edits, the connection's life and the hook's states. Coverage floor: 85 %.
