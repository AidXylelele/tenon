# code-formatting

Formats and checks the text of a script with a ready-made formatter, off the page's thread: JavaScript with Prettier (`prettier/standalone` with its babel and estree plugins), Python with Ruff compiled to WebAssembly (`@astral-sh/ruff-wasm-web`). Infrastructure: it knows nothing of workflows.

Owner: the web foundation. Decision: research D3 of the console redesign (005); the tech lead's ruling TL-31 (a script's syntax problems come from its formatter).

## API

`language` is `"javascript"` or `"python"` (`ScriptLanguage` of `libs/codemirror`).

- `formatScript(language, text, cursor)` resolves to one of:
  - `{ kind: "formatted", text, cursor }`: the formatted text and where the cursor stands in it — Prettier's `formatWithCursor` for JavaScript; for Python the cursor keeps its line and column, each held within the new text;
  - `{ kind: "refused", message, line }`: the text does not parse, with the formatter's own words and the line of the text they point at;
  - `{ kind: "failed", message }`: the formatter cannot run (Ruff's WebAssembly did not load) or the worker stopped.
- `checkScript(language, text)` resolves to the text's syntax problems as `CodeProblem`s of `libs/codemirror` (`{ line, message, severity: "error" }`), each on a line of the text, or none when it parses: Prettier's parse error for JavaScript, Ruff's `check` with no lint rule for Python. It rejects with the reason when the checker cannot run.
- `FORMATTER_NAMES`: each language's formatter by name, "Prettier" and "Ruff".

## How it runs

One module worker, started on the first request and reused; each formatter is loaded on the first request in its language. Ruff's WebAssembly needs `'wasm-unsafe-eval'` in the worker chunks' policy (`next.config.ts`); the page's policy is untouched. A Ruff that failed to start is started again on the next request. On the production build Turbopack starts the worker as its classic runtime with `importScripts` chunks and emits Ruff's WebAssembly as a `static/media` asset; both languages format there under the console's page policy (checked on a local probe page, 2026-11-22; the committed proof is the editor's page, M5).

## Tests

Unit tests run both formatters and checks directly, the cursor's positions alone, and the worker through its port. `e2e/code-formatting.spec.ts` runs this lib's Playground stories (formatting both languages, a refusal and a check) in Chromium under the worker policy read from `next.config.ts`.
