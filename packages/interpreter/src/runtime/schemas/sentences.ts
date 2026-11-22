import type { ErrorObject } from "ajv/dist/2020.js";
import { tokensOf } from "../json/index.js";

const typeWords: Readonly<Record<string, string>> = {
  object: "an object",
  array: "an array",
  string: "a string",
  number: "a number",
  integer: "an integer",
  boolean: "true or false",
  null: "null",
};

const formatWords: Readonly<Record<string, string>> = {
  uri: "a URI",
  "uri-reference": "a URI reference",
  "uri-template": "a URI template",
  "date-time": "a date and time",
  date: "a date",
  time: "a time",
  duration: "a duration",
  email: "an email address",
  hostname: "a host name",
  ipv4: "an IPv4 address",
  ipv6: "an IPv6 address",
  uuid: "a UUID",
  regex: "a regular expression",
  "json-pointer": "a JSON pointer",
};

const bounds: Readonly<Record<string, string>> = {
  minimum: "at least",
  maximum: "at most",
  exclusiveMinimum: "greater than",
  exclusiveMaximum: "less than",
};

const counts: Readonly<Record<string, readonly [string, string]>> = {
  minLength: ["at least", "character"],
  maxLength: ["at most", "character"],
  minItems: ["at least", "item"],
  maxItems: ["at most", "item"],
  minProperties: ["at least", "property"],
  maxProperties: ["at most", "property"],
};

export function sentenceOf(error: ErrorObject, subject: string): string {
  const name = pointerNameOf(subject);
  const params: Record<string, unknown> = error.params;
  const sentence = wordedOf(error, name, params);

  return `${capitalizedOf(sentence)}.`;
}

export function pointerNameOf(pointer: string): string {
  const tokens = tokensOf(pointer);
  const last = tokens.at(-1);

  if (last === undefined) {
    return "the value";
  }

  const isItem = /^\d+$/.test(last);
  return isItem ? `item ${last}` : last;
}

export function capitalizedOf(text: string): string {
  const first = text.slice(0, 1).toUpperCase();
  return `${first}${text.slice(1)}`;
}

function wordedOf(
  error: ErrorObject,
  name: string,
  params: Record<string, unknown>,
): string {
  const keyword = error.keyword;
  const bound = bounds[keyword];
  const count = counts[keyword];

  if (bound !== undefined) {
    return `${name} must be ${bound} ${textOf(params.limit)}`;
  }

  if (count !== undefined) {
    return countedOf(name, count, params.limit);
  }

  switch (keyword) {
    case "required":
      return `${name} is required`;
    case "additionalProperties":
    case "unevaluatedProperties":
      return `unknown property ${name}`;
    case "type":
      return `${name} must be ${typesOf(params.type)}`;
    case "enum":
      return `${name} must be one of ${listOf(params.allowedValues)}`;
    case "const":
      return `${name} must be ${textOf(params.allowedValue)}`;
    case "pattern":
      return `${name} must match the pattern ${textOf(params.pattern)}`;
    case "format":
      return `${name} must be ${formatOf(params.format)}`;
    case "multipleOf":
      return `${name} must be a multiple of ${textOf(params.multipleOf)}`;
    case "uniqueItems":
      return `${name} must not repeat an item`;
    case "oneOf":
      return oneOfSentenceOf(name, params.passingSchemas);
    case "anyOf":
      return `${name} matches none of its allowed forms`;
    case "not":
      return `${name} is in a form its schema forbids`;
    case "contains":
      return `${name} must contain an item its schema allows`;
    case "dependentRequired":
      return `${textOf(params.missingProperty)} is required with ${textOf(params.property)}`;
    case "false schema":
      return `${name} is not allowed`;
    default:
      return `${name} ${error.message ?? "is not valid"}`;
  }
}

function countedOf(
  name: string,
  [bound, unit]: readonly [string, string],
  limit: unknown,
): string {
  const units = limit === 1 ? unit : pluralOf(unit);
  return `${name} must have ${bound} ${textOf(limit)} ${units}`;
}

function pluralOf(unit: string): string {
  return unit.endsWith("y") ? `${unit.slice(0, -1)}ies` : `${unit}s`;
}

function oneOfSentenceOf(name: string, passing: unknown): string {
  if (passing === null || passing === undefined) {
    return `${name} matches none of its allowed forms`;
  }

  return `${name} matches more than one of its allowed forms`;
}

function typesOf(type: unknown): string {
  const listed = Array.isArray(type) ? type : String(type).split(",");
  const words = listed.map((each) => typeWords[String(each)] ?? String(each));

  return words.join(" or ");
}

function formatOf(format: unknown): string {
  const named = String(format);
  return formatWords[named] ?? `in the ${named} format`;
}

function listOf(values: unknown): string {
  const listed: readonly unknown[] = Array.isArray(values) ? values : [values];
  return listed.map(textOf).join(", ");
}

function textOf(value: unknown): string {
  return typeof value === "string" ? value : JSON.stringify(value);
}
