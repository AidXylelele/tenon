import $RefParser from "@apidevtools/json-schema-ref-parser";
import { Injectable } from "@nestjs/common";
import type { JsonObject, JsonValue } from "interpreter";
import type {
  LocatedOperation,
  OpenApiDocument,
  OpenApiOperation,
  OpenApiParameter,
  OpenApiPath,
  OpenApiServer,
  Operation,
  OperationBody,
  OperationContent,
  OperationParameter,
  OperationRequest,
  OutboundRequest,
} from "./interfaces.js";
import { OPENAPI_DOCUMENT } from "./openapi-document.schema.js";

const METHODS = [
  "get",
  "put",
  "post",
  "delete",
  "options",
  "head",
  "patch",
  "trace",
] as const;

const FORM_MEDIA = "application/x-www-form-urlencoded";

const JSON_MEDIA = "application/json";

const BODY = "body";

@Injectable()
export class OpenApiOperations {
  async requestOf(
    text: string,
    documentUri: string,
    operationId: string,
    parameters: JsonObject,
  ): Promise<OperationRequest> {
    const document = await this.#documentOf(text, documentUri);

    if (document === null)
      return {
        kind: "misconfigured",
        detail: "The OpenAPI document cannot be parsed",
      };

    const located = this.#locatedOf(document, operationId);

    if (located === null)
      return {
        kind: "misconfigured",
        detail: `The OpenAPI document has no operation "${operationId}"`,
      };

    const operation = this.#described(document, located, documentUri);
    const refusal = this.#refusalOf(operation, operationId, parameters);

    if (refusal !== null) return { kind: "misconfigured", detail: refusal };

    const request = this.#placed(operation, parameters);
    return { kind: "operation", request };
  }

