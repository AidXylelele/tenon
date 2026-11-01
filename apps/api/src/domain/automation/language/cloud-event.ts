import type { CloudEventProps, JsonObject, JsonValue } from './interfaces.js';

export class CloudEvent {
  static readonly #SPEC_VERSION = '1.0';
  static readonly #ATTRIBUTE_NAME = /^[a-z0-9]+$/;
  static readonly #TIMESTAMP =
    /^\d{4}-\d{2}-\d{2}[Tt]\d{2}:\d{2}:\d{2}(\.\d+)?([Zz]|[+-]\d{2}:\d{2})$/;
  static readonly #WHITESPACE = /\s/;
  static readonly #RELATIVE_BASE = 'https://reference.invalid/';
  static readonly #MAXIMUM_INTEGER = 2 ** 31 - 1;
  static readonly #CONTEXT: readonly string[] = [
    'specversion',
    'id',
    'source',
    'type',
    'time',
    'subject',
    'datacontenttype',
    'dataschema',
    'data',
  ];

  readonly #id: string;
  readonly #source: string;
  readonly #type: string;
  readonly #attributes: JsonObject;

  private constructor(props: CloudEventProps) {
    this.#id = props.id;
    this.#source = props.source;
    this.#type = props.type;
    this.#attributes = props.attributes;
  }

  static of(value: JsonValue): CloudEvent | null {
    if (!CloudEvent.declares(value)) return null;

    const event = value;
    const id = event.id;
    const source = event.source;
    const type = event.type;
    const typed =
      typeof id === 'string' &&
      typeof source === 'string' &&
      typeof type === 'string';

    if (!typed) return null;

    const identified = id !== '' && source !== '' && type !== '';
    const versioned =
      event.specversion === undefined ||
      event.specversion === CloudEvent.#SPEC_VERSION;
    const wellFormed =
      identified &&
      versioned &&
      CloudEvent.#optionalText(event.subject) &&
      CloudEvent.#optionalText(event.datacontenttype) &&
      CloudEvent.#uriReference(event.source) &&
      CloudEvent.#optionalAbsoluteUri(event.dataschema) &&
      CloudEvent.#optionalTimestamp(event.time) &&
      CloudEvent.#extensionValues(event);

    if (!wellFormed) return null;

    return new CloudEvent({ id, source, type, attributes: event });
  }

  static declares(value: JsonValue): value is JsonObject {
    const object =
      typeof value === 'object' && value !== null && !Array.isArray(value);

    if (!object) return false;

    const names = Object.keys(value);
    const named = names.every((name) => CloudEvent.#ATTRIBUTE_NAME.test(name));
    return (
      named &&
      typeof value.source === 'string' &&
      typeof value.type === 'string'
    );
  }

  get id(): string {
    return this.#id;
  }

  get source(): string {
    return this.#source;
  }

  get type(): string {
    return this.#type;
  }

  get time(): string | null {
    return CloudEvent.#textOrNull(this.#attributes.time);
  }

  get subject(): string | null {
    return CloudEvent.#textOrNull(this.#attributes.subject);
  }

  get dataContentType(): string | null {
    return CloudEvent.#textOrNull(this.#attributes.datacontenttype);
  }

  get dataSchema(): string | null {
    return CloudEvent.#textOrNull(this.#attributes.dataschema);
  }

  get data(): JsonValue {
    return this.#attributes.data ?? null;
  }

  get extensions(): JsonObject {
    const extensions: Record<string, JsonValue | undefined> = {};

    for (const name of Object.keys(this.#attributes)) {
      const context = CloudEvent.#CONTEXT.includes(name);

      if (!context) extensions[name] = this.#attributes[name];
    }

    return extensions;
  }

  toJson(): JsonObject {
    return this.#attributes;
  }

  static #text(value: JsonValue | undefined): boolean {
    return typeof value === 'string' && value !== '';
  }

  static #optionalText(value: JsonValue | undefined): boolean {
    return value === undefined || CloudEvent.#text(value);
  }

  static #textOrNull(value: JsonValue | undefined): string | null {
    if (typeof value !== 'string') return null;

    return value;
  }

  static #uriReference(value: JsonValue | undefined): boolean {
    if (typeof value !== 'string') return false;

    if (CloudEvent.#WHITESPACE.test(value)) return false;

    return URL.canParse(value, CloudEvent.#RELATIVE_BASE);
  }

  static #optionalAbsoluteUri(value: JsonValue | undefined): boolean {
    if (value === undefined) return true;

    return typeof value === 'string' && URL.canParse(value);
  }

  static #optionalTimestamp(value: JsonValue | undefined): boolean {
    if (value === undefined) return true;

    if (typeof value !== 'string' || !CloudEvent.#TIMESTAMP.test(value))
      return false;

    const parsed = Date.parse(value);
    return !Number.isNaN(parsed);
  }

  static #extensionValues(event: JsonObject): boolean {
    return Object.keys(event).every((name) => {
      const context = CloudEvent.#CONTEXT.includes(name);
      const value = event[name];
      return context || CloudEvent.#extensionValue(value);
    });
  }

  static #extensionValue(value: JsonValue | undefined): boolean {
    if (typeof value === 'string' || typeof value === 'boolean') return true;

    return (
      typeof value === 'number' &&
      Number.isInteger(value) &&
      Math.abs(value) <= CloudEvent.#MAXIMUM_INTEGER
    );
  }
}
