import { type ErrorProperty, instanceProperty } from "../../standard/index.js";
import type * as ast from "../../syntax/index.js";
import {
  type ObjectTemplate,
  type Raise,
  type Template,
  literal,
  objectTemplate,
  raise,
} from "../forms/index.js";
import { componentOf } from "./components.js";
import type { Context } from "./context.js";
import { writtenTemplateOf } from "./templates.js";

type ErrorField = readonly [ErrorProperty, Template];

const unwritten: readonly ErrorField[] = [];

export function raiseBodyOf(
  task: ast.TaskCommon & ast.RaiseTask,
  context: Context,
): Raise {
  const id = context.termIdOf(task.pointer, "raise");
  const errors = context.model.symbols.references.errors;
  const substitution = componentOf(task.error, errors, context);
  const error = errorTemplateOf(substitution.component, substitution.context);

  return raise({ id, error });
}

function errorTemplateOf(
  error: ast.ErrorDefinition,
  context: Context,
): ObjectTemplate {
  const type = writtenTemplateOf(error.type, context);
  const status = literal({ value: error.status });
  const instance = writtenFieldsOf(instanceProperty, error.instance, context);
  const title = writtenFieldsOf("title", error.title, context);
  const detail = writtenFieldsOf("detail", error.detail, context);
  const entries: readonly ErrorField[] = [
    ["type", type],
    ["status", status],
    ...instance,
    ...title,
    ...detail,
  ];
  const fields = new Map(entries);

  return objectTemplate({ fields });
}

function writtenFieldsOf(
  property: ErrorProperty,
  text: ast.TextTemplate | null,
  context: Context,
): readonly ErrorField[] {
  if (text === null) {
    return unwritten;
  }

  const template = writtenTemplateOf(text, context);
  return [[property, template]];
}
