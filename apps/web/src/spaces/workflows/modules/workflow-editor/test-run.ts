import type { Step } from "language-server/protocol";
import type { TaskRecord } from "@/libs/data-access/types";
import type { JsonValue } from "@/libs/json/json";
import { progressOf } from "@/operations/run-progress";
import type { StepRun } from "@/features/workflow-flow";

const MILLISECONDS_IN_SECOND = 1000;

export function stepRunsOf(
  records: readonly TaskRecord[],
  steps: readonly Step[],
): ReadonlyMap<string, StepRun> {
  const progress = progressOf(records, steps);
  const runs = [...progress].map(([id, each]) => {
    const record = lastRecordOf(records, steps, id);
    const detail = record === null ? null : durationOf(record);
    const run: StepRun = { status: each.status, detail };
    return [id, run] as const;
  });
  return new Map(runs);
}

export function samplesOf(
  records: readonly TaskRecord[],
  steps: readonly Step[],
): Readonly<Record<string, JsonValue>> {
  const ids = new Map(steps.map((step) => [step.pointer, step.id]));
  const completed = records.filter((record) => record.status === "completed");
  const pairs = completed.flatMap((record) => {
    const id = ids.get(record.reference);
    return id === undefined ? [] : [[id, record.output] as const];
  });
  return Object.fromEntries(pairs);
}

export function callsOf(steps: readonly Step[]): string[] {
  const calls = steps.filter((step) => step.kind === "call");
  return calls.map((step) => step.summary ?? step.name);
}

export function lastRecordOf(
  records: readonly TaskRecord[],
  steps: readonly Step[],
  id: string,
): TaskRecord | null {
  const step = steps.find((each) => each.id === id);
  const own = records.filter((record) => record.reference === step?.pointer);
  return own.at(-1) ?? null;
}

function durationOf(record: TaskRecord): string | null {
  if (record.endedAt === null) return null;

  const started = Date.parse(record.startedAt);
  const ended = Date.parse(record.endedAt);
  const milliseconds = ended - started;

  if (milliseconds < MILLISECONDS_IN_SECOND)
    return `${String(milliseconds)} ms`;

  const seconds = (milliseconds / MILLISECONDS_IN_SECOND).toFixed(1);
  return `${seconds} s`;
}
