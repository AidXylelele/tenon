import type { IncomingHttpHeaders } from 'node:http';
import type { CloudEvent } from '../../../application/automation/events/ports.js';
import type { JsonValue } from '../../../domain/automation/json.js';

// A CloudEvent sent in HTTP binary mode (CloudEvents HTTP binding 1.0): its context attributes
// in `ce-` headers, its data the body, its `datacontenttype` the body's media type.
export class CloudEventMapper {
  static readonly #PREFIX = 'ce-';

  static isBinary(headers: IncomingHttpHeaders): boolean {
    return headers['ce-specversion'] !== undefined;
  }

  static fromBinary(headers: IncomingHttpHeaders, body: unknown): CloudEvent {
    const event: Record<string, JsonValue> = {};

    for (const [name, value] of Object.entries(headers)) {
      if (
        !name.startsWith(CloudEventMapper.#PREFIX) ||
        typeof value !== 'string'
      )
        continue;

      const attribute = name.slice(CloudEventMapper.#PREFIX.length);
      event[attribute] = decodeURIComponent(value);
    }

    const type = headers['content-type'];

    if (type !== undefined) event.datacontenttype = type;

    const data = CloudEventMapper.#dataOf(body);

    if (data !== null) event.data = data;

    return event;
  }

  static #dataOf(body: unknown): JsonValue {
    if (body === undefined || body === null) return null;

    if (typeof body === 'string') return body.length === 0 ? null : body;

    return body as JsonValue;
  }
}
