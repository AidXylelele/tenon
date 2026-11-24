import {
  authenticationOccurrencesOf,
  type Context,
  errorOccurrencesOf,
  type NamedComponent,
  naming,
  type Occurrence,
  type ReferenceOccurrence,
  type RetryReferenceOccurrence,
  retryOccurrencesOf,
  timeoutOccurrencesOf,
  type Walk,
} from "../occurrences/index.js";
import type { ReferenceTable } from "../symbols/index.js";
import type { Substitution } from "./types.js";

const unsubstituted: Substitution = { component: null, occurrences: [] };

export function substitutedOf(
  occurrences: readonly Occurrence[],
  references: ReferenceTable,
): readonly Occurrence[] {
  const named = occurrences.filter(
    (occurrence) => occurrence.kind === "reference",
  );
  const substitutions = named.map((reference) =>
    substitutionOf(reference, references),
  );
  const denoted = substitutions.map(({ component }) => component);
  const components = new Set(denoted);
  const written = occurrences.filter(
    ({ context }) => context.component === null,
  );
  const unnamed = occurrences.filter(({ context }) =>
    isUnnamed(context, components),
  );

  return [
    ...written,
    ...substitutions.flatMap((substitution) => substitution.occurrences),
    ...unnamed,
  ];
}

function isUnnamed(
  context: Context,
  named: ReadonlySet<NamedComponent | null>,
): boolean {
  return context.component !== null && !named.has(context.component);
}

function substitutionOf(
  occurrence: ReferenceOccurrence | RetryReferenceOccurrence,
  references: ReferenceTable,
): Substitution {
  const pointer = occurrence.reference.pointer;
  const context = naming(occurrence.context, occurrence.reference);

  switch (occurrence.table) {
    case "authentications": {
      const policy = references.authentications.get(pointer);
      return substitutionAt(policy, context, authenticationOccurrencesOf);
    }
    case "errors": {
      const error = references.errors.get(pointer);
      return substitutionAt(error, context, errorOccurrencesOf);
    }
    case "retries":
      return retrySubstitutionOf(occurrence, references);
    case "timeouts": {
      const timeout = references.timeouts.get(pointer);
      return substitutionAt(timeout, context, timeoutOccurrencesOf);
    }
    case "secrets":
      return unsubstituted;
  }
}

function retrySubstitutionOf(
  occurrence: RetryReferenceOccurrence,
  references: ReferenceTable,
): Substitution {
  const { reference } = occurrence;
  const policy = references.retries.get(reference.pointer);
  const handler = naming(occurrence.handler, reference);
  const context = naming(occurrence.context, reference);

  if (policy === undefined) {
    return unsubstituted;
  }

  const substituted = retryOccurrencesOf(policy, handler, context);
  return { component: policy, occurrences: substituted };
}

function substitutionAt<Component extends NamedComponent>(
  component: Component | undefined,
  context: Context,
  walk: Walk<Component>,
): Substitution {
  if (component === undefined) {
    return unsubstituted;
  }

  const substituted = walk(component, context);
  return { component, occurrences: substituted };
}
