import type { JsonValue } from "../../api/index.js";
import type { Term } from "../../core/index.js";
import { type WorkflowK, workflowK } from "../frames/index.js";
import { type Address, type Here, rootScopeOf } from "../registers/index.js";
import { type Evaluating, evaluating } from "../transitions/index.js";

interface WorkflowRoot {
  readonly frame: WorkflowK;
  readonly control: Evaluating;
}

export function workflowRootOf(
  root: Term,
  activation: Address,
  input: JsonValue,
): WorkflowRoot {
  const frame = workflowK({ activation });
  const scope = rootScopeOf(activation);
  const here: Here = { scope, value: input };
  const control = evaluating(root, here);

  return { frame, control };
}
