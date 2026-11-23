import type {
  EffectAnswer,
  EventOffer,
  Inbound,
  PlayedTurn,
  RunEnding,
  RunTurn,
} from "../../../domain/automation/instances/interfaces.js";
import type { WaitEnd } from "../../../domain/automation/instances/enums.js";
import type { WorkflowInstance } from "../../../domain/automation/instances/workflow-instance.js";
import type { RunSecrets } from "../../../domain/automation/secrets/run-secrets.js";
import type { WorkflowVersion } from "../../../domain/automation/workflows/workflow-version.js";
import type {
  JsonObject,
  JsonValue,
} from "../../../domain/automation/interfaces.js";
import type { AcceptedEvent } from "../events/interfaces.js";
import type { EffectResult } from "./enums.js";
import type {
  ChildRequest,
  EffectCall,
  InputProblem,
  Receipt,
} from "./interfaces.js";

export abstract class WorkflowInstanceRepository {
  abstract find(id: string): Promise<WorkflowInstance | null>;
  abstract findChild(
    parentId: string,
    effectId: string,
  ): Promise<WorkflowInstance | null>;
  abstract findAwaitedChildren(parentId: string): Promise<WorkflowInstance[]>;
  abstract findEndedChildren(
    parent: WorkflowInstance,
  ): Promise<WorkflowInstance[]>;
  abstract hasUnendedScheduled(workflowId: string): Promise<boolean>;
  abstract save(instance: WorkflowInstance): Promise<void>;
  abstract remove(instance: WorkflowInstance): Promise<void>;
}

export abstract class ChildCancellations {
  abstract request(children: readonly WorkflowInstance[]): Promise<void>;
}

export abstract class ReceivedMessages {
  abstract append(
    instance: WorkflowInstance,
    execution: string,
    inbound: Inbound,
    fence: number,
  ): Promise<number | null>;
  abstract awaitedBy(instance: WorkflowInstance): Promise<readonly Receipt[]>;
  abstract forget(
    instance: WorkflowInstance,
    receipts: readonly Receipt[],
  ): Promise<void>;
}

export abstract class InstanceEvents {
  abstract dispatch(instance: WorkflowInstance): Promise<void>;
}

export abstract class InstanceRuns {
  abstract respond(
    instance: WorkflowInstance,
    answer: EffectAnswer,
  ): Promise<void>;
  abstract detach(
    instance: WorkflowInstance,
    effectId: string,
    request: JsonObject,
  ): Promise<void>;
  abstract receive(instance: WorkflowInstance): Promise<void>;
  abstract fail(instance: WorkflowInstance): Promise<void>;
}

export abstract class EffectClient {
  abstract perform(request: JsonObject, call: EffectCall): Promise<JsonObject>;
  abstract performDetached(
    request: JsonObject,
    call: EffectCall,
  ): Promise<void>;
}

export abstract class WorkflowRuntime {
  abstract begin(
    instance: WorkflowInstance,
    secrets: RunSecrets,
    now: Date,
    signal: AbortSignal,
  ): Promise<RunTurn>;
  abstract respond(
    instance: WorkflowInstance,
    answer: EffectAnswer,
    secrets: RunSecrets,
    now: Date,
    signal: AbortSignal,
  ): Promise<PlayedTurn>;
  abstract receive(
    instance: WorkflowInstance,
    receipt: Receipt,
    secrets: RunSecrets,
    now: Date,
    signal: AbortSignal,
  ): Promise<PlayedTurn>;
  abstract offer(
    instance: WorkflowInstance,
    offer: EventOffer,
    secrets: RunSecrets,
    now: Date,
    signal: AbortSignal,
  ): Promise<PlayedTurn>;
  abstract answerChild(
    parent: WorkflowInstance,
    child: WorkflowInstance,
    secrets: RunSecrets,
    now: Date,
    signal: AbortSignal,
  ): Promise<PlayedTurn>;
  abstract suspend(
    instance: WorkflowInstance,
    secrets: RunSecrets,
    now: Date,
  ): Promise<PlayedTurn>;
  abstract resume(
    instance: WorkflowInstance,
    secrets: RunSecrets,
    now: Date,
  ): Promise<PlayedTurn>;
  abstract cancel(
    instance: WorkflowInstance,
    secrets: RunSecrets,
    now: Date,
    signal: AbortSignal | null,
  ): Promise<PlayedTurn>;
  abstract accepts(
    version: WorkflowVersion,
    event: AcceptedEvent,
    secrets: RunSecrets,
    now: Date,
    signal: AbortSignal,
  ): Promise<boolean>;
  abstract inputProblemsOf(
    version: WorkflowVersion,
    input: JsonValue,
  ): Promise<readonly InputProblem[]>;
  abstract faultedEnding(
    instance: WorkflowInstance,
    now: Date,
  ): Promise<RunEnding>;
  abstract childOf(request: JsonObject): ChildRequest;
  abstract eventOf(request: JsonObject): JsonObject;
  abstract outcomeOf(result: EffectResult | WaitEnd): JsonObject;
}
