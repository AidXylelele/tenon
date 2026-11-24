import type { EffectId, JsonValue } from "../../../api/index.js";
import type { RequestValues } from "../../values/index.js";
import type { View } from "../../view.js";

export interface Building {
  readonly input: JsonValue;
  readonly values: RequestValues;
  readonly id: EffectId;
  readonly view: View;
}
