import { EventOriginKind } from '../events/enums.js';
import { Event } from '../events/event.js';
import type { CloudEvent } from '../language/cloud-event.js';
import type { LifecycleNotice, LifecycleSubject } from './interfaces.js';
import { LifecycleEvent } from './lifecycle-event.js';

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

  announce(notice: LifecycleNotice, acceptedAt: Date): void {
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
}
