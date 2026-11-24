import type { Commit, FieldState } from "./interfaces";
import { clearEditsOf, valueEditsOf } from "./edits";

const MILLISECONDS_IN_SECOND = 1000;

const REFUSED_SECONDS = "Write the seconds as a whole number above 0.";

export function limitSecondsOf(milliseconds: number | null): number | null {
  if (milliseconds === null) return null;

  return milliseconds / MILLISECONDS_IN_SECOND;
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
