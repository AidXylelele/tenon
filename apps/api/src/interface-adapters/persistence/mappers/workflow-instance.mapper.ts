import type { TaskInstance } from '../../../domain/automation/instances/task-instance.js';
import { WorkflowInstance } from '../../../domain/automation/instances/workflow-instance.js';
import { Phase } from '../../../domain/automation/language/phase.js';
import { WorkflowName } from '../../../domain/automation/language/workflow-name.js';
import type { WorkflowInstanceRow } from '../interfaces.js';
import { OriginMapper } from './origin.mapper.js';
import { WorkflowErrorMapper } from './progress/workflow-error.mapper.js';

export class WorkflowInstanceMapper {
  static toRow(instance: WorkflowInstance): WorkflowInstanceRow {
    const error = WorkflowErrorMapper.toState(instance.error);
    const origin = OriginMapper.toState(instance.origin);
    return {
      id: instance.id,
      workflowId: instance.workflowId,
      versionId: instance.versionId,
      namespace: instance.workflow.namespace,
      name: instance.workflow.name,
      semver: instance.semver,
      phase: instance.phase.name,
      input: instance.input,
      output: instance.output,
      error,
      context: instance.context,
      origin,
      startedAt: instance.startedAt,
      endedAt: instance.endedAt,
      sequence: instance.sequence,
      executions: instance.executions,
      rounds: instance.rounds,
      version: instance.version,
    };
  }

  static toEntity(
    row: WorkflowInstanceRow,
    tasks: readonly TaskInstance[],
  ): WorkflowInstance {
    const workflow = new WorkflowName(row.namespace, row.name);
    const phase = Phase.named(row.phase);
    const error = WorkflowErrorMapper.toDomain(row.error);
    const origin = OriginMapper.toDomain(row.origin);
    return new WorkflowInstance({
      id: row.id,
      workflowId: row.workflowId,
      versionId: row.versionId,
      workflow,
      semver: row.semver,
      phase,
      input: row.input ?? null,
      output: row.output ?? null,
      error,
      context: row.context ?? null,
      origin,
      startedAt: row.startedAt,
      endedAt: row.endedAt,
      sequence: row.sequence,
      executions: row.executions,
      rounds: row.rounds,
      tasks,
      version: row.version,
    });
  }
}
