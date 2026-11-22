import type { Evaluating, Transition } from "../transitions/index.js";
import type { View } from "../view.js";
import { evaluateChoose } from "./choose.js";
import { evaluateDeadline } from "./deadline.js";
import { evaluateExport } from "./export.js";
import { evaluateExtend } from "./extend.js";
import { evaluateGuard } from "./guard.js";
import { evaluateHandle } from "./handle.js";
import { evaluateInvoke } from "./invoke.js";
import { evaluateLet } from "./let.js";
import { evaluateLoop } from "./loop.js";
import { evaluateParallel } from "./parallel.js";
import { evaluatePerform } from "./perform.js";
import { evaluateRaise } from "./raise.js";
import { evaluateSequence } from "./sequence.js";
import { evaluateStream } from "./stream.js";
import { evaluateTaskList } from "./task-list.js";
import { evaluateTask } from "./task.js";
import { evaluateTransform } from "./transform.js";
import { evaluateValidate } from "./validate.js";

export function evaluated(control: Evaluating, view: View): Transition {
  const term = control.term;
  const here = control.here;

  switch (term.form) {
    case "sequence":
      return evaluateSequence(term, here);
    case "taskList":
      return evaluateTaskList(term, here);
    case "task":
      return evaluateTask(term, here, view);
    case "let":
      return evaluateLet(term, here, view);
    case "guard":
      return evaluateGuard(term, here, view);
    case "transform":
      return evaluateTransform(term, here, view);
    case "validate":
      return evaluateValidate(term, here, view);
    case "export":
      return evaluateExport(term, here, view);
    case "choose":
      return evaluateChoose(term, here, view);
    case "loop":
      return evaluateLoop(term, here, view);
    case "raise":
      return evaluateRaise(term, here, view);
    case "invoke":
      return evaluateInvoke(term, here, view);
    case "perform":
      return evaluatePerform(term, here, view);
    case "deadline":
      return evaluateDeadline(term, here, view);
    case "handle":
      return evaluateHandle(term, here, view);
    case "extend":
      return evaluateExtend(term, here, view);
    case "stream":
      return evaluateStream(term, here, view);
    case "parallel":
      return evaluateParallel(term, here, view);
  }
}
