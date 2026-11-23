import type {
  CountedBucket,
  LivePhase,
  Phase,
  PhaseCounts,
} from "@/libs/data-access/types";
import type {
  Bar,
  Bucket,
  CountRequest,
  Figure,
  FigureKind,
  PeriodWindows,
} from "./interfaces";

const COUNTED: Readonly<Record<FigureKind, readonly Phase[]>> = {
  started: [
    "pending",
    "running",
    "waiting",
    "suspended",
    "completed",
    "faulted",
    "cancelled",
  ],
  succeeded: ["completed"],
  failed: ["faulted"],
  cancelled: ["cancelled"],
};

const FIGURES: readonly FigureKind[] = [
  "started",
  "succeeded",
  "failed",
  "cancelled",
];

const LIVE: readonly LivePhase[] = [
  "pending",
  "running",
  "waiting",
  "suspended",
];

export function countWindowOf(windows: PeriodWindows): CountRequest {
  const buckets = windows.buckets.map((bucket) => bucket.from);
  return {
    buckets,
    to: windows.current.to,
    previousFrom: windows.previous.from,
  };
}

export function figuresOf(
  total: PhaseCounts,
  previous: PhaseCounts | null,
): readonly Figure[] {
  return FIGURES.map((kind) => {
    const count = sumOf(total, COUNTED[kind]);
    const before = previous === null ? null : sumOf(previous, COUNTED[kind]);
    return { kind, count, previous: before };
  });
}

export function inProgressOf(now: Readonly<Record<LivePhase, number>>): number {
  return LIVE.reduce((sum, phase) => sum + now[phase], 0);
}

export function seriesOf(
  buckets: readonly Bucket[],
  counted: readonly CountedBucket[],
): readonly Bar[] {
  return buckets.map((bucket) => {
    const found = counted.find((each) => each.start === bucket.from);
    const counts = found?.counts ?? null;
    return {
      label: bucket.label,
      from: bucket.from,
      to: bucket.to,
      succeeded: countOf(counts, "completed"),
      failed: countOf(counts, "faulted"),
      cancelled: countOf(counts, "cancelled"),
      inProgress: liveOf(counts),
    };
  });
}

function sumOf(counts: PhaseCounts, phases: readonly Phase[]): number {
  return phases.reduce((sum, phase) => sum + counts[phase], 0);
}

function countOf(counts: PhaseCounts | null, phase: Phase): number {
  return counts?.[phase] ?? 0;
}

function liveOf(counts: PhaseCounts | null): number {
  if (counts === null) return 0;

  return sumOf(counts, LIVE);
}
