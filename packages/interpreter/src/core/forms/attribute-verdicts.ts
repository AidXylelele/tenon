import type { CloudEvent } from "../../api/index.js";
import {
  type Attribute,
  InterpreterError,
  attributeOf,
  conditionValueOf,
  isEqualTo,
  isPatternMatch,
} from "../../runtime/index.js";
import { conditionalVerdict, failedVerdict, heldVerdict } from "./factory.js";
import type {
  AttributeTest,
  AttributeVerdict,
  FilterTemplate,
  PatternTest,
} from "./streams.js";

export function filterVerdictsOf(
  event: CloudEvent,
  filter: FilterTemplate,
  patterns: ReadonlyMap<string, RegExp>,
): readonly AttributeVerdict[] {
  return Array.from(filter.with, ([name, test]) => {
    const attribute = attributeOf(event, name);
    return attributeVerdictOf(attribute, test, patterns);
  });
}

export function attributeVerdictOf(
  attribute: Attribute,
  test: AttributeTest,
  patterns: ReadonlyMap<string, RegExp>,
): AttributeVerdict {
  switch (test.kind) {
    case "pattern": {
      const pattern = programPatternOf(test, patterns);
      const matched = isPatternMatch(attribute, pattern);
      return matched ? heldVerdict : failedVerdict;
    }
    case "equals": {
      const equal = isEqualTo(attribute, test.value);
      return equal ? heldVerdict : failedVerdict;
    }
    case "condition": {
      const value = conditionValueOf(attribute);
      return conditionalVerdict({ condition: test.condition, value });
    }
  }
}

function programPatternOf(
  test: PatternTest,
  patterns: ReadonlyMap<string, RegExp>,
): RegExp {
  const pattern = patterns.get(test.id);

  if (pattern === undefined) {
    throw new InterpreterError(`The program compiled no pattern '${test.id}'.`);
  }

  return pattern;
}
