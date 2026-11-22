import type * as ast from "../../syntax/index.js";
import type { Iterator } from "../forms/index.js";
import type { Context } from "./context.js";
import { iteratorFlowOf } from "./data-flow.js";

const noIterators: readonly Iterator[] = [];

export function iteratorsOf(
  foreach: ast.SubscriptionIterator | null,
  context: Context,
): readonly Iterator[] {
  if (foreach === null) {
    return noIterators;
  }

  const iterator = iteratorFlowOf(foreach, context);
  return [iterator];
}
