import type { Analysis, Diagnostic } from "interpreter/front-end";
import type { FetchedImports, ImportFailures } from "./interfaces.js";

export function fetchedImportsOf(
  held: FetchedImports,
  arriving: FetchedImports,
): FetchedImports {
  const keptTexts = withoutReferences(held.texts, arriving.failures);
  const keptFailures = withoutReferences(held.failures, arriving.texts);
  const texts = { ...keptTexts, ...arriving.texts };
  const failures = { ...keptFailures, ...arriving.failures };

  return { texts, failures };
}

export function withFetchFailures(
  analysis: Analysis,
  failures: ImportFailures,
): Analysis {
  const diagnostics = analysis.diagnostics.map((diagnostic) =>
    explainedOf(diagnostic, failures),
  );

  return { ...analysis, diagnostics };
}

function explainedOf(
  diagnostic: Diagnostic,
  failures: ImportFailures,
): Diagnostic {
  const imported = diagnostic.import;
  const isUnresolved = diagnostic.code === "unresolved-import";

  if (imported === null || !isUnresolved) {
    return diagnostic;
  }

  const reference = imported.reference;
  const reason = failures[reference];

  if (reason === undefined) {
    return diagnostic;
  }

  const message = `Import '${reference}' could not be fetched: ${reason}`;
  return { ...diagnostic, message };
}

function withoutReferences(
  held: Readonly<Record<string, string>>,
  arriving: Readonly<Record<string, string>>,
): Readonly<Record<string, string>> {
  const entries = Object.entries(held);
  const kept = entries.filter(
    ([reference]) => !Object.hasOwn(arriving, reference),
  );

  return Object.fromEntries(kept);
}
