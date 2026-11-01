import type { WorkflowInstance } from '../../../domain/automation/instances/workflow-instance.js';
import type {
  ProcessRun,
  ServiceCall,
} from '../../../domain/automation/language/interfaces.js';
import type { ProcessResult } from '../../../domain/automation/language/results/process-result.js';
import type { ServiceResult } from '../../../domain/automation/language/results/service-result.js';

export abstract class WorkflowInstanceRepository {
  abstract find(id: string): Promise<WorkflowInstance | null>;
  abstract save(instance: WorkflowInstance): Promise<void>;
}

export abstract class InstanceRuns {
  abstract start(instanceId: string): Promise<void>;
}

export abstract class ServiceCaller {
  abstract callAll(
    calls: readonly ServiceCall[],
  ): Promise<readonly ServiceResult[]>;
}

export abstract class ProcessRunner {
  abstract runAll(
    runs: readonly ProcessRun[],
  ): Promise<readonly ProcessResult[]>;
}
