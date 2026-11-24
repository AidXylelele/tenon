import type { JsonArray, JsonObject, JsonValue } from "../../api/index.js";

interface NoUntil {
  readonly kind: "none";
}

export interface Acceptances {
  readonly kind: "strategy";
  readonly own: readonly number[];
  readonly until: Acceptances | NoUntil;
}

export interface Expectation {
  readonly level: number;
  readonly filter: number;
  readonly correlation: string;
  readonly value: JsonValue;
}

export interface Consumption {
  readonly items: JsonArray;
  readonly position: number;
  readonly accepted: Acceptances;
  readonly keys: JsonObject;
  readonly expected: readonly Expectation[];
}

interface Open {
  readonly kind: "open";
}

interface ClosesAt {
  readonly kind: "closesAt";
  readonly instant: number;
}

export type StreamWindow = Open | ClosesAt;
