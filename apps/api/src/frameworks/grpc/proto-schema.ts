import { fromJSON } from "@grpc/proto-loader";
import { Injectable } from "@nestjs/common";
import type { JsonObject, JsonValue } from "interpreter";
import {
  common,
  type Field,
  type Message,
  parse,
  type Root,
  Type,
} from "protobufjs";
import type { GrpcCall } from "../../interface-adapters/grpc/interfaces.js";
import type { ParsedProto, PreparedCall, Unusable } from "./interfaces.js";

@Injectable()
export class ProtoSchema {
  preparedOf(request: GrpcCall): PreparedCall | Unusable {
    const parsed = this.#parsedOf(request.proto);

    if (parsed.kind === "unusable") return parsed;

    const serviceName = request.service.name;
    const json = parsed.root.toJSON();
    const definition = fromJSON(json, {
      keepCase: true,
      longs: String,
      enums: String,
      bytes: String,
      defaults: true,
      json: true,
    });
    const service = definition[serviceName];

    if (service === undefined || "format" in service)
      return this.#unusable(`The proto describes no service ${serviceName}`);

    const method = service[request.method];

    if (method === undefined)
      return this.#unusable(
        `The service ${serviceName} has no method ${request.method}`,
      );

    if (method.requestStream)
      return this.#unusable(
        `The method ${request.method} streams its requests, and a call sends one message`,
      );

    try {
      const argument = this.#argumentOf(parsed.root, request);
      return { kind: "call", method, argument };
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      return this.#unusable(
        `The arguments do not fit the request of ${request.method}: ${reason}`,
      );
    }
  }

  #parsedOf(text: string): ParsedProto {
    try {
      const parsed = parse(text, { keepCase: true });
      const strong = parsed.imports ?? [];
      const weak = parsed.weakImports ?? [];
      const imports = strong.concat(weak);
      const unknown = imports.find((imported) => {
        const known = common.get(imported);
        return known === null;
      });

      if (unknown !== undefined)
        return this.#unusable(
          `The proto imports ${unknown}, which is not a well-known type`,
        );

      for (const imported of imports) {
        const nested = common.get(imported)?.nested ?? {};
        parsed.root.addJSON(nested);
      }

      parsed.root.resolveAll();
      return { kind: "root", root: parsed.root };
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      return this.#unusable(`The proto cannot be read: ${reason}`);
    }
  }

  #argumentOf(root: Root, request: GrpcCall): Message {
    const service = root.lookupService(request.service.name);
    const type = service.methods[request.method]?.resolvedRequestType ?? null;

    if (type === null)
      throw new TypeError(`${request.method} has no request type`);

    const named = this.#namedOf(type, request.arguments);
    return type.fromObject(named);
  }

  #namedOf(type: Type, values: JsonObject): JsonObject {
    const entries = Object.entries(values).map(
      ([key, value]): [string, JsonValue] => {
        const field = this.#fieldOf(type, key);
        return [field.name, this.#fieldValueOf(field, value)];
      },
    );
    return Object.fromEntries(entries);
  }

  #fieldOf(type: Type, key: string): Field {
    const field = type.fieldsArray.find(
      (candidate) => candidate.name === key || candidate.jsonName === key,
    );

    if (field === undefined)
      throw new TypeError(`${type.fullName} has no field ${key}`);

    return field;
  }

  #fieldValueOf(field: Field, value: JsonValue): JsonValue {
    const message = field.resolvedType;

    if (!(message instanceof Type)) return value;

    const list = this.#isList(value);

    if (list && field.repeated)
      return value.map((item) => this.#nestedOf(message, item));

    const object = this.#isObject(value);

    if (field.map && object) {
      const entries = Object.entries(value).map(
        ([key, item]): [string, JsonValue] => [
          key,
          this.#nestedOf(message, item),
        ],
      );
      return Object.fromEntries(entries);
    }

    return this.#nestedOf(message, value);
  }

  #nestedOf(type: Type, value: JsonValue): JsonValue {
    const object = this.#isObject(value);
    return object ? this.#namedOf(type, value) : value;
  }

  #isList(value: JsonValue): value is readonly JsonValue[] {
    return Array.isArray(value);
  }

  #isObject(value: JsonValue): value is JsonObject {
    const list = Array.isArray(value);
    return typeof value === "object" && value !== null && !list;
  }

  #unusable(detail: string): Unusable {
    return { kind: "unusable", detail };
  }
}
