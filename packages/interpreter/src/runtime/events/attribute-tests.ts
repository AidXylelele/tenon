import type { JsonValue } from "../../api/index.js";
import { isJsonEqual } from "../json/index.js";
import type { Attribute } from "./types.js";

export function isPatternMatch(attribute: Attribute, pattern: RegExp): boolean {
  switch (attribute.kind) {
    case "absent":
      return false;
    case "present": {
      const value = attribute.value;
      const isText = typeof value === "string";

      if (!isText) {
        return false;
      }

      return pattern.test(value);
    }
  }
}

export function isEqualTo(attribute: Attribute, written: JsonValue): boolean {
  switch (attribute.kind) {
    case "absent":
      return false;
    case "present":
      return isJsonEqual(written, attribute.value);
  }
}

export function conditionValueOf(attribute: Attribute): JsonValue {
  switch (attribute.kind) {
    case "absent":
      return null;
    case "present":
      return attribute.value;
  }
}
