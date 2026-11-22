import type { ExpressionMode } from "../../standard/index.js";
import type {
  Access,
  Argument,
  BinderSlot,
  Binders,
  DurationTerm,
  Expression,
  Template,
  UriTemplateTerm,
  UriTerm,
} from "../forms/index.js";

function accessText(access: Access): string {
  switch (access.kind) {
    case "slot":
      return `slot(${String(access.depth)},${String(access.index)})`;
    case "activation":
      return `${access.field}^${String(access.hops)}`;
    case "store":
      return "store";
    case "run":
      return `run.${access.field}`;
    case "secrets":
      return "secrets";
  }
}

function argumentText(argument: Argument): string {
  const access = accessText(argument.access);
  return `${argument.name}=${access}`;
}

export function expressionText(expression: Expression): string {
  const arguments_ = expression.arguments.map(argumentText);
  const reads = arguments_.join(" ");
  const opening = openingOf(expression.mode);

  return `${opening} ${expression.source} } ⟨${reads}⟩`;
}

function openingOf(mode: ExpressionMode): string {
  switch (mode) {
    case "strict":
      return "${";
    case "loose":
      return "${~";
  }
}

export function templateText(template: Template): string {
  switch (template.kind) {
    case "literal":
      return JSON.stringify(template.value);
    case "expression":
      return expressionText(template);
    case "object":
      return objectText(template.fields);
    case "array":
      return `[${template.items.map(templateText).join(",")}]`;
    case "current":
      return ".";
    case "context":
      return "$context";
  }
}

function objectText(fields: ReadonlyMap<string, Template>): string {
  const members = Array.from(fields, ([key, value]) => {
    const name = JSON.stringify(key);
    return `${name}:${templateText(value)}`;
  });
  return `{${members.join(",")}}`;
}

export function uriTemplateText(term: UriTemplateTerm): string {
  const source = JSON.stringify(term.template.source);
  return `template ${source}`;
}

export function uriTermText(term: UriTerm): string {
  switch (term.kind) {
    case "uri":
      return uriTemplateText(term);
    case "expression":
      return expressionText(term);
  }
}

export function durationText(duration: DurationTerm): string {
  switch (duration.kind) {
    case "fixed":
      return millisecondsText(duration.milliseconds);
    case "calendar":
      return duration.iso;
    case "computed":
      return expressionText(duration.expression);
  }
}

export function millisecondsText(milliseconds: number): string {
  return `${String(milliseconds)}ms`;
}

function slotText(slot: BinderSlot): string {
  return `${slot.name}:${slot.role}`;
}

export function bindersText(binders: Binders): string {
  const slots = binders.slots.map(slotText).join(" ");
  return `${binders.declaration} [${slots}]`;
}
