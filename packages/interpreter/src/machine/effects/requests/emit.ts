import type { EmitRequest, JsonValue } from "../../../api/index.js";
import type {
  AttributeTemplate,
  AttributeValue,
  EmitTemplate,
} from "../../../core/index.js";
import {
  cloudEventOf,
  derivedUuidOf,
  expandedUriOf,
  instantTextOf,
} from "../../../runtime/index.js";
import type { Building } from "./building.js";
import { valueOf } from "./shapes.js";

type Attribute = readonly [string, JsonValue];

export function emitRequestOf(
  emit: EmitTemplate,
  building: Building,
): EmitRequest {
  const entries = emit.attributes.map((attribute) =>
    sentAttributeOf(attribute, building),
  );
  const attributes = Object.fromEntries(entries);
  const event = cloudEventOf(attributes);

  return { kind: "emit", event };
}

function sentAttributeOf(
  attribute: AttributeTemplate,
  building: Building,
): Attribute {
  const value = attributeValueOf(attribute.value, building);
  return [attribute.name, value];
}

function attributeValueOf(
  value: AttributeValue,
  building: Building,
): JsonValue {
  const view = building.view;

  switch (value.kind) {
    case "evaluated":
      return valueOf(value.template, building);
    case "uri":
      return expandedUriOf(value.template, building.input);
    case "derivedId":
      return derivedUuidOf(view.run.instance, building.id);
    case "stepTime":
      return instantTextOf(view.context.now);
  }
}
