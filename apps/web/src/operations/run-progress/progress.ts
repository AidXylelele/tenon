import type { Step } from "language-server/protocol";
import type { TaskRecord } from "@/libs/data-access/types";
import type { SeenProgress, TaskProgress } from "./interfaces";

export function progressOf(
  records: readonly TaskRecord[],
  steps: readonly Step[],
): Map<string, TaskProgress> {
  const ids = new Map(steps.map((step) => [step.pointer, step.id]));
  const seen = new Map<string, SeenProgress>();

  records.forEach((record, order) => {
    const id = ids.get(record.reference);

    if (id === undefined) return;

    const runs = (seen.get(id)?.progress.runs ?? 0) + 1;
    seen.set(id, { progress: { status: record.status, runs }, order });
  });

  for (const step of steps.toReversed()) {
    const latest = latestChildOf(step, seen);

    if (seen.has(step.id) || latest === null) continue;

    const progress = { status: latest.progress.status, runs: 1 };
    seen.set(step.id, { progress, order: latest.order });
  }

  const pairs = [...seen].map(([id, each]) => [id, each.progress] as const);
  return new Map(pairs);
}

export function recordsOf(
  records: readonly TaskRecord[],
  steps: readonly Step[],
): TaskRecord[] {
  const pointers = new Set(steps.map((step) => step.pointer));
  return records.filter((record) => pointers.has(record.reference));
}

function latestChildOf(
  step: Step,
  seen: ReadonlyMap<string, SeenProgress>,
): SeenProgress | null {
  const children = step.lists.flatMap((list) => list.steps);
  const known = children.flatMap((child) => seen.get(child.id) ?? []);
  return known.reduce<SeenProgress | null>(
    (best, each) => (best === null || each.order > best.order ? each : best),
    null,
  );
}
