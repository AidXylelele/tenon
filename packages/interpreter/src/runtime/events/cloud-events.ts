import type { CloudEvent, JsonObject, JsonValue } from "../../api/index.js";
import {
  type EventPayloadMember,
  contextEventAttributes,
  isExtensionAttribute,
  requiredEventAttributes,
} from "../../standard/index.js";
import { Raised } from "../errors/index.js";
import { isJsonObject } from "../json/index.js";
import { setMembersOf } from "./attributes.js";

const binaryPayload: EventPayloadMember = "data_base64";

const lowestInteger = -2147483648;
const highestInteger = 2147483647;

export function isCloudEvent(value: JsonValue): value is CloudEvent {
  const isObject = isJsonObject(value);

  if (!isObject) {
    return false;
  }

  return requiredEventAttributes.every(
    (attribute) => typeof value[attribute] === "string",
  );
}

export function cloudEventOf(attributes: JsonObject): CloudEvent {
  const presentAttributes = setMembersOf(attributes);

  checkRequired(presentAttributes);
  checkNonEmpty(presentAttributes);
  checkPayload(presentAttributes);
  checkExtensions(presentAttributes);

  return presentAttributes;
}

function checkRequired(
  attributes: JsonObject,
): asserts attributes is CloudEvent {
  const isEvent = isCloudEvent(attributes);

  if (isEvent) {
    return;
  }

  const notText = requiredEventAttributes.filter(
    (attribute) => typeof attributes[attribute] !== "string",
  );

  throw refusalOf("attributes as strings", notText);
}

function checkNonEmpty(attributes: JsonObject): void {
  const empty = contextEventAttributes.filter(
    (attribute) => attributes[attribute] === "",
  );
  const isFilled = empty.length === 0;

  if (isFilled) {
    return;
  }

  throw refusalOf("attributes as non-empty strings", empty);
}

function checkPayload(attributes: JsonObject): void {
  const encoded = attributes[binaryPayload];
  const isText = encoded === undefined || typeof encoded === "string";

  if (isText) {
    return;
  }

  throw refusalOf("payload members as Base64 text", [binaryPayload]);
}

function checkExtensions(attributes: JsonObject): void {
  const members = Object.entries(attributes);
  const untyped = members.filter(([name, value]) =>
    isUntypedExtension(name, value),
  );
  const names = untyped.map(([name]) => name);
  const isTyped = names.length === 0;

  if (isTyped) {
    return;
  }

  throw refusalOf(
    "extension attributes as booleans, strings or 32-bit integers",
    names,
  );
}

function isUntypedExtension(name: string, value: JsonValue): boolean {
  const isExtension = isExtensionAttribute(name);

  if (!isExtension) {
    return false;
  }

  const isTyped = isAttributeValue(value);
  return !isTyped;
}

function isAttributeValue(value: JsonValue): boolean {
  const isNumber = typeof value === "number";

  if (isNumber) {
    return isAttributeInteger(value);
  }

  const isBoolean = typeof value === "boolean";
  const isText = typeof value === "string";

  return isBoolean || isText;
}

function isAttributeInteger(value: number): boolean {
  const isWhole = Number.isInteger(value);
  const isInRange = lowestInteger <= value && value <= highestInteger;

  return isWhole && isInRange;
}

function refusalOf(need: string, names: readonly string[]): Raised {
  const named = names.join(", ");
  const detail = `The event needs these ${need}: ${named}.`;

  return Raised.standard("configuration", detail);
}
