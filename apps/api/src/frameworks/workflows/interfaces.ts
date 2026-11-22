import type { WorkflowContext } from "@nestjs/workflows";
import type { EffectOutcome, JsonObject } from "interpreter";
import type { RunAgendaView } from "../../interface-adapters/workflows/interfaces.js";
import type { SandboxedProcessRequest } from "../go-judge/interfaces.js";

export interface StepCall {
  readonly idempotencyKey: string;
  readonly signal: AbortSignal;
  readonly secrets: JsonObject;
}

export interface CallContext extends StepCall {
  readonly remaining: number | null;
}

export interface OpenWorkflowRunInput {
  readonly instanceId: string;
  readonly generation: number;
}

export interface Performed {
  readonly id: string;
  readonly outcome: EffectOutcome;
  readonly attempt: number;
  readonly at: number;
  readonly order: number;
}

export interface Turn {
  readonly agenda: RunAgendaView;
  readonly entries: number;
  readonly bytes: number;
}

export interface Generation {
  readonly ctx: WorkflowContext;
  readonly instanceId: string;
  readonly secrets: JsonObject;
  readonly children: Set<string>;
}

export interface ProcessRunInput {
  readonly request: SandboxedProcessRequest;
  readonly secrets: JsonObject;
}

export interface ScheduleRunInput {
  readonly workflowId: string;
  readonly delayMs: number;
  readonly chained: boolean;
}

export interface DeliveryRunInput {
  readonly subscriptionId: string;
  readonly sequence: number;
}
