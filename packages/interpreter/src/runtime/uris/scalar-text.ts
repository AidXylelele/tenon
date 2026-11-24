import type { JsonValue } from "../../api/index.js";
import { Raised } from "../errors/index.js";
import { isJsonScalar } from "../json/index.js";

export function scalarTextOf(value: JsonValue): string | null {
  const isScalar = isJsonScalar(value);

  if (!isScalar) {
    const shown = JSON.stringify(value);
    const detail = `${shown} is not a scalar, so it has no text.`;
    throw Raised.standard("expression", detail);
  }

  if (value === null) {
    return null;
  }

  return String(value);
}
