import type { Range } from "interpreter/front-end";
import { type Snapshot, sourceOf } from "../snapshot/index.js";

export function rangesOf(
  snapshot: Snapshot,
  pointers: readonly string[],
): readonly (Range | null)[] {
  const positions = sourceOf(snapshot.analysis)?.positions ?? null;

  return pointers.map((pointer) => positions?.rangeOf(pointer) ?? null);
}
