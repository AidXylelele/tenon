import type {
  JsonValue,
  Occurrence,
  SchemaAt,
  SchemaMember,
  SemanticModel,
} from "interpreter/front-end";
import { lastTokenOf, parentPointerOf } from "../pointers/index.js";
import type { ComponentKind, SchemasAt } from "./interfaces.js";

const describedByHolder: ReadonlySet<string> = new Set(["call"]);

export function referenceTableAt(
  model: SemanticModel,
  pointer: string,
): ComponentKind | null {
  const tables = model.occurrences.flatMap((occurrence) =>
    referenceTablesOf(occurrence, pointer),
  );

  return tables[0] ?? null;
}

export function declarationOf(
  model: SemanticModel,
  table: ComponentKind,
  name: string,
): string | null {
  const components = model.symbols.components;

  switch (table) {
    case "authentications":
      return components.authentications.get(name)?.pointer ?? null;
    case "errors":
      return components.errors.get(name)?.pointer ?? null;
    case "retries":
      return components.retries.get(name)?.pointer ?? null;
    case "timeouts":
      return components.timeouts.get(name)?.pointer ?? null;
    case "secrets":
      return components.secrets.get(name)?.pointer ?? null;
    case "functions": {
      const symbol = components.functions.get(name);
      return symbol?.origin === "declared" ? symbol.task.pointer : null;
    }
  }
}

export function componentNounOf(table: ComponentKind): string {
  switch (table) {
    case "authentications":
      return "authentication";
    case "errors":
      return "error";
    case "retries":
      return "retry";
    case "timeouts":
      return "timeout";
    case "functions":
      return "function";
    case "secrets":
      return "secret";
  }
}

export function membersOf(
  entries: readonly SchemaAt[],
): readonly SchemaMember[] {
  const members = entries.flatMap((entry) => entry.members);

  return members.filter(
    (member, index) =>
      members.findIndex((other) => other.name === member.name) === index,
  );
}

export function holderDescriptionOf(
  document: JsonValue,
  pointer: string,
  schemasAt: SchemasAt,
): string | null {
  const name = lastTokenOf(pointer);
  const isDescribedByHolder = describedByHolder.has(name);

  if (!isDescribedByHolder) {
    return null;
  }

  const holder = parentPointerOf(pointer);
  const entries = schemasAt(document, holder);
  const described = entries.find((entry) => entry.description !== null);
  return described?.description ?? null;
}

function referenceTablesOf(
  occurrence: Occurrence,
  pointer: string,
): readonly ComponentKind[] {
  switch (occurrence.kind) {
    case "reference": {
      const isHere = occurrence.reference.pointer === pointer;
      return isHere ? [occurrence.table] : [];
    }
    case "call": {
      const isHere = occurrence.call.function.pointer === pointer;
      return isHere ? ["functions"] : [];
    }
    case "task":
    case "list":
    case "binders":
    case "expression":
    case "duration":
    case "schema":
    case "filter":
    case "policy":
      return [];
  }
}
