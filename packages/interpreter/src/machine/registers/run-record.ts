import type { JsonValue } from "../../api/index.js";

export interface RunRecord {
  readonly instance: string;
  readonly input: JsonValue;
  readonly startedAt: number;
}

export function runRecordOf(
  instance: string,
  input: JsonValue,
  startedAt: number,
): RunRecord {
  return { instance, input, startedAt };
}
