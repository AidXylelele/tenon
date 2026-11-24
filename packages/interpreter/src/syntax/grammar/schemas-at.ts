import type { JsonObject, JsonValue } from "../../api/index.js";
import {
  childPointerOf,
  isJsonArray,
  isJsonObject,
  pointedValueOf,
  rootPointer,
} from "../../runtime/index.js";
import { isMemberOf } from "../../standard/index.js";
import { jsonTypes, type JsonType } from "./json-types.js";
import type {
  Levelling,
  SchemaAt,
  SchemaMember,
  SchemaPlace,
} from "./types.js";
import workflowSchema from "./workflow-schema.json" with { type: "json" };

interface Declaration {
  readonly name: string;
  readonly node: JsonValue;
}

const conjunctive = ["allOf"];

const alternative = ["anyOf", "oneOf"];

const fragment = "#";

export function schemasAlong(
  start: SchemaPlace,
  tokens: readonly string[],
  levelled: Levelling,
): readonly SchemaAt[] {
  const places = tokens.reduce<readonly SchemaPlace[]>(
    (reached, token) => placesBelow(reached, token, levelled),
    [start],
  );
  const schemas = places.map(({ node }) => schemaAtOf(node));

  return Object.freeze(schemas);
}

function placesBelow(
  places: readonly SchemaPlace[],
  token: string,
  levelled: Levelling,
): readonly SchemaPlace[] {
  const declared = places.flatMap((place) => childPlacesOf(place, token));
  const byNode = Map.groupBy(declared, ({ node }) => node);
  const groups = [...byNode.values()];
  const distinct = groups.flatMap((group) => group.slice(0, 1));

  return distinct.flatMap(levelled);
}

function childPlacesOf(
  place: SchemaPlace,
  token: string,
): readonly SchemaPlace[] {
  const node = declaredNodeOf(place.node, token);
  const isDeclared = isJsonObject(node);

  if (!isDeclared) {
    return [];
  }

  const step = childPointerOf(rootPointer, token);
  const value = pointedValueOf(place.value, step);

  return [{ node, value }];
}

function declaredNodeOf(node: JsonObject, token: string): JsonValue {
  const nodes = nodesOf(node);
  const declarations = nodes.flatMap(propertiesOf);
  const member = declarations.find(({ name }) => name === token);

  if (member !== undefined) {
    return member.node;
  }

  const rest = nodes.flatMap(restSchemasOf);
  const [first = null] = rest;

  return first;
}

export function declaredNamesOf(node: JsonValue): readonly string[] {
  const isNode = isJsonObject(node);

  if (!isNode) {
    return [];
  }

  const nodes = nodesOf(node);
  const declarations = nodes.flatMap(propertiesOf);

  return declarations.map(({ name }) => name);
}

function schemaAtOf(node: JsonObject): SchemaAt {
  const description = descriptionOf(node);
  const types = typesOf(node);
  const values = valuesOf(node);
  const closed = isClosed(node);
  const members = membersOf(node);
  const schema: SchemaAt = { description, types, values, closed, members };

  return Object.freeze(schema);
}

function descriptionOf(node: JsonValue): string | null {
  const isNode = isJsonObject(node);

  if (!isNode) {
    return null;
  }

  const { description = null } = node;

  if (typeof description === "string") {
    return description;
  }

  const target = targetOf(node);
  return descriptionOf(target);
}

function typesOf(node: JsonObject): readonly JsonType[] {
  const admitted = admittedTypesOf(node);
  const distinct = [...new Set(admitted)];

  return Object.freeze(distinct);
}

function admittedTypesOf(node: JsonObject): readonly JsonType[] {
  const conjuncts = conjunctsOf(node);
  const named = conjuncts.flatMap(ownTypesOf);
  const isNamed = named.length > 0;

  if (isNamed) {
    return named;
  }

  const parts = conjuncts.flatMap((conjunct) => partsOf(conjunct, alternative));
  const admitted = parts.map(admittedTypesOf);
  const admitsAny = admitted.some((types) => types.length === 0);

  if (admitsAny) {
    return [];
  }

  return admitted.flat();
}

function valuesOf(node: JsonObject): readonly JsonValue[] {
  const nodes = nodesOf(node);
  const values = nodes.flatMap(ownValuesOf);
  const distinct = [...new Set(values)];

  return Object.freeze(distinct);
}

