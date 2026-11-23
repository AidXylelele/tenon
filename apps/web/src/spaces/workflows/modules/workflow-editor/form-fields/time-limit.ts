import { secondsOf } from "./failure";
import type { Commit, FieldState } from "./interfaces";
import { isObject, type Json } from "./json";
import { clearEditsOf, valueEditsOf } from "./edits";

const REFUSED_SECONDS = "Write the seconds as a whole number above 0.";

export function timeLimitOf(value: Json): number | null {
  if (!isObject(value)) return null;

  return secondsOf(value.after);
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
