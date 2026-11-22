import { diff3Merge } from "node-diff3";
import type { Merged } from "./interfaces";

const LINE = "\n";

export function mergedDrafts(
  base: string,
  mine: string,
  theirs: string,
): Merged {
  const regions = diff3Merge(
    mine.split(LINE),
    base.split(LINE),
    theirs.split(LINE),
    { excludeFalseConflicts: true },
  );
  const conflicting = regions.some((region) => region.conflict !== undefined);

  if (conflicting) return { kind: "conflicting" };

  const lines = regions.flatMap((region) => region.ok ?? []);
  const text = lines.join(LINE);
  return { kind: "clean", text };
}
