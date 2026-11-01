import type {
  JsonObject,
  JsonValue,
  ServiceCall,
} from '../../../domain/automation/language/interfaces.js';
import type { HttpRequest } from '../interfaces.js';

export class HttpRequestMapper {
  static readonly #VARIABLE = /\{([^{}]+)\}/g;
  static readonly #CONTENT_TYPE = 'content-type';
  static readonly #JSON = 'application/json';

  static toRequest(call: ServiceCall): HttpRequest {
    const args = HttpRequestMapper.objectOf(call.arguments);
    const template = HttpRequestMapper.textOf(call.endpoint.uri);
    const expanded = HttpRequestMapper.expanded(template, call.input);
    const url = new URL(expanded);
    const query = HttpRequestMapper.objectOf(args.query);

    for (const name of Object.keys(query)) {
      const value = HttpRequestMapper.textOf(query[name]);
      url.searchParams.append(name, value);
    }

    const headers = HttpRequestMapper.headersOf(args.headers);
    const body = HttpRequestMapper.bodyOf(args.body, headers);
    const method = HttpRequestMapper.textOf(args.method).toUpperCase();
    return { method, url: url.toString(), headers, body };
  }

  static expanded(template: string, input: JsonValue): string {
    const values = HttpRequestMapper.objectOf(input);
    return template.replaceAll(HttpRequestMapper.#VARIABLE, (match, name) => {
      const value = values[String(name)];
      const text = HttpRequestMapper.textOf(value);
      return encodeURIComponent(text);
    });
  }

  static objectOf(value: JsonValue | undefined): JsonObject {
    const object =
      typeof value === 'object' && value !== null && !Array.isArray(value);

    if (!object) return {};

    return value;
  }

  static textOf(value: JsonValue | undefined): string {
    if (value === undefined || value === null) return '';

    if (typeof value === 'string') return value;

    if (Array.isArray(value)) {
      const items = value.map((item) => HttpRequestMapper.textOf(item));
      return items.join(',');
    }

    if (typeof value === 'object') return JSON.stringify(value);

    return String(value);
  }

  static headersOf(value: JsonValue | undefined): Record<string, string> {
    const declared = HttpRequestMapper.objectOf(value);
    const headers: Record<string, string> = {};

    for (const name of Object.keys(declared)) {
      const lowered = name.toLowerCase();
      headers[lowered] = HttpRequestMapper.textOf(declared[name]);
    }

    return headers;
  }

  static bodyOf(
    value: JsonValue | undefined,
    headers: Record<string, string>,
  ): string | null {
    if (value === undefined || value === null) return null;

    if (typeof value === 'string') return value;

    headers[HttpRequestMapper.#CONTENT_TYPE] ??= HttpRequestMapper.#JSON;
    return JSON.stringify(value);
  }
}
