import { InterpreterError } from "../../runtime/index.js";
import type { Reference } from "../../syntax/index.js";
import type { Context } from "./context.js";

interface Kinded {
  readonly kind: string;
}

export interface Substitution<Component> {
  readonly component: Component;
  readonly context: Context;
}

export function componentOf<Component extends Kinded>(
  target: Component | Reference,
  denoted: ReadonlyMap<string, Component>,
  context: Context,
): Substitution<Component> {
  const referenced = isReference(target);

  if (!referenced) {
    return { component: target, context };
  }

  const component = denoted.get(target.pointer);

  if (component === undefined) {
    throw new InterpreterError(
      `The reference at '${target.pointer}' denotes no component.`,
    );
  }

  const placed = context.placedAt(target.pointer);
  return { component, context: placed };
}

function isReference(target: Kinded): target is Reference {
  return target.kind === "reference";
}
