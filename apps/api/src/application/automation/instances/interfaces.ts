import type {
  Control,
  InstanceRefusal,
  Phase,
  TriggerKind,
  WaitKind,
} from "../../../domain/automation/instances/enums.js";
import type {
  EffectAnswer,
  Inbound,
  RunAgenda,
  RunWait,
} from "../../../domain/automation/instances/interfaces.js";
import type {
  JsonObject,
  JsonValue,
} from "../../../domain/automation/interfaces.js";
import type { StartRefusal } from "../../../domain/automation/workflows/interfaces.js";
import type { WorkflowName } from "../../../domain/automation/workflows/workflow-name.js";
import type { Result } from "../../../domain/interfaces.js";
import type { Person } from "../../identity/interfaces.js";
import type { Missing } from "../enums.js";
import type { TaskStatus } from "./enums.js";

export interface StartInstanceCommand {
  readonly name: WorkflowName;
  readonly version: string | null;
  readonly input: JsonValue;
  readonly starterId: string;
}

interface StartedInstance {
  readonly instanceId: string;
}

export type StartResult = Result<StartedInstance, StartRefusal | Missing>;

export interface InputProblem {
  readonly pointer: string;
  readonly detail: string;
}

export type StartInstanceResult = Result<
  StartedInstance,
  StartRefusal | Missing | readonly InputProblem[]
>;

export interface InstanceCommand {
  readonly instanceId: string;
}

export interface CancelInstanceCommand extends InstanceCommand {
  readonly signal: AbortSignal | null;
}

export interface RestartInstanceCommand {
  readonly instanceId: string;
  readonly starterId: string;
}

export type InstanceResult = Result<void, InstanceRefusal | Missing>;

export interface RunCommand {
  readonly instanceId: string;
  readonly signal: AbortSignal;
}

export type AgendaResult = Result<RunAgenda, Missing>;

export interface RespondCommand extends RunCommand {
  readonly answer: EffectAnswer;
}

export interface OfferCommand extends RunCommand {
  readonly sequence: number;
  readonly candidates: readonly string[];
}

export interface StartChildCommand {
  readonly parentId: string;
  readonly effectId: string;
  readonly name: WorkflowName;
  readonly version: string | null;
  readonly input: JsonValue;
  readonly trigger: TriggerKind;
}

export interface InstanceSummary {
  readonly id: string;
  readonly namespace: string;
  readonly name: string;
  readonly version: string;
  readonly phase: Phase;
  readonly trigger: TriggerKind;
  readonly createdAt: Date;
  readonly startedAt: Date | null;
  readonly endedAt: Date | null;
}

export interface InstanceWait {
  readonly kind: WaitKind;
  readonly until: Date | null;
  readonly stream: string | null;
  readonly instanceId: string | null;
}

export interface InstanceDetail extends InstanceSummary {
  readonly input: JsonValue;
  readonly output: JsonValue | null;
  readonly error: JsonObject | null;
  readonly originId: string | null;
  readonly startedBy: Person | null;
  readonly controls: readonly Control[];
  readonly cancelReason: string | null;
  readonly waits: readonly InstanceWait[];
}

export interface PhaseCount {
  readonly phase: Phase;
  readonly count: number;
}

export interface InstanceFilter {
  readonly namespace: string | null;
  readonly name: string | null;
  readonly version: string | null;
  readonly phase: Phase | null;
  readonly startedFrom: Date | null;
  readonly startedTo: Date | null;
}

export interface InstancePosition {
  readonly createdAt: Date;
  readonly id: string;
}

export interface InstancePage {
  readonly items: readonly InstanceSummary[];
  readonly next: InstancePosition | null;
}

export interface TaskRecordView {
  readonly execution: string;
  readonly reference: string;
  readonly name: string;
  readonly status: TaskStatus;
  readonly error: JsonObject | null;
  readonly startedAt: Date;
  readonly endedAt: Date | null;
  readonly attempt: number;
  readonly input: JsonValue | null;
  readonly output: JsonValue | null;
  readonly retryAt: Date | null;
}

export interface TaskOutput {
  readonly value: JsonValue;
}

export interface TaskPage {
  readonly items: readonly TaskRecordView[];
  readonly next: number | null;
}

export interface Receipt {
  readonly wait: RunWait;
  readonly inbound: Inbound;
}

export interface ReceiveInboundCommand {
  readonly instanceId: string;
  readonly execution: string;
  readonly inbound: Inbound;
  readonly fence: number;
}

export interface ReceiverView {
  readonly instanceId: string;
  readonly execution: string;
  readonly request: JsonObject;
  readonly closesAt: Date | null;
}
