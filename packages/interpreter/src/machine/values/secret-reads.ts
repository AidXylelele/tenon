import type { JsonValue } from "../../api/index.js";
import type { Argument, Expression, Template } from "../../core/index.js";

export function shownValueOf(template: Template, value: JsonValue): string {
  const isRead = readsSecrets(template);

  if (!isRead) {
    return JSON.stringify(value);
  }

  const isExpression = template.kind === "expression";

  if (isExpression) {
    return writtenOf(template);
  }

  return "A value built from a secret";
}

export function shownMessageOf(
  expression: Expression,
  message: string,
): string {
  const isRead = readsSecrets(expression);

  if (!isRead) {
    return message;
  }

  const written = writtenOf(expression);
  return `The expression ${written} failed; it reads a secret, so its message is withheld.`;
}

export function readsSecrets(template: Template): boolean {
  switch (template.kind) {
    case "expression":
      return template.arguments.some(isSecretsArgument);
    case "object": {
      const fields = Array.from(template.fields.values());
      return fields.some(readsSecrets);
    }
    case "array":
      return template.items.some(readsSecrets);
    case "literal":
    case "current":
    case "context":
      return false;
  }
}

function isSecretsArgument(argument: Argument): boolean {
  return argument.access.kind === "secrets";
}

function writtenOf(expression: Expression): string {
  return `\${ ${expression.source} }`;
}
