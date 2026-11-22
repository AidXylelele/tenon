import type { JsonObject, JsonValue } from "../interfaces.js";
import type {
  CancelReason,
  InboundKind,
  InstanceEventKind,
  Phase,
  TaskValueKind,
  TriggerKind,
  TurnStatus,
  WaitKind,
} from "./enums.js";
import type { Run } from "./run.js";

export interface WorkflowInstanceProps {
  readonly id: string;
  readonly workflowId: string;
  readonly versionId: string;
  readonly trigger: TriggerKind;
  readonly starterId: string | null;
  readonly originId: string | null;
  readonly originEffectId: string | null;
  readonly input: JsonValue;
  readonly phase: Phase;
  readonly output: JsonValue | null;
  readonly error: JsonObject | null;
  readonly createdAt: Date;
  readonly startedAt: Date | null;
  readonly endedAt: Date | null;
  readonly cancelReason: CancelReason | null;
  readonly run: Run | null;
  readonly test: boolean;
  readonly version: number;
}

export interface InstanceEvent {
  readonly kind: InstanceEventKind;
  readonly instanceId: string;
  readonly parentId: string | null;
}

export interface RunWait {
  readonly effectId: string;
  readonly kind: WaitKind;
  readonly until: number | null;
  readonly stream: string | null;
  readonly retryOf: string | null;
  readonly execution: string | null;
  readonly position: number | null;
}

export interface AwaitedEffect {
  readonly id: string;
  readonly request: JsonObject;
  readonly wait: RunWait | null;
}

export interface OpenFilter {
  readonly level: number;
  readonly filter: number;
}

export interface Receiving {
  readonly execution: string;
  readonly request: JsonObject;
  readonly closesAt: number | null;
}

export interface TaskValue {
  readonly execution: string;
  readonly kind: TaskValueKind;
  readonly value: JsonValue;
}

export interface InboundMessage {
  readonly payload: JsonValue;
  readonly headers: JsonObject;
  readonly correlationId: string | null;
}

export type Inbound =
  | { readonly kind: InboundKind.Message; readonly message: InboundMessage }
  | { readonly kind: InboundKind.Failure; readonly failure: JsonObject };

export interface Listening {
  readonly effectId: string;
  readonly execution: string;
  readonly stream: string;
  readonly position: number;
  readonly open: readonly OpenFilter[];
}

export interface TakenEvent {
  readonly eventId: string;
  readonly execution: string;
}

export interface LifecycleEvent {
  readonly name: string;
  readonly types: readonly string[];
  readonly data: JsonObject;
  readonly execution: string | null;
}

export interface EffectAnswer {
  readonly effectId: string;
  readonly outcome: JsonObject;
}

export interface EventOffer {
  readonly eventId: string;
  readonly event: JsonObject;
  readonly candidates: readonly string[];
}

export interface RunTurn {
  readonly status: Exclude<TurnStatus, TurnStatus.Stranded>;
  readonly fingerprint: string;
  readonly format: number;
  readonly memento: JsonObject;
  readonly requested: readonly AwaitedEffect[];
  readonly listening: readonly Listening[];
  readonly receiving: readonly Receiving[];
  readonly endedExecutions: readonly string[];
  readonly taskValues: readonly TaskValue[];
  readonly answered: readonly string[];
  readonly withdrawn: readonly string[];
  readonly abandoned: readonly string[];
  readonly taken: TakenEvent | null;
  readonly events: readonly LifecycleEvent[];
  readonly output: JsonValue | null;
  readonly error: JsonObject | null;
}

export interface RunEnding {
  readonly events: readonly LifecycleEvent[];
  readonly error: JsonObject | null;
}

interface StrandedTurn {
  readonly status: TurnStatus.Stranded;
  readonly ending: RunEnding;
}

export type PlayedTurn = RunTurn | StrandedTurn;

export interface RunProps {
  readonly fingerprint: string;
  readonly format: number;
  readonly memento: JsonObject;
  readonly awaited: readonly AwaitedEffect[];
  readonly listening: readonly Listening[];
  readonly receiving: readonly Receiving[];
  readonly taken: readonly TakenEvent[];
  readonly secretTexts: readonly string[];
  readonly output: JsonValue | null;
  readonly error: JsonObject | null;
}

export interface ProgramReference {
  readonly versionId: string;
}

export interface RoutingMatch {
  readonly versionId: string;
  readonly stream: string;
  readonly level: number;
  readonly filter: number;
}

export interface RunAgenda {
  readonly instanceId: string;
  readonly ended: boolean;
  readonly awaited: readonly AwaitedEffect[];
}
