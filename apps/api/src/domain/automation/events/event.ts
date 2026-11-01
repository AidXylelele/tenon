import { randomUUID } from 'node:crypto';
import type { JsonObject, JsonValue } from '../language/interfaces.js';
import type { EventOrigin, EventProps, ProducedEvent } from './interfaces.js';

export class Event {
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

  static produced(input: ProducedEvent): Event {
    const cloudEvent = input.cloudEvent;
    const time = Event.#timeOf(cloudEvent.time, input.now);
    return new Event({
      id: randomUUID(),
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

  static #timeOf(declared: string | null, now: Date): Date {
    if (declared === null) return now;

    return new Date(declared);
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
