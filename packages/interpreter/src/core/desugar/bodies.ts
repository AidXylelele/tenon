import type * as ast from "../../syntax/index.js";
import type { Term } from "../forms/index.js";
import { callBodyOf } from "./call.js";
import type { Context } from "./context.js";
import { taskListOf } from "./do.js";
import { emitBodyOf } from "./emit.js";
import { forBodyOf } from "./for.js";
import { forkBodyOf } from "./fork.js";
import { listenBodyOf } from "./listen.js";
import { raiseBodyOf } from "./raise.js";
import { runBodyOf } from "./run.js";
import { setBodyOf } from "./set.js";
import { switchBodyOf } from "./switch.js";
import { tryBodyOf } from "./try.js";
import { waitBodyOf } from "./wait.js";

export function bodyOf(task: ast.Task, context: Context): Term {
  switch (task.kind) {
    case "call":
      return callBodyOf(task, context);
    case "do":
      return taskListOf(task.do, context);
    case "emit":
      return emitBodyOf(task, context);
    case "for":
      return forBodyOf(task, context);
    case "fork":
      return forkBodyOf(task, context);
    case "listen":
      return listenBodyOf(task, context);
    case "raise":
      return raiseBodyOf(task, context);
    case "run":
      return runBodyOf(task, context);
    case "set":
      return setBodyOf(task, context);
    case "switch":
      return switchBodyOf(task, context);
    case "try":
      return tryBodyOf(task, context);
    case "wait":
      return waitBodyOf(task, context);
  }
}
