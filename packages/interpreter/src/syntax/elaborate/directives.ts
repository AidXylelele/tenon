import { childPointerOf } from "../../runtime/index.js";
import { defaults, flowDirectives, isMemberOf } from "../../standard/index.js";
import type { Directive } from "../ast/index.js";
import { fieldOf } from "./parts.js";
import { textOf } from "./scalars.js";
import type { Part } from "./types.js";

export function directiveOf(part: Part): Directive {
  const name = textOf(part);

  const isFlowDirective = isMemberOf(flowDirectives, name);

  if (!isFlowDirective) {
    return { kind: "label", pointer: part.pointer, name };
  }

  return { kind: name, pointer: part.pointer };
}

export function thenOf(task: Part): Directive {
  const then = fieldOf(task, "then");

  if (then !== null) {
    return directiveOf(then);
  }

  const pointer = childPointerOf(task.pointer, "then");
  return { kind: defaults.then, pointer };
}
