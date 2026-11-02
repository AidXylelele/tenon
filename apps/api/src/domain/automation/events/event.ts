import { randomUUID } from 'node:crypto';
import type { JsonObject, JsonValue } from '../language/interfaces.js';
import type {
  EmittedEventInput,
  EventOrigin,
  EventProps,
  LifecycleEventInput,
} from './interfaces.js';

export class Event {
  static readonly #JSON = 'application/json';

  readonly #id: string;
  readonly #source: string;
  readonly #eventId: string;
  readonly #type: string;
  readonly #time: Date;
  readonly #subject: string | null;
  readonly #dataContentType: string | null;
  readonly #dataSchema: string | null;
  readonly #data: JsonValue;
  readonly #extensions: JsonObject;
  readonly #origin: EventOrigin;
  readonly #sequence: number;
  readonly #acceptedAt: Date;

  constructor(props: EventProps) {
    this.#id = props.id;
    this.#source = props.source;
    this.#eventId = props.eventId;
    this.#type = props.type;
    this.#time = props.time;
    this.#subject = props.subject;
    this.#dataContentType = props.dataContentType;
    this.#dataSchema = props.dataSchema;
    this.#data = props.data;
    this.#extensions = props.extensions;
    this.#origin = props.origin;
    this.#sequence = props.sequence;
    this.#acceptedAt = props.acceptedAt;
  }

  static lifecycle(input: LifecycleEventInput): Event {
    const id = randomUUID();
    const eventId = String(input.sequence);
    return new Event({
      id,
      source: input.source,
      eventId,
      type: input.type,
      time: input.time,
      subject: null,
      dataContentType: Event.#JSON,
      dataSchema: null,
      data: input.data,
      extensions: {},
      origin: input.origin,
      sequence: input.sequence,
      acceptedAt: input.acceptedAt,
    });
  }

  static emitted(input: EmittedEventInput): Event {
    const cloudEvent = input.cloudEvent;
    const id = randomUUID();
    const time = cloudEvent.time ?? input.now;
    return new Event({
      id,
      source: cloudEvent.source,
      eventId: cloudEvent.id,
      type: cloudEvent.type,
      time,
      subject: cloudEvent.subject,
      dataContentType: cloudEvent.dataContentType,
      dataSchema: cloudEvent.dataSchema,
      data: cloudEvent.data,
      extensions: cloudEvent.extensions,
      origin: input.origin,
      sequence: input.sequence,
      acceptedAt: input.now,
    });
  }

  get id(): string {
    return this.#id;
  }

  get source(): string {
    return this.#source;
  }

  get eventId(): string {
    return this.#eventId;
  }

  get type(): string {
    return this.#type;
  }

  get time(): Date {
    return this.#time;
  }

  get subject(): string | null {
    return this.#subject;
  }

  get dataContentType(): string | null {
    return this.#dataContentType;
  }

  get dataSchema(): string | null {
    return this.#dataSchema;
  }

  get data(): JsonValue {
    return this.#data;
  }

  get extensions(): JsonObject {
    return this.#extensions;
  }

  get origin(): EventOrigin {
    return this.#origin;
  }

  get sequence(): number {
    return this.#sequence;
  }

  get acceptedAt(): Date {
    return this.#acceptedAt;
  }
}
