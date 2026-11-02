import type { InstanceProgress } from '../../../domain/automation/instances/interfaces.js';
import type { WorkflowInstance } from '../../../domain/automation/instances/workflow-instance.js';
import type {
  JsonObject,
  JsonValue,
  ProcessRun,
  ServiceCall,
} from '../../../domain/automation/language/interfaces.js';
import type { ProcessResult } from '../../../domain/automation/language/results/process-result.js';
import type { ServiceResult } from '../../../domain/automation/language/results/service-result.js';
import type { RoundResults } from '../../../domain/automation/language/round-results.js';
import type { WorkflowName } from '../../../domain/automation/language/workflow-name.js';
import type { WorkflowTarget } from '../../../domain/automation/language/workflow-target.js';
import type { VersionReference } from '../../../domain/automation/workflows/version-reference.js';
import type { SubWorkflowStartKind } from './enums.js';
import type { RoundContext } from '../../../domain/automation/instances/round-context.js';

export interface StartInstanceCommand {
  readonly target: WorkflowTarget;
  readonly input: JsonValue | undefined;
  readonly userId: string;
  readonly key: string | null;
}

export interface AdvanceInstanceCommand {
  readonly instanceId: string;
  readonly runtime: JsonObject;
}

export interface AdvancedInstanceResult {
  readonly progress: InstanceProgress;
  readonly deferred: number;
}

export interface BeginRoundCommand {
  readonly instanceId: string;
  readonly runtime: JsonObject;
  readonly now: Date;
}

export interface BegunRoundResult {
  readonly context: RoundContext;
  readonly instance: WorkflowInstance;
}

// Results that arrived together, and how many calls and processes got none (a full bulkhead).
export interface WorkAnswer {
  readonly results: RoundResults;
  readonly deferred: number;
}

// Results and the time they arrived, which the instance records them at.
export interface RecordedAnswer {
  readonly results: RoundResults;
  readonly at: Date;
}

export interface RecordRoundCommand {
  readonly instanceId: string;
  // The round that produced the results.
  readonly round: number;
  // As of the last answer.
  readonly context: RoundContext;
  readonly recorded: readonly RecordedAnswer[];
}

export interface FaultInstanceCommand {
  readonly instanceId: string;
}

export interface StartSubWorkflowCommand {
  readonly instanceId: string;
  readonly subWorkflowId: string;
  readonly runtime: JsonObject;
}

export interface StartedSubWorkflowResult {
  readonly kind: SubWorkflowStartKind;
}

export interface CompleteSubWorkflowCommand {
  readonly instanceId: string;
  readonly subWorkflowId: string;
  readonly runtime: JsonObject;
}

export interface RunDetachedProcessCommand {
  readonly run: ProcessRun;
}

export interface StartDetachedWorkflowCommand {
  readonly parentId: string;
  readonly taskInstanceId: string;
  readonly subWorkflowId: string;
  readonly workflow: WorkflowName;
  readonly version: VersionReference;
  readonly input: JsonValue;
}

export abstract class WorkflowInstanceRepository {
  abstract find(id: string): Promise<WorkflowInstance | null>;
  // The instance, or InstanceNotFoundError.
  abstract get(id: string): Promise<WorkflowInstance>;
  // The instance with its tasks, its domain events and the events it produced (lifecycle and
  // emitted), in the caller's transaction.
  abstract save(instance: WorkflowInstance): Promise<void>;
}

export abstract class InstanceRuns {
  abstract start(instanceId: string): Promise<void>;
}

// No result: the item is still to be done (a full bulkhead, a sandbox outage), architecture §3.
export abstract class ServiceCaller {
  abstract call(call: ServiceCall): Promise<ServiceResult | null>;
}

export abstract class ProcessRunner {
  abstract run(run: ProcessRun): Promise<ProcessResult | null>;
}
