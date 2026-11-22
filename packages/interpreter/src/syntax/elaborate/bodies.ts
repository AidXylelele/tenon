import {
  defaults,
  readModes,
  returnModes,
  type TaskKind,
} from "../../standard/index.js";
import type {
  CallTask,
  DoTask,
  EmitTask,
  ForkTask,
  ForTask,
  ListenTask,
  RaiseTask,
  RunTask,
  SetTask,
  SwitchCase,
  SwitchTask,
  TaskBody,
  TryTask,
  WaitTask,
} from "../ast/index.js";
import { kindOf } from "../grammar/index.js";
import { callOf } from "./calls.js";
import { directiveOf } from "./directives.js";
import { durationOf } from "./durations.js";
import { catchOf, errorOf } from "./errors.js";
import { eventPropertiesOf, iteratorOf, strategyOf } from "./events.js";
import {
  itemsOf,
  objectOf,
  optionalAt,
  requiredAt,
  requiredFieldOf,
  soleFieldOf,
  uncheckedOf,
} from "./parts.js";
import { processOf } from "./processes.js";
import { booleanOf, optionalMemberAt, textOf } from "./scalars.js";
import { taskListOf } from "./tasks.js";
import type { Part } from "./types.js";
import { expressionOf, transformOf } from "./values.js";

export function bodyOf(task: Part): TaskBody {
  const kind = taskKindOf(task);

  switch (kind) {
    case "call":
      return callTaskOf(task);
    case "do":
      return doTaskOf(task);
    case "emit":
      return emitTaskOf(task);
    case "for":
      return forTaskOf(task);
    case "fork":
      return forkTaskOf(task);
    case "listen":
      return listenTaskOf(task);
    case "raise":
      return raiseTaskOf(task);
    case "run":
      return runTaskOf(task);
    case "set":
      return setTaskOf(task);
    case "switch":
      return switchTaskOf(task);
    case "try":
      return tryTaskOf(task);
    case "wait":
      return waitTaskOf(task);
  }
}

function taskKindOf(task: Part): TaskKind {
  const definition = objectOf(task);
  const kind = kindOf(definition);

  if (kind === null) {
    throw uncheckedOf(task.pointer);
  }

  return kind;
}

function callTaskOf(task: Part): CallTask {
  const call = callOf(task);
  return { kind: "call", call };
}

function doTaskOf(task: Part): DoTask {
  const tasks = requiredAt(task, "do", taskListOf);
  return { kind: "do", do: tasks };
}

function emitTaskOf(task: Part): EmitTask {
  const emit = requiredFieldOf(task, "emit");
  const event = requiredFieldOf(emit, "event");
  const properties = requiredAt(event, "with", eventPropertiesOf);

  return { kind: "emit", event: properties };
}

function forTaskOf(task: Part): ForTask {
  const loop = requiredFieldOf(task, "for");
  const each = optionalAt(loop, "each", textOf) ?? defaults.forEach;
  const collection = requiredAt(loop, "in", transformOf);
  const at = optionalAt(loop, "at", textOf) ?? defaults.forAt;
  const condition = optionalAt(task, "while", expressionOf);
  const tasks = requiredAt(task, "do", taskListOf);

  return {
    kind: "for",
    each,
    in: collection,
    at,
    while: condition,
    do: tasks,
  };
}

function forkTaskOf(task: Part): ForkTask {
  const fork = requiredFieldOf(task, "fork");
  const branches = requiredAt(fork, "branches", taskListOf);
  const compete =
    optionalAt(fork, "compete", booleanOf) ?? defaults.forkCompete;

  return { kind: "fork", branches, compete };
}

function listenTaskOf(task: Part): ListenTask {
  const listen = requiredFieldOf(task, "listen");
  const to = requiredAt(listen, "to", strategyOf);
  const read =
    optionalMemberAt(listen, "read", readModes) ?? defaults.listenRead;
  const foreach = optionalAt(task, "foreach", iteratorOf);

  return { kind: "listen", to, read, foreach };
}

function raiseTaskOf(task: Part): RaiseTask {
  const raise = requiredFieldOf(task, "raise");
  const error = requiredAt(raise, "error", errorOf);

  return { kind: "raise", error };
}

function runTaskOf(task: Part): RunTask {
  const run = requiredFieldOf(task, "run");
  const process = processOf(run);
  const awaited = optionalAt(run, "await", booleanOf) ?? defaults.runAwait;
  const result =
    optionalMemberAt(run, "return", returnModes) ?? defaults.runReturn;

  return { kind: "run", process, await: awaited, return: result };
}

function setTaskOf(task: Part): SetTask {
  const set = requiredAt(task, "set", transformOf);
  return { kind: "set", set };
}

function switchTaskOf(task: Part): SwitchTask {
  const items = requiredAt(task, "switch", itemsOf);
  const cases = items.map(caseOf);

  return { kind: "switch", switch: cases };
}

function caseOf(item: Part): SwitchCase {
  const { name, part } = soleFieldOf(item);
  const when = optionalAt(part, "when", expressionOf);
  const then = requiredAt(part, "then", directiveOf);

  return { pointer: part.pointer, name, when, then };
}

function tryTaskOf(task: Part): TryTask {
  const tasks = requiredAt(task, "try", taskListOf);
  const handler = requiredAt(task, "catch", catchOf);

  return { kind: "try", try: tasks, catch: handler };
}

function waitTaskOf(task: Part): WaitTask {
  const wait = requiredAt(task, "wait", durationOf);
  return { kind: "wait", wait };
}
