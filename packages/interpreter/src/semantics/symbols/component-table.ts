import type { Finding, Reference, Task, Use } from "../../syntax/index.js";
import type { Occurrence } from "../occurrences/index.js";
import { nameFindingOf } from "./findings.js";
import type {
  ComponentReference,
  ComponentTable,
  DeclaredFunction,
  FunctionSymbol,
  ImportedFunction,
  ReferenceTable,
  Resolution,
} from "./types.js";

const none: readonly Finding[] = [];

const unnamed: readonly ComponentReference[] = [];

export function componentTableOf(
  use: Use,
  imported: ReadonlyMap<string, ImportedFunction>,
): ComponentTable {
  const declared = [...use.functions].map(declaredFunctionOf);
  const symbols = [...declared, ...imported];
  const functions = new Map<string, FunctionSymbol>(symbols);
  const named = use.secrets.map((secret) => [secret.name, secret] as const);
  const secrets = new Map(named);

  return {
    authentications: use.authentications,
    errors: use.errors,
    retries: use.retries,
    timeouts: use.timeouts,
    functions,
    secrets,
  };
}

export function referencesOf(
  occurrences: readonly Occurrence[],
  table: ComponentTable,
): Resolution {
  const named = occurrences.flatMap(componentReferencesOf);
  const authentications = denotedOf(
    named,
    "authentications",
    table.authentications,
  );
  const errors = denotedOf(named, "errors", table.errors);
  const retries = denotedOf(named, "retries", table.retries);
  const timeouts = denotedOf(named, "timeouts", table.timeouts);
  const functions = denotedOf(named, "functions", table.functions);
  const secrets = denotedOf(named, "secrets", table.secrets);
  const references: ReferenceTable = {
    authentications,
    errors,
    retries,
    timeouts,
    functions,
    secrets,
  };
  const undeclared = named.filter(
    (reference) => !isDenoted(reference, references),
  );
  const findings = undeclared.flatMap(undeclaredFindingsOf);

  return { references, findings };
}

function denotedOf<Component>(
  named: readonly ComponentReference[],
  kind: keyof ReferenceTable,
  declarations: ReadonlyMap<string, Component>,
): ReadonlyMap<string, Component> {
  const entries = named
    .filter((reference) => reference.table === kind)
    .flatMap(({ reference }) => denotationOf(reference, declarations));

  return new Map(entries);
}

function denotationOf<Component>(
  reference: Reference,
  declarations: ReadonlyMap<string, Component>,
): readonly (readonly [string, Component])[] {
  const component = declarations.get(reference.name);

  if (component === undefined) {
    return [];
  }

  return [[reference.pointer, component]];
}

function declaredFunctionOf([name, task]: readonly [string, Task]): readonly [
  string,
  DeclaredFunction,
] {
  const symbol: DeclaredFunction = { origin: "declared", name, task };
  return [name, symbol];
}

function componentReferencesOf(
  occurrence: Occurrence,
): readonly ComponentReference[] {
  switch (occurrence.kind) {
    case "reference":
      return [occurrence];
    case "call":
      return [{ table: "functions", reference: occurrence.call.function }];
    case "task":
    case "list":
    case "binders":
    case "expression":
    case "duration":
    case "schema":
    case "filter":
    case "policy":
      return unnamed;
  }
}

function isDenoted(
  named: ComponentReference,
  references: ReferenceTable,
): boolean {
  const denoted = references[named.table];
  return denoted.has(named.reference.pointer);
}

function undeclaredFindingsOf(named: ComponentReference): readonly Finding[] {
  const reference = named.reference;

  switch (named.table) {
    case "authentications":
      return [
        nameFindingOf(
          "undeclaredAuthentication",
          "undeclared-component",
          reference,
        ),
      ];
    case "errors":
      return [
        nameFindingOf("undeclaredError", "undeclared-component", reference),
      ];
    case "retries":
      return [
        nameFindingOf("undeclaredRetry", "undeclared-component", reference),
      ];
    case "timeouts":
      return [
        nameFindingOf("undeclaredTimeout", "undeclared-component", reference),
      ];
    case "functions":
    case "secrets":
      return none;
  }
}
