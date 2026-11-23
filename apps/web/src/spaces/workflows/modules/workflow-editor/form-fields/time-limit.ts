import type { Commit, FieldState } from "./interfaces";
import { isObject, type Json } from "./json";
import { clearEditsOf, valueEditsOf } from "./edits";

const REFUSED_SECONDS = "Write the seconds as a whole number above 0.";

export function timeLimitOf(value: Json): number | null {
  const after = isObject(value) ? value.after : null;

  if (!isObject(after)) return null;

  const units = Object.keys(after);
  const seconds = after.seconds;
  const isSeconds = units.length === 1 && typeof seconds === "number";

  return isSeconds ? seconds : null;
}

export function timeLimitCommitOf(field: FieldState, text: string): Commit {
  const trimmed = text.trim();
  const seconds = Number(trimmed);
  const isSeconds = Number.isInteger(seconds) && seconds > 0;

  if (trimmed === "") return { kind: "edits", edits: clearEditsOf(field) };

  if (!isSeconds) return { kind: "refused", reason: REFUSED_SECONDS };

  const value = { after: { seconds } };
  const edits = valueEditsOf(field, value);
  return { kind: "edits", edits };
}
