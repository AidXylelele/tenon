import { InterpreterError } from "../../runtime/index.js";
import type { BinderBinding } from "../../semantics/index.js";
import type { BinderSlot, Binders } from "../forms/index.js";

export function bindersOf(bindings: readonly BinderBinding[]): Binders {
  const declared = bindings[0];

  if (declared === undefined) {
    throw new InterpreterError(
      "A node that declares binders declares at least one.",
    );
  }

  const slots = bindings.map(slotOf);
  return { declaration: declared.declaration, slots };
}

function slotOf(binding: BinderBinding): BinderSlot {
  return { name: binding.name, role: binding.role };
}
