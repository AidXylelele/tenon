import type { JsonObject } from "../../api/index.js";
import type { ReadMode, ReturnMode, TaskKind } from "../../standard/index.js";
import type { Call } from "./calls.js";
import type {
  Duration,
  Export,
  Expression,
  Input,
  Output,
  Reference,
  ValueTemplate,
} from "./data.js";
import type { Catch, ErrorDefinition, Timeout } from "./errors.js";
import type {
  ConsumptionStrategy,
  EventProperties,
  SubscriptionIterator,
} from "./events.js";
import type { Directive } from "./flow.js";
import type { Process } from "./processes.js";

export interface TaskList {
  readonly pointer: string;
  readonly tasks: readonly Task[];
}

export interface TaskCommon {
  readonly pointer: string;
  readonly name: string;
  readonly if: Expression | null;
  readonly input: Input;
  readonly output: Output;
  readonly export: Export;
  readonly timeout: Timeout | Reference | null;
  readonly then: Directive;
  readonly metadata: JsonObject;
}

export interface CallTask {
  readonly kind: "call";
  readonly call: Call;
}

export interface DoTask {
  readonly kind: "do";
  readonly do: TaskList;
}

export interface EmitTask {
  readonly kind: "emit";
  readonly event: EventProperties;
}

export interface ForTask {
  readonly kind: "for";
  readonly each: string;
  readonly in: ValueTemplate;
  readonly at: string;
  readonly while: Expression | null;
  readonly do: TaskList;
}

export interface ForkTask {
  readonly kind: "fork";
  readonly branches: TaskList;
  readonly compete: boolean;
}

export interface ListenTask {
  readonly kind: "listen";
  readonly to: ConsumptionStrategy;
  readonly read: ReadMode;
  readonly foreach: SubscriptionIterator | null;
}

export interface RaiseTask {
  readonly kind: "raise";
  readonly error: ErrorDefinition | Reference;
}

export interface RunTask {
  readonly kind: "run";
  readonly process: Process;
  readonly await: boolean;
  readonly return: ReturnMode;
}

export interface SetTask {
  readonly kind: "set";
  readonly set: ValueTemplate;
}

export interface SwitchTask {
  readonly kind: "switch";
  readonly switch: readonly SwitchCase[];
}

export interface SwitchCase {
  readonly pointer: string;
  readonly name: string;
  readonly when: Expression | null;
  readonly then: Directive;
}

export interface TryTask {
  readonly kind: "try";
  readonly try: TaskList;
  readonly catch: Catch;
}

export interface WaitTask {
  readonly kind: "wait";
  readonly wait: Duration;
}

interface TaskBodies {
  readonly call: CallTask;
  readonly do: DoTask;
  readonly emit: EmitTask;
  readonly for: ForTask;
  readonly fork: ForkTask;
  readonly listen: ListenTask;
  readonly raise: RaiseTask;
  readonly run: RunTask;
  readonly set: SetTask;
  readonly switch: SwitchTask;
  readonly try: TryTask;
  readonly wait: WaitTask;
}

export type TaskBody = TaskBodies[TaskKind];

export type Task = TaskCommon & TaskBody;
