import type { Expression, TextTemplate } from "../../syntax/index.js";

export function writtenTextOf(template: TextTemplate): string | null {
  switch (template.kind) {
    case "literal":
      return template.value;
    case "expression":
      return looseTextOf(template);
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
