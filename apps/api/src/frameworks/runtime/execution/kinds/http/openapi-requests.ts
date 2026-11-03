import type {
  JsonObject,
  JsonValue,
} from '../../../../../domain/automation/json.js';
import type { HttpRequest } from '../../../interfaces.js';
import { ErrorKind, TaskFault } from '../../faults.js';
import type { Scope } from '../../scope.js';
import { HttpRequests } from './http-requests.js';

// The request of an OpenAPI operation (Swagger 2.0 or OpenAPI 3): found by its `operationId`,
// sent to the document's server (or its host and base path), its parameters placed in the path,
// the query, the headers, the cookies or the body as each declares.
export class OpenApiRequests {
  static readonly #METHODS = [
    'get',
    'put',
    'post',
    'delete',
    'options',
    'head',
    'patch',
    'trace',
  ];
  static readonly #JSON = 'application/json';

  static of(
    document: JsonObject,
    documentUrl: string,
    operationId: string,
    values: JsonObject,
    scope: Scope,
  ): HttpRequest {
    const paths = OpenApiRequests.#objectOf(document.paths);

    for (const [path, entry] of Object.entries(paths)) {
      const item = OpenApiRequests.#objectOf(entry);

      for (const method of OpenApiRequests.#METHODS) {
        const operation = OpenApiRequests.#objectOf(item[method]);

        if (operation.operationId !== operationId) continue;

        const base = OpenApiRequests.#baseOf(document, documentUrl, scope);
        const parameters = OpenApiRequests.#parametersOf(item, operation);
        return OpenApiRequests.#request(
          method,
          `${base}${path}`,
          parameters,
          values,
          operation,
          scope,
        );
      }
    }

    throw TaskFault.of(
      ErrorKind.Configuration,
      scope.pointer,
      `The OpenAPI document has no operation "${operationId}"`,
    );
  }

  static #request(
    method: string,
    template: string,
    parameters: readonly JsonObject[],
    values: JsonObject,
    operation: JsonObject,
    scope: Scope,
  ): HttpRequest {
    const headers: Record<string, string> = {};
    const cookies: string[] = [];
    const query = new URLSearchParams();
    let path = template;
    let body: string | null = null;

    for (const parameter of parameters) {
      const name = HttpRequests.textOf(parameter.name);
      const location = HttpRequests.textOf(parameter.in);
      const value = values[name];

      if (value === undefined && parameter.required === true)
        throw TaskFault.of(
          ErrorKind.Configuration,
          scope.pointer,
          `The OpenAPI operation needs the parameter "${name}"`,
        );

      if (value === undefined) continue;

      const text = HttpRequests.textOf(value);

      if (location === 'path')
        path = path.replaceAll(`{${name}}`, encodeURIComponent(text));

      if (location === 'query') query.append(name, text);

      if (location === 'header') headers[name.toLowerCase()] = text;

      if (location === 'cookie')
        cookies.push(`${name}=${encodeURIComponent(text)}`);

      if (location === 'body') {
        headers['content-type'] = OpenApiRequests.#JSON;
        body = JSON.stringify(value);
      }
    }

    const requestBody = values.body;

    if (operation.requestBody !== undefined && requestBody !== undefined) {
      headers['content-type'] = OpenApiRequests.#JSON;
      body = JSON.stringify(requestBody);
    }

    if (cookies.length > 0) headers.cookie = cookies.join('; ');

    if (!URL.canParse(path))
      throw TaskFault.of(
        ErrorKind.Configuration,
        scope.pointer,
        'The OpenAPI operation does not form a valid URI',
      );

    const url = new URL(path);

    for (const [name, value] of query) url.searchParams.append(name, value);

    return { method: method.toUpperCase(), url: url.toString(), headers, body };
  }

  // The path item's parameters, overridden by the operation's of the same name and place.
  static #parametersOf(
    item: JsonObject,
    operation: JsonObject,
  ): readonly JsonObject[] {
    const shared = OpenApiRequests.#listOf(item.parameters);
    const own = OpenApiRequests.#listOf(operation.parameters);
    const inherited = shared.filter(
      (candidate) =>
        !own.some(
          (parameter) =>
            parameter.name === candidate.name && parameter.in === candidate.in,
        ),
    );
    return inherited.concat(own);
  }

  static #baseOf(
    document: JsonObject,
    documentUrl: string,
    scope: Scope,
  ): string {
    const location = new URL(documentUrl);
    const [server] = OpenApiRequests.#listOf(document.servers);

    if (server !== undefined) {
      const declared = OpenApiRequests.#serverUrl(server);

      if (!URL.canParse(declared, location))
        throw TaskFault.of(
          ErrorKind.Configuration,
          scope.pointer,
          'The OpenAPI server is not a valid URI',
        );

      return new URL(declared, location).toString().replace(/\/$/, '');
    }

    const schemes = Array.isArray(document.schemes) ? document.schemes : [];
    const scheme =
      HttpRequests.textOf(schemes[0]) || location.protocol.replace(':', '');
    const host = HttpRequests.textOf(document.host) || location.host;
    const basePath = HttpRequests.textOf(document.basePath).replace(/\/$/, '');
    return `${scheme}://${host}${basePath}`;
  }

  static #serverUrl(server: JsonObject): string {
    const variables = OpenApiRequests.#objectOf(server.variables);
    let url = HttpRequests.textOf(server.url);

    for (const [name, entry] of Object.entries(variables)) {
      const fallback = HttpRequests.textOf(
        OpenApiRequests.#objectOf(entry).default,
      );
      url = url.replaceAll(`{${name}}`, fallback);
    }

    return url;
  }

  static #listOf(value: JsonValue | undefined): readonly JsonObject[] {
    if (!Array.isArray(value)) return [];

    return value.map((item) => OpenApiRequests.#objectOf(item));
  }

  static #objectOf(value: JsonValue | undefined): JsonObject {
    const object =
      typeof value === 'object' && value !== null && !Array.isArray(value);
    return object ? value : {};
  }
}
