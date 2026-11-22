# code-formatting

Formats the text of a script with a ready-made formatter, off the page's thread: JavaScript with Prettier (`prettier/standalone` with its babel and estree plugins), Python with Ruff compiled to WebAssembly (`@astral-sh/ruff-wasm-web`). Infrastructure: it knows nothing of workflows.

Owner: the web foundation. Decision: research D3 of the console redesign (005).

## API

`formatScript(language, text)`, where `language` is `"javascript"` or `"python"` (`ScriptLanguage` of `libs/codemirror`), resolves to one of:

- `{ kind: "formatted", text }`;
- `{ kind: "refused", message, line }`: the text does not parse, with the formatter's own words and the line they point at.

It rejects when a formatter cannot run (Ruff's WebAssembly did not load) or when the worker stops.

## How it runs

One module worker, started on the first request and reused; each formatter is loaded on the first request in its language. Ruff's WebAssembly needs `'wasm-unsafe-eval'` in the worker chunks' policy (`next.config.ts`); the page's policy is untouched. A Ruff that failed to start is started again on the next request.

## Tests

Unit tests run both formatters directly and the worker through its port. `e2e/code-formatting.spec.ts` runs this lib's Playground stories in Chromium under the worker policy read from `next.config.ts`.
