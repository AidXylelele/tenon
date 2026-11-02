import { EventOriginKind } from '../events/enums.js';
import { Event } from '../events/event.js';
import type { CloudEvent } from '../language/cloud-event.js';
import type { JsonValue } from '../language/interfaces.js';
import type { TaskEnding } from '../language/task-ending.js';
import type { WorkflowError } from '../language/workflow-error.js';
import type {
  LifecycleNotice,
  LifecycleSubject,
  TaskNotice,
} from './interfaces.js';
import { LifecycleEvent } from './lifecycle-event.js';
import { LifecycleEventType } from './lifecycle-event-type.js';
import type { TaskInstance } from './task-instance.js';

// The events a run produces, in their order: the lifecycle events the standard names and the
// events its tasks emit.
export class ProducedEvents {
  readonly #subject: LifecycleSubject;
  readonly #events: Event[];
  #sequence: number;

  constructor(subject: LifecycleSubject, sequence: number) {
    this.#subject = subject;
    this.#sequence = sequence;
    this.#events = [];
  }

  get sequence(): number {
    return this.#sequence;
  }

  workflowStarted(startedAt: Date, now: Date): void {
    this.#announce(
      {
        type: LifecycleEventType.WorkflowStarted,
        task: null,
        time: startedAt,
        error: null,
        output: null,
      },
      now,
    );
  }

  workflowCompleted(output: JsonValue, now: Date): void {
    this.#announce(
      {
        type: LifecycleEventType.WorkflowCompleted,
        task: null,
        time: now,
        error: null,
        output: { value: output },
      },
      now,
    );
  }

  workflowFaulted(error: WorkflowError, now: Date): void {
    this.#announce(
      {
        type: LifecycleEventType.WorkflowFaulted,
        task: null,
        time: now,
        error,
        output: null,
      },
      now,
    );
  }

  taskEntered(task: TaskInstance, now: Date): void {
    const startedAt = task.startedAt;
    this.#announcePlain(task, LifecycleEventType.TaskCreated, startedAt, now);
    this.#announcePlain(task, LifecycleEventType.TaskStarted, startedAt, now);
  }

  taskRetried(task: TaskInstance, now: Date): void {
    this.#announcePlain(task, LifecycleEventType.TaskRetried, now, now);
  }

  taskCancelled(task: TaskInstance, now: Date): void {
    this.#announcePlain(task, LifecycleEventType.TaskCancelled, now, now);
  }

  taskEnded(task: TaskInstance, ending: TaskEnding, now: Date): void {
    const failure = ending.failure;

    if (failure !== null) {
      const faulted: TaskNotice = {
        type: LifecycleEventType.TaskFaulted,
        time: now,
        error: failure,
        output: null,
      };
      this.#announceTask(task, faulted, now);
      return;
    }

    const completed: TaskNotice = {
      type: LifecycleEventType.TaskCompleted,
      time: now,
      error: null,
      output: { value: ending.output },
    };
    this.#announceTask(task, completed, now);
  }

  emit(emitted: CloudEvent, now: Date): void {
    this.#sequence += 1;
    const event = Event.emitted({
      cloudEvent: emitted,
      origin: {
        kind: EventOriginKind.Emit,
        workflowId: this.#subject.workflowId,
        instanceId: this.#subject.instanceId,
      },
      sequence: this.#sequence,
      now,
    });
    this.#events.push(event);
  }

  take(): readonly Event[] {
    return this.#events.splice(0);
  }

  #announcePlain(
    task: TaskInstance,
    type: LifecycleEventType,
    at: Date,
    now: Date,
  ): void {
    const notice: TaskNotice = { type, time: at, error: null, output: null };
    this.#announceTask(task, notice, now);
  }

  // The root task is the workflow itself, which the workflow events announce.
  #announceTask(task: TaskInstance, notice: TaskNotice, now: Date): void {
    if (task.isRoot()) return;

    this.#announce(
      {
        type: notice.type,
        task: task.reference,
        time: notice.time,
        error: notice.error,
        output: notice.output,
      },
      now,
    );
  }

  #announce(notice: LifecycleNotice, acceptedAt: Date): void {
    this.#sequence += 1;
    const lifecycle = new LifecycleEvent({
      type: notice.type,
      task: notice.task,
      time: notice.time,
      error: notice.error,
      output: notice.output,
      subject: this.#subject,
      sequence: this.#sequence,
      acceptedAt,
    });
    const event = lifecycle.toEvent();
    this.#events.push(event);
  }
}
