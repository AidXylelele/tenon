import { InconsistentProgressError } from '../../errors.js';
import { Event } from '../events/event.js';
import { EventOriginKind } from '../events/enums.js';
import { CloudEvent } from '../language/cloud-event.js';
import type { JsonObject, JsonValue } from '../language/interfaces.js';
import type { JsonPointer } from '../language/json-pointer.js';
import type { WorkflowError } from '../language/workflow-error.js';
import type {
  LifecycleEventProps,
  LifecycleOutput,
  LifecycleSubject,
} from './interfaces.js';
import type { LifecycleEventType } from './lifecycle-event-type.js';

export class LifecycleEvent {
  static readonly #MAXIMUM_BYTES = 64 * 1024;
  static readonly #SPEC_VERSION = '1.0';
  static readonly #CONTENT_TYPE = 'application/json';

  readonly #type: LifecycleEventType;
  readonly #subject: LifecycleSubject;
  readonly #task: JsonPointer | null;
  readonly #sequence: number;
  readonly #time: Date;
  readonly #error: WorkflowError | null;
  readonly #output: LifecycleOutput | null;

  constructor(props: LifecycleEventProps) {
    this.#type = props.type;
    this.#subject = props.subject;
    this.#task = props.task;
    this.#sequence = props.sequence;
    this.#time = props.time;
    this.#error = props.error;
    this.#output = props.output;
  }

  toEvent(): Event {
    const complete = this.#cloudEvent(true);
    const size = LifecycleEvent.#bytesOf(complete);

    if (size <= LifecycleEvent.#MAXIMUM_BYTES) return this.#produced(complete);

    const withoutOutput = this.#cloudEvent(false);
    return this.#produced(withoutOutput);
  }

  #produced(json: JsonObject): Event {
    const cloudEvent = CloudEvent.of(json);

    if (cloudEvent === null)
      throw new InconsistentProgressError('a lifecycle event is a CloudEvent');

    return Event.produced({
      cloudEvent,
      origin: {
        kind: EventOriginKind.Lifecycle,
        workflowId: this.#subject.workflowId,
        instanceId: this.#subject.instanceId,
      },
      sequence: this.#sequence,
      now: this.#time,
    });
  }

  #cloudEvent(withOutput: boolean): JsonObject {
    const workflow = this.#subject.workflow;
    const instanceId = this.#subject.instanceId;
    const source = `/workflows/${workflow.namespace}/${workflow.name}/instances/${instanceId}`;
    const data = this.#data(withOutput);
    return {
      specversion: LifecycleEvent.#SPEC_VERSION,
      id: String(this.#sequence),
      source,
      type: this.#type.type,
      time: this.#time.toISOString(),
      datacontenttype: LifecycleEvent.#CONTENT_TYPE,
      data,
    };
  }

  #data(withOutput: boolean): JsonObject {
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

    if (withOutput && this.#output !== null) data.output = this.#output.value;

    return data;
  }

  static #bytesOf(cloudEvent: JsonObject): number {
    const text = JSON.stringify(cloudEvent);
    return Buffer.byteLength(text, 'utf8');
  }
}
