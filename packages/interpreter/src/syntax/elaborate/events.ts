import {
  consumptionKinds,
  defaults,
  eventAttributes,
  isMemberOf,
} from "../../standard/index.js";
import type {
  ConsumptionStrategy,
  Correlation,
  EventFilter,
  EventProperties,
  Expression,
  FilterAttribute,
  FilterProperties,
  SubscriptionIterator,
  ValueTemplate,
} from "../ast/index.js";
import {
  fieldOf,
  fieldsOf,
  itemsOf,
  mapAt,
  optionalAt,
  requiredAt,
} from "./parts.js";
import { keyOf, textOf } from "./scalars.js";
import { taskListOf } from "./tasks.js";
import { exportOf, outputOf } from "./transformations.js";
import type { Field, Part } from "./types.js";
import {
  embeddedExpressionOf,
  expressionOf,
  textTemplateOf,
  valueTemplateOf,
} from "./values.js";

const unwritten: readonly Field[] = [];

export function eventPropertiesOf(part: Part): EventProperties {
  const id = optionalAt(part, "id", textTemplateOf);
  const source = optionalAt(part, "source", textTemplateOf);
  const type = optionalAt(part, "type", textTemplateOf);
  const time = optionalAt(part, "time", textTemplateOf);
  const subject = optionalAt(part, "subject", textTemplateOf);
  const contentType = optionalAt(part, "datacontenttype", textTemplateOf);
  const dataSchema = optionalAt(part, "dataschema", textTemplateOf);
  const data = optionalAt(part, "data", valueTemplateOf);
  const additional = additionalOf(part);

  return {
    pointer: part.pointer,
    id,
    source,
    type,
    time,
    subject,
    datacontenttype: contentType,
    dataschema: dataSchema,
    data,
    additional,
  };
}

export function strategyOf(part: Part): ConsumptionStrategy {
  const kind = keyOf(part, consumptionKinds);

  switch (kind) {
    case "all": {
      const filters = requiredAt(part, kind, filtersOf);
      return { kind, pointer: part.pointer, filters };
    }
    case "any": {
      const filters = requiredAt(part, kind, filtersOf);
      const until = optionalAt(part, "until", untilOf);
      return { kind, pointer: part.pointer, filters, until };
    }
    case "one": {
      const filter = requiredAt(part, kind, filterOf);
      return { kind, pointer: part.pointer, filter };
    }
  }
}

export function iteratorOf(part: Part): SubscriptionIterator {
  const item = optionalAt(part, "item", textOf) ?? defaults.iteratorItem;
  const at = optionalAt(part, "at", textOf) ?? defaults.iteratorAt;
  const tasks = optionalAt(part, "do", taskListOf);
  const output = outputOf(part);
  const exported = exportOf(part);

  return {
    pointer: part.pointer,
    item,
    at,
    do: tasks,
    output,
    export: exported,
  };
}

function additionalOf(part: Part): ReadonlyMap<string, ValueTemplate> {
  const additional = additionalFieldsOf(part);
  const entries = additional.map((field) => {
    const template = valueTemplateOf(field.part);
    return [field.name, template] as const;
  });

  return new Map(entries);
}

function additionalFieldsOf(part: Part): readonly Field[] {
  const fields = fieldsOf(part);
  return fields.filter((field) => !isMemberOf(eventAttributes, field.name));
}

function filtersOf(part: Part): readonly EventFilter[] {
  const items = itemsOf(part);
  return items.map(filterOf);
}

function filterOf(part: Part): EventFilter {
  const properties = requiredAt(part, "with", filterPropertiesOf);
  const correlate = mapAt(part, "correlate", correlationOf);

  return { pointer: part.pointer, with: properties, correlate };
}

function filterPropertiesOf(part: Part): FilterProperties {
  const named = eventAttributes.flatMap((name) => writtenFieldsOf(part, name));
  const additional = additionalFieldsOf(part);
  const fields = [...named, ...additional];
  const entries = fields.map((field) => {
    const attribute = filterAttributeOf(field.part);
    return [field.name, attribute] as const;
  });
  const attributes = new Map(entries);

  return { pointer: part.pointer, attributes };
}

function writtenFieldsOf(part: Part, name: string): readonly Field[] {
  const written = fieldOf(part, name);

  if (written === null) {
    return unwritten;
  }

  return [{ name, part: written }];
}

function filterAttributeOf(part: Part): FilterAttribute {
  const { value, pointer } = part;

  if (typeof value !== "string") {
    return { kind: "value", pointer, value };
  }

  const condition = embeddedExpressionOf(pointer, value);

  if (condition === null) {
    return { kind: "pattern", pointer, pattern: value };
  }

  return { kind: "condition", pointer, condition };
}

function correlationOf(part: Part): Correlation {
  const from = requiredAt(part, "from", expressionOf);
  const expect = optionalAt(part, "expect", textTemplateOf);

  return { pointer: part.pointer, from, expect };
}

function untilOf(part: Part): Expression | ConsumptionStrategy {
  if (typeof part.value === "string") {
    return expressionOf(part);
  }

  return strategyOf(part);
}
