import type { ast, JsonObject, JsonValue } from "interpreter/front-end";
import { isJsonObject } from "../pointers/index.js";
import type { DataShape, Shape } from "./interfaces.js";

const noMembers: ReadonlyMap<string, Shape> = new Map();

export const unknownShape: Shape = { kind: "unknown", members: noMembers };

export const textShape: Shape = { kind: "text", members: noMembers };

export const numberShape: Shape = { kind: "number", members: noMembers };

const schemaTypes: ReadonlyMap<string, DataShape> = new Map([
  ["object", "object"],
  ["array", "list"],
  ["string", "text"],
  ["number", "number"],
  ["integer", "number"],
  ["boolean", "boolean"],
]);

export function schemaShapeOf(schema: ast.Schema | null): Shape | null {
  if (schema?.kind !== "inline") {
    return null;
  }

  const isJson = schema.format === "json";

  if (!isJson) {
    return null;
  }

  return jsonSchemaShapeOf(schema.document);
}

export function templateShapeOf(template: ast.ValueTemplate): Shape {
  switch (template.kind) {
    case "object": {
      const fields = [...template.fields];
      const members = fields.map(
        ([name, field]) => [name, templateShapeOf(field)] as const,
      );
      return { kind: "object", members: new Map(members) };
    }
    case "array":
      return { kind: "list", members: noMembers };
    case "expression":
      return unknownShape;
    case "literal":
      return literalShapeOf(template.value);
  }
}

export function mergedShapeOf(incoming: Shape, values: Shape): Shape {
  const isObject = incoming.kind === "object";
  const kept = isObject ? [...incoming.members] : [];
  const members = new Map([...kept, ...values.members]);

  return { kind: "object", members };
}

function jsonSchemaShapeOf(schema: JsonValue): Shape {
  if (!isJsonObject(schema)) {
    return unknownShape;
  }

  const properties = schema.properties;
  const kind = schemaKindOf(schema);
  const isDescribed = kind === "object" && isJsonObject(properties);

  if (!isDescribed) {
    return { kind, members: noMembers };
  }

  const entries = Object.entries(properties);
  const members = entries.map(
    ([name, property]) => [name, jsonSchemaShapeOf(property)] as const,
  );
  return { kind, members: new Map(members) };
}

function schemaKindOf(schema: JsonObject): DataShape {
  const written = schema.type;

  if (typeof written === "string") {
    return schemaTypes.get(written) ?? "unknown";
  }

  const hasProperties = isJsonObject(schema.properties);
  return hasProperties ? "object" : "unknown";
}

export function literalShapeOf(value: JsonValue): Shape {
  if (!isJsonObject(value)) {
    const kind = literalKindOf(value);
    return { kind, members: noMembers };
  }

  const entries = Object.entries(value);
  const members = entries.map(
    ([name, member]) => [name, literalShapeOf(member)] as const,
  );
  return { kind: "object", members: new Map(members) };
}

function literalKindOf(value: JsonValue): DataShape {
  if (typeof value === "string") {
    return "text";
  }

  if (typeof value === "number") {
    return "number";
  }

  if (typeof value === "boolean") {
    return "boolean";
  }

  return Array.isArray(value) ? "list" : "unknown";
}
