import { InterpreterError } from "../../runtime/index.js";
import type * as ast from "../../syntax/index.js";
import {
  type Directive,
  type Jump,
  continueDirective,
  endDirective,
  exitDirective,
  jumpDirective,
} from "../forms/index.js";
import type { Context } from "./context.js";

export function directiveOf(
  directive: ast.Directive,
  context: Context,
): Directive {
  switch (directive.kind) {
    case "continue":
      return continueDirective;
    case "exit":
      return exitDirective;
    case "end":
      return endDirective;
    case "label":
      return jumpOf(directive, context);
  }
}

function jumpOf(directive: ast.LabelDirective, context: Context): Jump {
  const index = context.labels.get(directive.name);

  if (index === undefined) {
    throw new InterpreterError(
      `No task of the list is named '${directive.name}' at '${directive.pointer}'.`,
    );
  }

  return jumpDirective({ index, name: directive.name });
}