  async #documentOf(
    text: string,
    documentUri: string,
  ): Promise<OpenApiDocument | null> {
    try {
      const dereferenced = await $RefParser.dereference(documentUri, {
        resolve: {
          external: false,
          file: false,
          http: false,
          fetched: { order: 1, canRead: true, read: () => text },
        },
        dereference: { circular: "ignore" },
      });
      const parsed = OPENAPI_DOCUMENT.safeParse(dereferenced);
      return parsed.success ? parsed.data : null;
    } catch {
      return null;
    }
  }

  #locatedOf(
    document: OpenApiDocument,
    operationId: string,
  ): LocatedOperation | null {
    for (const [path, item] of Object.entries(document.paths))
      for (const method of METHODS) {
        const operation = item[method];

        if (operation?.operationId === operationId)
          return { path, method, item, operation };
      }

    return null;
  }

  #described(
    document: OpenApiDocument,
    located: LocatedOperation,
    documentUri: string,
  ): Operation {
    const { item, operation } = located;
    const swagger = document.swagger !== undefined;
    const base = swagger
      ? this.#swaggerBaseOf(document, operation, documentUri)
      : this.#serverBaseOf(document, item, operation, documentUri);
    const declared = item.parameters.concat(operation.parameters);
    const parameters = this.#parametersOf(declared, swagger);
    const body = swagger ? null : this.#requestBodyOf(operation);
    const consumed = operation.consumes ?? document.consumes ?? [];
    const media = body?.media ?? consumed[0] ?? JSON_MEDIA;
    return {
      swagger,
      path: located.path,
      method: located.method,
      base,
      parameters,
      media,
      body,
    };
  }

  #refusalOf(
    operation: Operation,
    operationId: string,
    parameters: JsonObject,
  ): string | null {
    const declared = operation.parameters.map((parameter) => parameter.name);

    if (!operation.swagger && declared.includes(BODY))
      return `The operation "${operationId}" declares a parameter named "${BODY}", the name of its request body`;

    const missing = operation.parameters.find(
      (parameter) =>
        parameter.required && parameters[parameter.name] === undefined,
    );

    if (missing !== undefined)
      return `The operation "${operationId}" requires the parameter "${missing.name}"`;

    if (operation.body?.required === true && parameters[BODY] === undefined)
      return `The operation "${operationId}" requires a request body`;

    const placesBody = operation.body !== null;
    const unknown = Object.keys(parameters).find(
      (name) => !declared.includes(name) && !(name === BODY && placesBody),
    );

    if (unknown !== undefined)
      return `The operation "${operationId}" has no parameter "${unknown}"`;

    return null;
  }

  #placed(operation: Operation, parameters: JsonObject): OutboundRequest {
    const present = operation.parameters.filter(
      (parameter) => parameters[parameter.name] !== undefined,
    );
    const path = this.#pathOf(operation.path, present, parameters);
    const queried = this.#locatedIn(present, "query");
    const query = this.#fieldsOf(queried, parameters);
    const search = query.size > 0 ? `?${query.toString()}` : "";
    const content = this.#contentOf(operation, present, parameters);
    const headers = this.#headersOf(present, parameters, content);
    const base = operation.base.replace(/\/+$/, "");
    return {
      method: operation.method.toUpperCase(),
      uri: `${base}${path}${search}`,
      headers,
      body: content?.body ?? null,
    };
  }

  #pathOf(
    template: string,
    present: readonly OperationParameter[],
    parameters: JsonObject,
  ): string {
    return this.#locatedIn(present, "path").reduce((path, parameter) => {
      const value = encodeURIComponent(this.#joinedOf(parameter, parameters));
      return path.replaceAll(`{${parameter.name}}`, value);
    }, template);
  }

  #headersOf(
    present: readonly OperationParameter[],
    parameters: JsonObject,
    content: OperationContent | null,
  ): Record<string, string> {
    const declared = this.#locatedIn(present, "header").map(
      (parameter): [string, string] => [
        parameter.name,
        this.#joinedOf(parameter, parameters),
      ],
    );
    const cookies = this.#locatedIn(present, "cookie").map((parameter) => {
      const value = encodeURIComponent(this.#joinedOf(parameter, parameters));
      return `${parameter.name}=${value}`;
    });
    const cookie: [string, string][] =
      cookies.length > 0 ? [["cookie", cookies.join("; ")]] : [];
    const typed: [string, string][] =
      content === null ? [] : [["content-type", content.media]];
    const entries = declared.concat(cookie, typed);
    return Object.fromEntries(entries);
  }

  #contentOf(
    operation: Operation,
    present: readonly OperationParameter[],
    parameters: JsonObject,
  ): OperationContent | null {
    const declaredBody = parameters[BODY];

    if (operation.body !== null && declaredBody !== undefined) {
      const media = operation.body.media;
      return { media, body: this.#encodedOf(declaredBody, media) };
    }

    const [bodyParameter] = this.#locatedIn(present, "body");

    if (bodyParameter !== undefined) {
      const value = parameters[bodyParameter.name] ?? null;
      const media = operation.media;
      return { media, body: this.#encodedOf(value, media) };
    }

    const formed = this.#locatedIn(present, "formData");

    if (formed.length === 0) return null;

    const form = this.#fieldsOf(formed, parameters);
    return { media: FORM_MEDIA, body: form.toString() };
  }

  #fieldsOf(
    located: readonly OperationParameter[],
    parameters: JsonObject,
  ): URLSearchParams {
    const fields = located.flatMap((parameter) =>
      this.#itemsOf(parameter, parameters).map((item) => [
        parameter.name,
        item,
      ]),
    );
    return new URLSearchParams(fields);
  }

  #locatedIn(
    present: readonly OperationParameter[],
    location: string,
  ): OperationParameter[] {
    return present.filter((parameter) => parameter.location === location);
  }

  #itemsOf(parameter: OperationParameter, parameters: JsonObject): string[] {
    const texts = this.#textsOf(parameter, parameters);

    if (parameter.exploded) return texts;

    return [texts.join(parameter.separator)];
  }

  #joinedOf(parameter: OperationParameter, parameters: JsonObject): string {
    const texts = this.#textsOf(parameter, parameters);
    return texts.join(parameter.separator);
  }

  #textsOf(parameter: OperationParameter, parameters: JsonObject): string[] {
    const value = parameters[parameter.name] ?? null;
    const values = this.#isList(value) ? value : [value];
    return values.map((item) => this.#textOf(item));
  }

  #encodedOf(value: JsonValue, media: string): string {
    if (media.startsWith(FORM_MEDIA) && this.#isObject(value)) {
      const fields = Object.entries(value).map(([name, item]) => [
        name,
        this.#textOf(item),
      ]);
      return new URLSearchParams(fields).toString();
    }

    if (typeof value === "string" && !media.includes("json")) return value;

    return JSON.stringify(value);
  }

  #textOf(value: JsonValue): string {
    if (typeof value === "string") return value;

    return JSON.stringify(value);
  }

  #isList(value: JsonValue): value is readonly JsonValue[] {
    return Array.isArray(value);
  }

  #isObject(value: JsonValue): value is JsonObject {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  }

  #parametersOf(
    declared: readonly OpenApiParameter[],
    swagger: boolean,
  ): OperationParameter[] {
    const separators = new Map([
      ["csv", ","],
      ["ssv", " "],
      ["tsv", "\t"],
      ["pipes", "|"],
    ]);
    const byKey = new Map<string, OperationParameter>();

    for (const entry of declared) {
      const format = entry.collectionFormat;
      const parameter = {
        name: entry.name,
        location: entry.in,
        required: entry.required || entry.in === "path",
        separator: separators.get(format) ?? ",",
        exploded: swagger ? format === "multi" : entry.explode,
      };
      byKey.set(`${entry.in}:${entry.name}`, parameter);
    }

    return Array.from(byKey.values());
  }

  #swaggerBaseOf(
    document: OpenApiDocument,
    operation: OpenApiOperation,
    documentUri: string,
  ): string {
    const location = new URL(documentUri);
    const schemes = operation.schemes ?? document.schemes ?? [];
    const scheme = schemes[0] ?? location.protocol.slice(0, -1);
    const host = document.host ?? location.host;
    return `${scheme}://${host}${document.basePath}`;
  }

  #serverBaseOf(
    document: OpenApiDocument,
    item: OpenApiPath,
    operation: OpenApiOperation,
    documentUri: string,
  ): string {
    const servers = operation.servers ?? item.servers ?? document.servers ?? [];
    const [server] = servers;

    if (server === undefined) return new URL(documentUri).origin;

    const url = this.#urlOf(server);
    return new URL(url, documentUri).toString();
  }

  #urlOf(server: OpenApiServer): string {
    return server.url.replace(
      /\{([^}]+)\}/g,
      (whole, name: string) => server.variables[name]?.default ?? whole,
    );
  }

  #requestBodyOf(operation: OpenApiOperation): OperationBody | null {
    const requestBody = operation.requestBody;

    if (requestBody === undefined) return null;

    const media = Object.keys(requestBody.content);
    const json = media.find((name) =>
      /^application\/(?:[\w.+-]+\+)?json/.test(name),
    );
    const chosen = json ?? media[0] ?? JSON_MEDIA;
    return { media: chosen, required: requestBody.required };
  }
}
