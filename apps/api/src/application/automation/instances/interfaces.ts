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
  RunWait,
} from "../../../domain/automation/instances/interfaces.js";
import type {
  JsonObject,
  JsonValue,
} from "../../../domain/automation/interfaces.js";
import type { RunSecrets } from "../../../domain/automation/secrets/run-secrets.js";
import type { StartRefusal } from "../../../domain/automation/workflows/interfaces.js";
import type { WorkflowName } from "../../../domain/automation/workflows/workflow-name.js";
import type { Result } from "../../../domain/interfaces.js";
import type { Person } from "../../identity/users/interfaces.js";
import type { Missing } from "../enums.js";
import type { InstanceOrder, TaskStatus } from "./enums.js";

export interface StartInstanceCommand {
  readonly name: WorkflowName;
  readonly version: string | null;
  readonly input: JsonValue;
  readonly starterId: string;
}

export interface StartedInstance {
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

export interface RespondCommand extends RunCommand {
  readonly answer: EffectAnswer;
}

export interface EffectReference {
  readonly instanceId: string;
  readonly effectId: string;
}

export interface EffectCommand extends EffectReference {
  readonly signal: AbortSignal;
}

export interface ChildCommand extends EffectCommand {
  readonly childId: string;
}

export interface TimerCommand extends EffectReference {
  readonly at: number;
}

export interface DetachedProcessCommand extends EffectCommand {
  readonly versionId: string;
  readonly request: JsonObject;
}

export interface EffectCall extends EffectReference {
  readonly signal: AbortSignal;
  readonly secrets: RunSecrets;
}

export interface ChildRequest {
  readonly name: WorkflowName;
  readonly version: string | null;
  readonly input: JsonValue;
  readonly trigger: TriggerKind;
}

export interface OfferCommand extends RunCommand {
  readonly sequence: number;
  readonly candidates: readonly string[];
}

export interface InstanceSummary {
  readonly id: string;
  readonly namespace: string;
  readonly name: string;
  readonly version: string;
  readonly phase: Phase;
  readonly trigger: TriggerKind;
  readonly test: boolean;
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

export interface CountWindow {
  readonly buckets: readonly Date[];
  readonly to: Date;
  readonly previousFrom: Date | null;
  readonly namespace: string | null;
  readonly name: string | null;
  readonly tests: boolean;
}

export interface BucketCount {
  readonly start: Date;
  readonly counts: readonly PhaseCount[];
}

export interface WindowCount {
  readonly from: Date;
  readonly counts: readonly PhaseCount[];
}

export interface InstanceCounts {
  readonly to: Date;
  readonly buckets: readonly BucketCount[];
  readonly total: readonly PhaseCount[];
  readonly previous: WindowCount | null;
  readonly live: readonly PhaseCount[];
}

export interface FailureWindow {
  readonly from: Date;
  readonly to: Date;
  readonly limit: number;
  readonly tests: boolean;
}

export interface FailureCause {
  readonly status: number | null;
  readonly type: string | null;
  readonly title: string | null;
  readonly detail: string | null;
}

export interface FailingWorkflow {
  readonly namespace: string;
  readonly name: string;
  readonly title: string | null;
  readonly failed: number;
  readonly runs: number;
  readonly firstFailedAt: Date;
  readonly lastFailedAt: Date;
  readonly lastError: FailureCause;
  readonly stillFailing: boolean;
}

export interface FailingWorkflows {
  readonly items: readonly FailingWorkflow[];
  readonly workflows: number;
  readonly failed: number;
}

export interface InstanceFilter {
  readonly namespace: string | null;
  readonly name: string | null;
  readonly version: string | null;
  readonly phases: readonly Phase[];
  readonly from: Date | null;
  readonly to: Date | null;
  readonly tests: boolean;
}

export interface InstancePageRequest {
  readonly filter: InstanceFilter;
  readonly order: InstanceOrder;
  readonly page: number;
  readonly limit: number;
}

export interface ListedWait {
  readonly kind: WaitKind;
  readonly until: Date | null;
  readonly stream: string | null;
}

export interface ListedInstance extends InstanceSummary {
  readonly title: string | null;
  readonly startedBy: Person | null;
  readonly durationMs: number | null;
  readonly waits: readonly ListedWait[];
}

export interface InstanceTotal {
  readonly total: number;
  readonly exact: boolean;
}

export interface InstancePage extends InstanceTotal {
  readonly items: readonly ListedInstance[];
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