function isClosed(node: JsonObject): boolean {
  const conjuncts = conjunctsOf(node);
  return conjuncts.some(admitsOnlyListed);
}

function admitsOnlyListed(conjunct: JsonObject): boolean {
  const listed = ownValuesOf(conjunct);
  const isListed = listed.length > 0;

  if (isListed) {
    return true;
  }

  const parts = partsOf(conjunct, alternative);
  const isAlternative = parts.length > 0;

  return isAlternative && parts.every(isClosed);
}

function membersOf(node: JsonObject): readonly SchemaMember[] {
  const conjuncts = conjunctsOf(node);
  const required = conjuncts.flatMap(requiredOf);
  const nodes = nodesOf(node);
  const declarations = nodes.flatMap(propertiesOf);
  const byName = Map.groupBy(declarations, ({ name }) => name);
  const groups = [...byName.values()];
  const firsts = groups.flatMap((group) => group.slice(0, 1));
  const members = firsts.map((first) => memberOf(first, required));

  return Object.freeze(members);
}

function memberOf(
  declaration: Declaration,
  required: readonly string[],
): SchemaMember {
  const { name } = declaration;
  const isRequired = required.includes(name);
  const description = descriptionOf(declaration.node);
  const member: SchemaMember = { name, required: isRequired, description };

  return Object.freeze(member);
}

function nodesOf(node: JsonObject): readonly JsonObject[] {
  const conjoined = conjoinedOf(node);
  const parts = partsOf(node, alternative);
  const below = [...conjoined, ...parts];
  const nested = below.flatMap(nodesOf);

  return [node, ...nested];
}

function conjunctsOf(node: JsonObject): readonly JsonObject[] {
  const conjoined = conjoinedOf(node);
  const nested = conjoined.flatMap(conjunctsOf);

  return [node, ...nested];
}

function conjoinedOf(node: JsonObject): readonly JsonObject[] {
  const target = targetOf(node);
  const parts = partsOf(node, conjunctive);

  if (target === null) {
    return parts;
  }

  return [target, ...parts];
}

function partsOf(
  node: JsonObject,
  keywords: readonly string[],
): readonly JsonObject[] {
  const listed = keywords.flatMap((keyword) => node[keyword] ?? []);
  return listed.filter(isJsonObject);
}

function targetOf(node: JsonObject): JsonObject | null {
  const { $ref: reference = null } = node;
  const isWithin =
    typeof reference === "string" && reference.startsWith(fragment);

  if (!isWithin) {
    return null;
  }

  const pointer = reference.slice(fragment.length);
  const target = pointedValueOf(workflowSchema, pointer);
  const isNode = isJsonObject(target);

  if (!isNode) {
    return null;
  }

  return target;
}

function propertiesOf(node: JsonObject): readonly Declaration[] {
  const { properties = null } = node;
  const isDeclared = isJsonObject(properties);

  if (!isDeclared) {
    return [];
  }

  const entries = Object.entries(properties);
  return entries.map(([name, declared]) => ({ name, node: declared }));
}

function requiredOf(node: JsonObject): readonly string[] {
  const { required = null } = node;
  const isListed = isJsonArray(required);

  if (!isListed) {
    return [];
  }

  return required.filter((name) => typeof name === "string");
}

function ownTypesOf(node: JsonObject): readonly JsonType[] {
  const names = typeNamesOf(node);
  return names.filter((name) => isMemberOf(jsonTypes, name));
}

function typeNamesOf(node: JsonObject): readonly JsonValue[] {
  const { type = null } = node;
  const isListed = isJsonArray(type);

  if (!isListed) {
    return [type];
  }

  return type;
}

function ownValuesOf(node: JsonObject): readonly JsonValue[] {
  const constants = constantsOf(node);
  const enumeration = enumerationOf(node);

  return [...constants, ...enumeration];
}

function constantsOf(node: JsonObject): readonly JsonValue[] {
  const isConstant = Object.hasOwn(node, "const");

  if (!isConstant) {
    return [];
  }

  const { const: constant = null } = node;
  return [constant];
}

function enumerationOf(node: JsonObject): readonly JsonValue[] {
  const { enum: listed = null } = node;
  const isListed = isJsonArray(listed);

  if (!isListed) {
    return [];
  }

  return listed;
}

function restSchemasOf(node: JsonObject): readonly JsonObject[] {
  const { additionalProperties = null, items = null } = node;
  const schemas = [additionalProperties, items];

  return schemas.filter(isJsonObject);
}
