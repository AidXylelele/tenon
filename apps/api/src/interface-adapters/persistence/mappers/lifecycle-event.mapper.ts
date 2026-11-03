import { randomUUID } from 'node:crypto';
import { TaskStatus } from '../../../application/automation/instances/enums.js';
import type { TaskRecord } from '../../../application/automation/instances/ports.js';
import type { CloudEvent } from '../../../application/automation/events/ports.js';
import { InstanceEventKind } from '../../../domain/automation/instances/enums.js';
import type { WorkflowInstance } from '../../../domain/automation/instances/workflow-instance.js';
import type { JsonValue } from '../../../domain/automation/json.js';

export interface InstanceNames {
  readonly namespace: string;
  readonly name: string;
  readonly version: string;
}

// The standard's lifecycle events (DSL 1.0.3, "Lifecycle Events") as CloudEvents 1.0, from an
// instance's changes and its tasks' records.
export class LifecycleEventMapper {
  static readonly #TYPE = 'io.serverlessworkflow.';
  static readonly #VERSION = '.v1';
  static readonly #WORKFLOW = new Map<InstanceEventKind, string>([
    [InstanceEventKind.Started, 'started'],
    [InstanceEventKind.Suspended, 'suspended'],
    [InstanceEventKind.Resumed, 'resumed'],
    [InstanceEventKind.Cancelled, 'cancelled'],
    [InstanceEventKind.Faulted, 'faulted'],
    [InstanceEventKind.Completed, 'completed'],
  ]);
  static readonly #ENDS = new Set<InstanceEventKind>([
    InstanceEventKind.Completed,
    InstanceEventKind.Faulted,
    InstanceEventKind.Cancelled,
  ]);
  static readonly #FIRST_ATTEMPT = 1;
  static readonly #TASK = new Map<TaskStatus, string>([
    [TaskStatus.Running, 'started'],
    [TaskStatus.Completed, 'completed'],
    [TaskStatus.Faulted, 'faulted'],
    [TaskStatus.Cancelled, 'cancelled'],
  ]);

  // The event of an instance's change, or null for a change the standard has no event for.
  // A start and an end happen when the instance says; a suspend or a resume when it is saved.
  static timeOf(
    kind: InstanceEventKind,
    instance: WorkflowInstance,
    now: Date,
  ): Date {
    if (kind === InstanceEventKind.Started) return instance.startedAt ?? now;

    if (LifecycleEventMapper.#ENDS.has(kind)) return instance.endedAt ?? now;

    return now;
  }

  static ofInstance(
    kind: InstanceEventKind,
    instance: WorkflowInstance,
    names: InstanceNames,
    at: Date,
  ): CloudEvent | null {
    const change = LifecycleEventMapper.#WORKFLOW.get(kind);

    if (change === undefined) return null;

    const name = LifecycleEventMapper.#qualified(instance.id, names);
    const time = at.toISOString();
    const data: Record<string, JsonValue> = { name };
    data[`${change}At`] = time;

    if (kind === InstanceEventKind.Started)
      data.definition = {
        namespace: names.namespace,
        name: names.name,
        version: names.version,
      };

    if (kind === InstanceEventKind.Faulted) data.error = instance.error;

    if (kind === InstanceEventKind.Completed) data.output = instance.output;

    return LifecycleEventMapper.#event(
      `workflow.${change}`,
      instance.id,
      names,
      time,
      data,
    );
  }

  // A task's event, or null for a skipped task, which enters no phase (FR-015).
  static ofTask(
    instanceId: string,
    names: InstanceNames,
    task: TaskRecord,
  ): CloudEvent | null {
    const change = LifecycleEventMapper.#TASK.get(task.status);

    if (change === undefined) return null;

    // A retry's own changes are not the task's: the standard's `task.retried` tells them, which
    // the platform does not produce yet.
    const retrying = LifecycleEventMapper.#retrying(task);

    if (retrying) return null;

    const time = task.at.toISOString();
    const data: Record<string, JsonValue> = {
      workflow: LifecycleEventMapper.#qualified(instanceId, names),
      task: task.reference,
    };
    data[`${change}At`] = time;

    if (task.status === TaskStatus.Faulted) data.error = task.error;

    if (task.status === TaskStatus.Completed) data.output = task.output;

    return LifecycleEventMapper.#event(
      `task.${change}`,
      instanceId,
      names,
      time,
      data,
    );
  }

  // A later attempt's start, or a fault a `try` retries, which faults no task.
  static #retrying(task: TaskRecord): boolean {
    const laterStart =
      task.status === TaskStatus.Running &&
      task.attempt > LifecycleEventMapper.#FIRST_ATTEMPT;
    const retriedFault =
      task.status === TaskStatus.Faulted && task.retryAt !== null;
    return laterStart || retriedFault;
  }

  // The source every lifecycle event of an instance has, which emitted events may not take.
  static sourceOf(instanceId: string, names: InstanceNames): string {
    return `/workflows/${names.namespace}/${names.name}/instances/${instanceId}`;
  }

  static #event(
    change: string,
    instanceId: string,
    names: InstanceNames,
    time: string,
    data: JsonValue,
  ): CloudEvent {
    return {
      specversion: '1.0',
      id: randomUUID(),
      source: LifecycleEventMapper.sourceOf(instanceId, names),
      type: `${LifecycleEventMapper.#TYPE}${change}${LifecycleEventMapper.#VERSION}`,
      time,
      datacontenttype: 'application/json',
      data,
    };
  }

  static #qualified(instanceId: string, names: InstanceNames): string {
    return `${instanceId}.${names.namespace}`;
  }
}
