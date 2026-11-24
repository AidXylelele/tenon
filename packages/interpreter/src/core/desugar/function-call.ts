import { InterpreterError } from "../../runtime/index.js";
import type { FunctionSymbol } from "../../semantics/index.js";
import type * as ast from "../../syntax/index.js";
import { type Invoke, invoke, termIdOf } from "../forms/index.js";
import type { Context } from "./context.js";
import { noEntries } from "./effects/index.js";
import { templateOf } from "./templates.js";

export function functionCallOf(
  site: string,
  call: ast.FunctionCall,
  context: Context,
): Invoke {
  const id = termIdOf(site, "invoke");
  const called = calledOf(call.function, context);
  const callee = context.procedures.procedureOf(called, context);
  const input = templateOf(call.with, noEntries, context);

  return invoke({ id, callee, arguments: input });
}

function calledOf(reference: ast.Reference, context: Context): FunctionSymbol {
  const functions = context.model.symbols.references.functions;
  const called = functions.get(reference.pointer);

  if (called === undefined) {
    throw new InterpreterError(
      `The call at '${reference.pointer}' denotes no function of the workflow.`,
    );
  }

  return called;
}
