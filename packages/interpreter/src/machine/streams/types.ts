import type { CloudEvent, JsonObject } from "../../api/index.js";
import type { FilterTemplate } from "../../core/index.js";
import type { ReceiveK } from "../frames/index.js";
import type { View } from "../view.js";

interface Matched {
  readonly kind: "matched";
  readonly keys: JsonObject;
}

interface Refused {
  readonly kind: "refused";
}

export type Match = Matched | Refused;

export interface Correlating {
  readonly event: CloudEvent;
  readonly filter: FilterTemplate;
}

export interface Standing {
  readonly frame: ReceiveK;
  readonly view: View;
}

export const refused: Match = { kind: "refused" };
