import { TaskInstance } from '../../../domain/automation/instances/task-instance.js';
import { JsonPointer } from '../../../domain/automation/language/json-pointer.js';
import { Phase } from '../../../domain/automation/language/phase.js';
import type { TaskInstanceRow } from '../interfaces.js';
import { TaskProgressMapper } from './progress/task-progress.mapper.js';
import { WorkflowErrorMapper } from './progress/workflow-error.mapper.js';

export class TaskInstanceMapper {
  static toRow(task: TaskInstance, instanceId: string): TaskInstanceRow {
    const progress = TaskProgressMapper.toState(task.progress);
    const error = WorkflowErrorMapper.toState(task.error);
    return {
      id: task.id,
      instanceId,
      execution: task.execution,
      reference: task.reference.toString(),
      name: task.name,
      parentId: task.parentId,
      phase: task.phase?.name ?? null,
      rawInput: task.rawInput,
      variables: task.variables,
      output: task.output,
      error,
      retries: task.retries,
      progress,
      startedAt: task.startedAt,
      endedAt: task.endedAt,
    };
  }

  static toEntity(row: TaskInstanceRow): TaskInstance {
    const reference = JsonPointer.parse(row.reference);
    const progress = TaskProgressMapper.toDomain(row.progress);
    const cancelled = row.phase === Phase.Cancelled.name;
    return new TaskInstance({
      id: row.id,
      execution: row.execution,
      reference,
      name: row.name,
      parentId: row.parentId,
      cancelled,
      rawInput: row.rawInput ?? null,
      variables: row.variables,
      retries: row.retries,
      startedAt: row.startedAt,
      endedAt: row.endedAt,
      progress,
    });
  }
}
