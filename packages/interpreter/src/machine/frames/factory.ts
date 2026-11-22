import type { JsonValue } from "../../api/index.js";
import type { Perform } from "../../core/index.js";
import type { PerformKey } from "../identity/index.js";
import type {
  AfterK,
  Attempt,
  AwaitK,
  BeforeK,
  BranchK,
  DeadlineK,
  ExportK,
  HandleK,
  InvokeK,
  JoinK,
  Joined,
  LoopK,
  PerformAnswer,
  ReceiveK,
  RetryK,
  SequenceK,
  StagesK,
  StreamItem,
  StreamItemK,
  StreamK,
  TaskK,
  TaskListK,
  TriggerK,
  UnlimitedWindow,
  UnopenedWindow,
  ValidateK,
  WindowUntil,
  WorkflowK,
} from "./frames.js";
import type {
  Acceptances,
  Consumption,
  Expectation,
  StreamWindow,
} from "./streams.js";

type Parts<F> = Omit<F, "kind">;

export function sequenceK(parts: Parts<SequenceK>): SequenceK {
  return {
    kind: "sequence",
    rest: parts.rest,
    signal: parts.signal,
    scope: parts.scope,
  };
}

export function taskListK(parts: Parts<TaskListK>): TaskListK {
  return {
    kind: "taskList",
    list: parts.list,
    index: parts.index,
    visits: parts.visits,
    scope: parts.scope,
  };
}

export function taskK(parts: Parts<TaskK>): TaskK {
  return { kind: "task", task: parts.task, activation: parts.activation };
}

export function validateK(parts: Parts<ValidateK>): ValidateK {
  return { kind: "validate", subject: parts.subject };
}

export function exportK(parts: Parts<ExportK>): ExportK {
  return { kind: "export", context: parts.context, value: parts.value };
}

export function loopK(parts: Parts<LoopK>): LoopK {
  return {
    kind: "loop",
    loop: parts.loop,
    items: parts.items,
    index: parts.index,
    scope: parts.scope,
  };
}

export function performAnswerOf(
  key: PerformKey,
  perform: Perform,
  carried: JsonValue,
): PerformAnswer {
  return { kind: "perform", at: key.at, perform, carried };
}

export function awaitK(parts: Parts<AwaitK>): AwaitK {
  return { kind: "await", effect: parts.effect, activation: parts.activation };
}

export const unopenedRetries: UnopenedWindow = { kind: "unopened" };

export const unlimitedRetries: UnlimitedWindow = { kind: "unlimited" };

export function retriesUntil(instant: number): WindowUntil {
  return { kind: "until", instant };
}

export function attemptOf(parts: Attempt): Attempt {
  return {
    number: parts.number,
    input: parts.input,
    firstStarted: parts.firstStarted,
    window: parts.window,
  };
}

export function handleK(parts: Parts<HandleK>): HandleK {
  return {
    kind: "handle",
    handle: parts.handle,
    attempt: parts.attempt,
    scope: parts.scope,
  };
}

export function retryK(parts: Parts<RetryK>): RetryK {
  return {
    kind: "retry",
    handle: parts.handle,
    attempt: parts.attempt,
    scope: parts.scope,
  };
}

export function deadlineK(parts: Parts<DeadlineK>): DeadlineK {
  return { kind: "deadline", instant: parts.instant };
}

export const pendingBranch: Joined = { kind: "pending" };

export function joinedOutput(output: JsonValue): Joined {
  return { kind: "joined", output };
}

export function joinK(parts: Parts<JoinK>): JoinK {
  return {
    kind: "join",
    parallel: parts.parallel,
    branches: parts.branches,
    outputs: parts.outputs,
  };
}

export function branchK(parts: Parts<BranchK>): BranchK {
  return { kind: "branch", index: parts.index };
}

export const noUntil: Acceptances["until"] = { kind: "none" };

export function acceptancesOf(
  own: readonly number[],
  until: Acceptances["until"],
): Acceptances {
  return { kind: "strategy", own, until };
}

export function expectationOf(parts: Expectation): Expectation {
  return {
    level: parts.level,
    filter: parts.filter,
    correlation: parts.correlation,
    value: parts.value,
  };
}

export const openWindow: StreamWindow = { kind: "open" };

export function windowClosingAt(instant: number): StreamWindow {
  return { kind: "closesAt", instant };
}

export function consumptionOf(parts: Consumption): Consumption {
  return {
    items: parts.items,
    position: parts.position,
    accepted: parts.accepted,
    keys: parts.keys,
    expected: parts.expected,
  };
}

export function streamK(parts: Parts<StreamK>): StreamK {
  return {
    kind: "stream",
    stream: parts.stream,
    consumption: parts.consumption,
    window: parts.window,
    input: parts.input,
    scope: parts.scope,
  };
}

export function receiveK(parts: Parts<ReceiveK>): ReceiveK {
  return {
    kind: "receive",
    stream: parts.stream,
    consumption: parts.consumption,
    window: parts.window,
    input: parts.input,
    effect: parts.effect,
    scope: parts.scope,
  };
}

export function streamItemOf(value: JsonValue, index: number): StreamItem {
  return { value, index };
}

export function streamItemK(parts: Parts<StreamItemK>): StreamItemK {
  return {
    kind: "streamItem",
    stream: parts.stream,
    iterator: parts.iterator,
    item: parts.item,
    scope: parts.scope,
  };
}

export function beforeK(parts: Parts<BeforeK>): BeforeK {
  return {
    kind: "before",
    extend: parts.extend,
    applying: parts.applying,
    at: parts.at,
    value: parts.value,
    scope: parts.scope,
  };
}

export function stagesK(parts: Parts<StagesK>): StagesK {
  return {
    kind: "stages",
    extend: parts.extend,
    applying: parts.applying,
    scope: parts.scope,
  };
}

export function afterK(parts: Parts<AfterK>): AfterK {
  return {
    kind: "after",
    extend: parts.extend,
    applying: parts.applying,
    at: parts.at,
    completion: parts.completion,
    scope: parts.scope,
  };
}

export const invokeK: InvokeK = { kind: "invoke" };

export function workflowK(parts: Parts<WorkflowK>): WorkflowK {
  return { kind: "workflow", activation: parts.activation };
}

export function triggerK(parts: Parts<TriggerK>): TriggerK {
  return { kind: "trigger", activation: parts.activation };
}
