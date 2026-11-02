import type {
  JsonObject,
  JsonValue,
  ServiceCall,
} from '../../../../domain/automation/language/interfaces.js';
import { RequestPreparationKind } from '../enums.js';
import type { RequestPreparation } from '../interfaces.js';
import { HttpRequestMapper } from './http-request.mapper.js';

export class OpenApiRequestMapper {
  static readonly #METHODS: readonly string[] = [
    'get',
    'put',
    'post',
    'delete',
    'options',
    'head',
    'patch',
    'trace',
  ];
  static readonly #BODY = 'body';
  static readonly #COOKIE = 'cookie';
  static readonly #CONTENT_TYPE = 'content-type';
  static readonly #JSON = 'application/json';
  static readonly #NOT_A_URI =
    'The OpenAPI operation does not form a valid URI';

  static toPreparation(
    call: ServiceCall,
    document: JsonObject,
    documentUrl: string,
  ): RequestPreparation {
    const args = HttpRequestMapper.objectOf(call.arguments);
    const operationId = HttpRequestMapper.textOf(args.operationId);
    const values = HttpRequestMapper.objectOf(args.parameters);
    const paths = HttpRequestMapper.objectOf(document.paths);

    for (const path of Object.keys(paths)) {
      const item = HttpRequestMapper.objectOf(paths[path]);

      for (const method of OpenApiRequestMapper.#METHODS) {
        const operation = HttpRequestMapper.objectOf(item[method]);

        if (operation.operationId !== operationId) continue;

        const parameters = OpenApiRequestMapper.#parametersOf(item, operation);
        const base = OpenApiRequestMapper.#baseOf(document, documentUrl);

        if (base === null)
          return HttpRequestMapper.misconfigured(
            OpenApiRequestMapper.#NOT_A_URI,
          );

        return OpenApiRequestMapper.#preparation(
          method,
          `${base}${path}`,
          parameters,
          values,
          operation,
        );
      }
    }

    return HttpRequestMapper.misconfigured(
      `The OpenAPI document has no operation "${operationId}"`,
    );
  }

  static #preparation(
    method: string,
    template: string,
    parameters: readonly JsonObject[],
    values: JsonObject,
    operation: JsonObject,
  ): RequestPreparation {
    const headers: Record<string, string> = {};
    const cookies: string[] = [];
    let path = template;
    let body: string | null = null;
    const query = new URLSearchParams();

    for (const parameter of parameters) {
      const name = HttpRequestMapper.textOf(parameter.name);
      const location = HttpRequestMapper.textOf(parameter.in);
      const value = values[name];

      if (value === undefined && parameter.required === true)
        return HttpRequestMapper.misconfigured(
          `The OpenAPI operation needs the parameter "${name}"`,
        );

      if (value === undefined) continue;

      const text = HttpRequestMapper.textOf(value);

      if (location === 'path')
        path = path.replaceAll(`{${name}}`, encodeURIComponent(text));

      if (location === 'query') query.append(name, text);

      if (location === 'header') headers[name.toLowerCase()] = text;

      if (location === OpenApiRequestMapper.#COOKIE)
        cookies.push(`${name}=${encodeURIComponent(text)}`);

      if (location === OpenApiRequestMapper.#BODY) {
        headers[OpenApiRequestMapper.#CONTENT_TYPE] =
          OpenApiRequestMapper.#JSON;
        body = JSON.stringify(value);
      }
    }

    const requestBody = values[OpenApiRequestMapper.#BODY];

    if (operation.requestBody !== undefined && requestBody !== undefined) {
      headers[OpenApiRequestMapper.#CONTENT_TYPE] = OpenApiRequestMapper.#JSON;
      body = JSON.stringify(requestBody);
    }

    if (cookies.length > 0) headers.cookie = cookies.join('; ');

    if (!URL.canParse(path))
      return HttpRequestMapper.misconfigured(OpenApiRequestMapper.#NOT_A_URI);

    const url = new URL(path);

    for (const [name, value] of query) url.searchParams.append(name, value);

    const location = url.toString();
    const verb = method.toUpperCase();
    return {
      kind: RequestPreparationKind.Prepared,
      request: { method: verb, url: location, headers, body },
    };
  }

  static #parametersOf(
    item: JsonObject,
    operation: JsonObject,
  ): readonly JsonObject[] {
    const shared = OpenApiRequestMapper.#listOf(item.parameters);
    const own = OpenApiRequestMapper.#listOf(operation.parameters);
    const overridden = (candidate: JsonObject): boolean =>
      own.some(
        (parameter) =>
          parameter.name === candidate.name && parameter.in === candidate.in,
      );
    const inherited = shared.filter((parameter) => !overridden(parameter));
    return inherited.concat(own);
  }

  static #listOf(value: JsonValue | undefined): readonly JsonObject[] {
    if (!Array.isArray(value)) return [];

    return value.map((item) => HttpRequestMapper.objectOf(item));
  }

  static #baseOf(document: JsonObject, documentUrl: string): string | null {
    const location = new URL(documentUrl);
    const servers = OpenApiRequestMapper.#listOf(document.servers);
    const server = servers[0];

    if (server !== undefined) {
      const declared = OpenApiRequestMapper.#serverUrl(server);

      if (!URL.canParse(declared, location)) return null;

      const resolved = new URL(declared, location);
      return resolved.toString().replace(/\/$/, '');
    }

    const schemes = Array.isArray(document.schemes) ? document.schemes : [];
    const declaredScheme = HttpRequestMapper.textOf(schemes[0]);
    const scheme = declaredScheme || location.protocol.replace(':', '');
    const host = HttpRequestMapper.textOf(document.host) || location.host;
    const basePath = HttpRequestMapper.textOf(document.basePath);
    const trimmed = basePath.replace(/\/$/, '');
    return `${scheme}://${host}${trimmed}`;
  }

  static #serverUrl(server: JsonObject): string {
    const variables = HttpRequestMapper.objectOf(server.variables);
    let url = HttpRequestMapper.textOf(server.url);

    for (const name of Object.keys(variables)) {
      const variable = HttpRequestMapper.objectOf(variables[name]);
      const fallback = HttpRequestMapper.textOf(variable.default);
      url = url.replaceAll(`{${name}}`, fallback);
    }

    return url;
  }
}
