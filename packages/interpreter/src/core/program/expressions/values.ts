import type {
  DurationTerm,
  Expression,
  OptionalPart,
  Template,
} from "../../forms/index.js";

const none: readonly Expression[] = [];

function templateExpressionsOf(template: Template): readonly Expression[] {
  switch (template.kind) {
    case "literal":
    case "current":
    case "context":
      return none;
    case "expression":
      return [template];
    case "object": {
      const fields = [...template.fields.values()];
      return templatesExpressionsOf(fields);
    }
    case "array":
      return templatesExpressionsOf(template.items);
  }
}

export function templatesExpressionsOf(
  templates: readonly Template[],
): readonly Expression[] {
  return templates.flatMap(templateExpressionsOf);
}

export function partsExpressionsOf(
  parts: readonly OptionalPart[],
): readonly Expression[] {
  return parts.flatMap(partExpressionsOf);
}

function partExpressionsOf(part: OptionalPart): readonly Expression[] {
  switch (part.kind) {
    case "omitted":
      return none;
    case "written":
      return templateExpressionsOf(part.template);
  }
}

export function durationExpressionsOf(
  duration: DurationTerm,
): readonly Expression[] {
  switch (duration.kind) {
    case "fixed":
    case "calendar":
      return none;
    case "computed":
      return [duration.expression];
  }
}
