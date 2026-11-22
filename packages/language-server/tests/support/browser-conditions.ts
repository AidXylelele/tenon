import { registerHooks } from "node:module";

const browserEntries: ReadonlySet<string> = new Set([
  "vscode-languageserver/browser",
  "vscode-languageserver-protocol/browser",
  "vscode-jsonrpc/browser",
]);

registerHooks({
  resolve(specifier, context, nextResolve) {
    const isBrowserEntry = browserEntries.has(specifier);

    if (!isBrowserEntry) {
      return nextResolve(specifier, context);
    }

    const conditions = [...context.conditions, "browser"];
    const browserContext = { ...context, conditions };
    return nextResolve(specifier, browserContext);
  },
});
