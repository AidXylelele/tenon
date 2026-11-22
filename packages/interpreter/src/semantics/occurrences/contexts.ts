import type { ExternalSchema, Reference, Task } from "../../syntax/index.js";
import { Scope } from "./scopes.js";
import type {
  BinderBinding,
  Context,
  NamedComponent,
  Position,
} from "./types.js";

const noBinders: readonly BinderBinding[] = [];

export const outermost: Context = {
  position: "taskBody",
  scope: new Scope(noBinders, null),
  task: null,
  function: null,
  schema: null,
  component: null,
  place: null,
};

export function at(context: Context, position: Position): Context {
  return { ...context, position };
}

export function inTask(context: Context, task: Task): Context {
  return { ...context, task: task.pointer };
}

export function inFunction(context: Context, name: string): Context {
  return { ...context, function: name };
}

export function inSchema(context: Context, schema: ExternalSchema): Context {
  return { ...context, schema };
}

export function declaring(
  context: Context,
  component: NamedComponent,
): Context {
  return { ...context, component };
}

export function naming(context: Context, reference: Reference): Context {
  return { ...context, place: reference.pointer };
}

export function within(
  context: Context,
  binders: readonly BinderBinding[],
): Context {
  const scope = context.scope.inside(binders);
  return { ...context, scope };
}

export function iterationBindersOf(
  declaration: string,
  item: string,
  index: string,
): readonly BinderBinding[] {
  return [
    { kind: "binder", declaration, role: "item", name: item },
    { kind: "binder", declaration, role: "index", name: index },
  ];
}

export function handlingBindersOf(
  declaration: string,
  error: string,
): readonly BinderBinding[] {
  return [{ kind: "binder", declaration, role: "error", name: error }];
}
