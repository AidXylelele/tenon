import type { Expression, ValueTemplate } from "../../syntax/index.js";

export function writtenTextOf(template: ValueTemplate): string | null {
  switch (template.kind) {
    case "literal": {
      const value = template.value;
      return typeof value === "string" ? value : null;
    }
    case "expression":
      return looseTextOf(template);
    case "object":
    case "array":
      return null;
  }
}

function looseTextOf(expression: Expression): string | null {
  switch (expression.mode) {
    case "strict":
      return null;
    case "loose":
      return expression.source;
  }
}
