import $RefParser from "@apidevtools/json-schema-ref-parser";
import { Injectable } from "@nestjs/common";
import type { JsonObject } from "interpreter";
import SwaggerClient, { type BuiltRequest } from "swagger-client";
import type {
  LocatedOperation,
  OpenApiDocument,
  OperationRequest,
  OutboundRequest,
} from "./interfaces.js";
import { OPENAPI_DOCUMENT } from "./openapi-document.schema.js";

@Injectable()
export class OpenApiOperations {
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

    const refusal = this.#refusalOf(document, located, operationId, parameters);

    if (refusal !== null) return { kind: "misconfigured", detail: refusal };

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
      for (const method of OpenApiOperations.METHODS) {
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
    const namesBody = declared.includes(OpenApiOperations.BODY);

    if (!swagger && namesBody)
      return `The operation "${operationId}" declares a parameter named "${OpenApiOperations.BODY}", the name of its request body`;

    const requestBody = located.operation.requestBody;

    if (
      requestBody?.required === true &&
      parameters[OpenApiOperations.BODY] === undefined
    )
      return `The operation "${operationId}" requires a request body`;

    const placesBody = requestBody !== undefined;
    const unknown = Object.keys(parameters).find((name) => {
      const listed = declared.includes(name);
      const body = name === OpenApiOperations.BODY && placesBody;
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
  ): OperationRequest {
    const swagger = document.swagger !== undefined;
    const requestBody = swagger
      ? undefined
      : parameters[OpenApiOperations.BODY];

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
      return {
        kind: "misconfigured",
        detail: `The operation "${operationId}" cannot be called: ${reason}`,
      };
    }
  }

  #operationOf(built: BuiltRequest): OperationRequest {
    if (built.body instanceof FormData)
      return {
        kind: "misconfigured",
        detail: "The host does not send multipart/form-data request bodies",
      };

    const headers = new Headers(built.headers);
    const body = this.#bodyOf(built.body);
    const request: OutboundRequest = {
      method: built.method,
      uri: built.url,
      headers,
      body,
      redirect: "manual",
    };
    return { kind: "operation", request };
  }

  #bodyOf(body: unknown): string | null {
    if (body === undefined) return null;

    if (typeof body === "string") return body;

    return JSON.stringify(body);
  }
}
