import { isPointerWithin } from "../../runtime/index.js";
import type { KeywordRole, Located } from "./types.js";

const keywordRoles: Readonly<Record<string, KeywordRole>> = {
  pattern: "value",
  format: "value",
  minLength: "value",
  maxLength: "value",
  minimum: "value",
  maximum: "value",
  exclusiveMinimum: "value",
  exclusiveMaximum: "value",
  multipleOf: "value",
  oneOf: "choice",
  anyOf: "choice",
  if: "choice",
  type: "alternative",
  additionalProperties: "alternative",
  unevaluatedProperties: "alternative",
  required: "structure",
  dependentRequired: "structure",
  enum: "structure",
  const: "structure",
  not: "structure",
  minProperties: "structure",
  maxProperties: "structure",
  propertyNames: "structure",
  minItems: "structure",
  maxItems: "structure",
  uniqueItems: "structure",
  contains: "structure",
  items: "structure",
  unevaluatedItems: "structure",
  "false schema": "structure",
};

export function isStructureIntact(violations: readonly Located[]): boolean {
  const values = violations.filter((violation) => isOfRole(violation, "value"));
  const choices = violations.filter((violation) =>
    isOfRole(violation, "choice"),
  );

  return violations.every((violation) => isExcused(violation, values, choices));
}

function isExcused(
  violation: Located,
  values: readonly Located[],
  choices: readonly Located[],
): boolean {
  const role = roleOf(violation);

  switch (role) {
    case "value":
      return true;
    case "choice":
      return isExplainedBy(violation, values);
    case "alternative":
      return isAlternativeNotTaken(violation, values, choices);
    case "structure":
      return false;
  }
}

function isAlternativeNotTaken(
  violation: Located,
  values: readonly Located[],
  choices: readonly Located[],
): boolean {
  const isOffered = choices.some(
    (choice) => choice.instance === violation.instance,
  );
  const isExplained = isExplainedBy(violation, values);

  return isOffered && isExplained;
}

function isExplainedBy(
  violation: Located,
  values: readonly Located[],
): boolean {
  return values.some((value) =>
    isPointerWithin(value.pointer, violation.pointer),
  );
}

function isOfRole(violation: Located, role: KeywordRole): boolean {
  return roleOf(violation) === role;
}

function roleOf(violation: Located): KeywordRole {
  return keywordRoles[violation.keyword] ?? "structure";
}
