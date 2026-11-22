import type * as ast from "../../syntax/index.js";
import { type Case, type Choose, choose } from "../forms/index.js";
import type { Context } from "./context.js";
import { directiveOf } from "./directives.js";
import { conditionsOf } from "./expressions.js";

export function switchBodyOf(
  task: ast.TaskCommon & ast.SwitchTask,
  context: Context,
): Choose {
  const id = context.termIdOf(task.pointer, "choose");
  const conditional = task.switch.filter(({ when }) => when !== null);
  const fallbacks = task.switch.filter(({ when }) => when === null);
  const ordered = [...conditional, ...fallbacks];
  const cases = ordered.map((written) => caseOf(written, context));

  return choose({ id, cases });
}

function caseOf(written: ast.SwitchCase, context: Context): Case {
  const conditions = conditionsOf(written.when, context);
  const then = directiveOf(written.then, context);

  return { conditions, then };
}
