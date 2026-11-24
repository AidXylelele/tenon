import $RefParser from "@apidevtools/json-schema-ref-parser";
import { Injectable } from "@nestjs/common";
import type { JsonObject, OpenApiRequest } from "interpreter";
import SwaggerClient, { type BuiltRequest } from "swagger-client";
import type {
  OpenApiClient,
  OpenApiOperation,
} from "../../interface-adapters/http/interfaces.js";
import type { LocatedOperation, OpenApiDocument } from "./interfaces.js";
import { OPENAPI_DOCUMENT } from "./openapi-document.schema.js";

@Injectable()
export class SwaggerOpenApiClient implements OpenApiClient {
  private static readonly METHODS = [
    "get",
    "put",
    "post",
    "delete",
    "options",
    "head",
    "patch",
    "trace",
  ] as const;
  private static readonly BODY = "body";

  async operationOf(
    text: string,
    request: OpenApiRequest,
  ): Promise<OpenApiOperation> {
    const documentUri = request.document.endpoint.uri;
    const operationId = request.operationId;
    const document = await this.#documentOf(text, documentUri);

    if (document === null)
      return this.#unusable("The OpenAPI document cannot be parsed");

    const located = this.#locatedOf(document, operationId);

    if (located === null)
      return this.#unusable(
        `The OpenAPI document has no operation "${operationId}"`,
      );

    const parameters = request.parameters;
    const refusal = this.#refusalOf(document, located, operationId, parameters);

    if (refusal !== null) return this.#unusable(refusal);

    return this.#built(document, documentUri, operationId, parameters);
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
    for (const item of Object.values(document.paths))
      for (const method of SwaggerOpenApiClient.METHODS) {
        const operation = item[method];

        if (operation?.operationId === operationId) return { item, operation };
      }

    return null;
  }

  #refusalOf(
    document: OpenApiDocument,
    located: LocatedOperation,
    operationId: string,
    parameters: JsonObject,
  ): string | null {
    const declared = located.item.parameters
      .concat(located.operation.parameters)
      .map((parameter) => parameter.name);
    const swagger = document.swagger !== undefined;
    const namesBody = declared.includes(SwaggerOpenApiClient.BODY);

    if (!swagger && namesBody)
      return `The operation "${operationId}" declares a parameter named "${SwaggerOpenApiClient.BODY}", the name of its request body`;

    const requestBody = located.operation.requestBody;
    const bodyMissing =
      requestBody?.required === true &&
      parameters[SwaggerOpenApiClient.BODY] === undefined;

    if (bodyMissing)
      return `The operation "${operationId}" requires a request body`;

    const placesBody = requestBody !== undefined;
    const unknown = Object.keys(parameters).find((name) => {
      const listed = declared.includes(name);
      const body = name === SwaggerOpenApiClient.BODY && placesBody;
      return !listed && !body;
    });

    if (unknown !== undefined)
      return `The operation "${operationId}" has no parameter "${unknown}"`;

    return null;
  }

  #built(
    document: OpenApiDocument,
    documentUri: string,
    operationId: string,
    parameters: JsonObject,
  ): OpenApiOperation {
    const swagger = document.swagger !== undefined;
    const requestBody = swagger
      ? undefined
      : parameters[SwaggerOpenApiClient.BODY];

    try {
      const built = SwaggerClient.buildRequest({
        spec: document,
        operationId,
        parameters,
        requestBody,
        contextUrl: documentUri,
      });
      return this.#operationOf(built);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      return this.#unusable(
        `The operation "${operationId}" cannot be called: ${reason}`,
      );
    }
  }

  #operationOf(built: BuiltRequest): OpenApiOperation {
    if (built.body instanceof FormData)
      return this.#unusable(
        "The host does not send multipart/form-data request bodies",
      );

    const headers = new Headers(built.headers);
    const body = this.#bodyOf(built.body);
    const request = { method: built.method, uri: built.url, headers, body };
    return { kind: "operation", request };
  }

  #bodyOf(body: unknown): string | null {
    if (body === undefined) return null;

    if (typeof body === "string") return body;

    return JSON.stringify(body);
  }

  #unusable(detail: string): OpenApiOperation {
    return { kind: "unusable", detail };
  }
}
