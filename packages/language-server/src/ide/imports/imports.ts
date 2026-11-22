import type { Analysis } from "interpreter/front-end";
import type { NeededImport } from "./interfaces.js";

export function importsNeededOf(analysis: Analysis): readonly NeededImport[] {
  const byReference = new Map<string, NeededImport>();

  for (const diagnostic of analysis.diagnostics) {
    const entry = diagnostic.import;
    const isFetchable = entry !== null && entry.uri !== null;

    if (isFetchable) {
      const needed = { reference: entry.reference, uri: entry.uri };
      byReference.set(entry.reference, needed);
    }
  }

  return Array.from(byReference.values());
}
