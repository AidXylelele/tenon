import type {
  JsonObject,
  JsonValue,
} from '../../../../../domain/automation/json.js';
import { Expressions } from '../../../document/expressions.js';
import type { HttpRequest } from '../../../interfaces.js';
import type { Evaluator } from '../../evaluator.js';
import { ErrorKind, TaskFault } from '../../faults.js';
import type { Scope } from '../../scope.js';

// The request an HTTP call sends: its URI template filled from the input's top-level values
// (`{petId}`) or its expression evaluated, its query, headers and body with their expressions
// evaluated. A body that is not text is sent as JSON.
export class HttpRequests {
  static readonly #VARIABLE = /\{([^{}]+)\}/g;
  static readonly #CONTENT_TYPE = 'content-type';
  static readonly #JSON = 'application/json';

  constructor(private readonly evaluator: Evaluator) {}

  async of(
    method: JsonValue | undefined,
    uri: string,
    call: JsonObject,
    input: JsonValue,
    args: JsonObject,
    scope: Scope,
  ): Promise<HttpRequest> {
    const at = scope.pointer;
    const location = await this.#uriOf(uri, input, args, scope);
    const query = (await this.evaluator.template(
      call.query ?? {},
      input,
      args,
      at,
    )) as JsonObject;

    for (const [name, value] of Object.entries(query))
      location.searchParams.append(name, HttpRequests.textOf(value));

    const declared = (await this.evaluator.template(
      call.headers ?? {},
      input,
      args,
      at,
    )) as JsonObject;
    const body = await this.evaluator.template(
      call.body ?? null,
      input,
      args,
      at,
    );
    const headers: Record<string, string> = {};

    for (const [name, value] of Object.entries(declared))
      headers[name.toLowerCase()] = HttpRequests.textOf(value);

    const json = body !== null && typeof body !== 'string';

    if (json) headers[HttpRequests.#CONTENT_TYPE] ??= HttpRequests.#JSON;

    const text = HttpRequests.#bodyOf(body);
    const verb = HttpRequests.textOf(method ?? 'get').toUpperCase();
    const url = location.toString();
    return { method: verb, url, headers, body: text };
  }

  async #uriOf(
    uri: string,
    input: JsonValue,
    args: JsonObject,
    scope: Scope,
  ): Promise<URL> {
    const expanded = Expressions.encloses(uri)
      ? HttpRequests.textOf(
          await this.evaluator.expression(uri, input, args, scope.pointer),
        )
      : HttpRequests.expanded(uri, input);

    if (!URL.canParse(expanded))
      throw TaskFault.of(
        ErrorKind.Configuration,
        scope.pointer,
        'The endpoint is not a valid URI',
      );

    return new URL(expanded);
  }

  static #bodyOf(body: JsonValue): string | null {
    if (body === null) return null;

    if (typeof body === 'string') return body;

    return JSON.stringify(body);
  }

  static expanded(template: string, input: JsonValue): string {
    const values =
      typeof input === 'object' && input !== null && !Array.isArray(input)
        ? input
        : {};
    return template.replaceAll(
      HttpRequests.#VARIABLE,
      (_match, name: string) => {
        const value = values[name];
        const text = HttpRequests.textOf(value);
        return encodeURIComponent(text);
      },
    );
  }

  static textOf(value: JsonValue | undefined): string {
    if (value === undefined || value === null) return '';

    if (typeof value === 'string') return value;

    if (Array.isArray(value))
      return value.map((item) => HttpRequests.textOf(item)).join(',');

    if (typeof value === 'object') return JSON.stringify(value);

    return String(value);
  }
}
