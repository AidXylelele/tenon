import { Event } from '../events/event.js';
import { EventOriginKind } from '../events/enums.js';
import type { JsonObject, JsonValue } from '../language/interfaces.js';
import type { JsonPointer } from '../language/json-pointer.js';
import { LifecycleSource } from '../language/lifecycle-source.js';
import type { WorkflowError } from '../language/workflow-error.js';
import type {
  LifecycleEventProps,
  LifecycleOutput,
  LifecycleSubject,
} from './interfaces.js';
import type { LifecycleEventType } from './lifecycle-event-type.js';

export class LifecycleEvent {
  readonly #type: LifecycleEventType;
  readonly #subject: LifecycleSubject;
  readonly #task: JsonPointer | null;
  readonly #sequence: number;
  readonly #time: Date;
  readonly #error: WorkflowError | null;
  readonly #output: LifecycleOutput | null;
  readonly #acceptedAt: Date;

  constructor(props: LifecycleEventProps) {
    this.#type = props.type;
    this.#subject = props.subject;
    this.#task = props.task;
    this.#sequence = props.sequence;
    this.#time = props.time;
    this.#error = props.error;
    this.#output = props.output;
    this.#acceptedAt = props.acceptedAt;
  }

  toEvent(): Event {
    const workflow = this.#subject.workflow;
    const instanceId = this.#subject.instanceId;
    const source = LifecycleSource.of(workflow, instanceId);
    const data = this.#data();
    return Event.lifecycle({
      source,
      type: this.#type.type,
      time: this.#time,
      data,
      origin: {
        kind: EventOriginKind.Lifecycle,
        workflowId: this.#subject.workflowId,
        instanceId,
      },
      sequence: this.#sequence,
      acceptedAt: this.#acceptedAt,
    });
  }

  #data(): JsonObject {
    const workflow = this.#subject.workflow;
    const qualifiedName = `${workflow.name}-${this.#subject.instanceId}.${workflow.namespace}`;
    const data: Record<string, JsonValue> = {};

    if (this.#task === null) data.name = qualifiedName;

    if (this.#task !== null) {
      data.workflow = qualifiedName;
      data.task = this.#task.toString();
    }

    if (this.#type.describesDefinition)
      data.definition = {
        name: workflow.name,
        namespace: workflow.namespace,
        version: this.#subject.semver,
      };

    data[this.#type.timeProperty] = this.#time.toISOString();

    if (this.#error !== null) data.error = this.#error.toJson();

    if (this.#output !== null) data.output = this.#output.value;

    return data;
  }
}
