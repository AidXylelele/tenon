import type { Step } from "language-server/protocol";
import type { TaskRecord } from "@/libs/data-access/types";
import type { JsonValue } from "@/libs/json/json";
import { progressOf } from "@/operations/run-progress";
import { branchNameOf, type StepRun, stepsIn } from "@/features/workflow-flow";

const MILLISECONDS_IN_SECOND = 1000;

const HANDLER = "catch";

export interface Stop {
  readonly title: string;
  readonly detail: string;
}

export function stepRunsOf(
  records: readonly TaskRecord[],
  steps: readonly Step[],
): ReadonlyMap<string, StepRun> {
  const progress = progressOf(records, steps);
  const runs = [...progress].map(([id, each]) => {
    const record = lastRecordOf(records, steps, id);
    const detail =
      record === null ? null : durationOf(record.startedAt, record.endedAt);
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

export function stopOf(
  records: readonly TaskRecord[],
  steps: readonly Step[],
): Stop | null {
  const handlers = new Set(steps.flatMap(handlerIdsOf));
  const expected = steps.filter((step) => !handlers.has(step.id));
  const reached = expected.filter(
    (step) => lastRecordOf(records, steps, step.id) !== null,
  );
  const missed = expected.filter((step) => !reached.includes(step));
  const last = reached.at(-1);

  if (missed.length === 0 || last === undefined) return null;

  const record = lastRecordOf(records, steps, last.id);
  const why = reasonOf(last, record);
  const count =
    missed.length === 1 ? "1 step" : `${String(missed.length)} steps`;
  const names = missed.map((step) => step.name).join(", ");
  const title = `It stopped after “${last.name}”`;
  const detail = `${why}, so ${count} did not run: ${names}.`;
  return { title, detail };
}

export function resultLineOf(step: Step, record: TaskRecord): string {
  if (record.status === "faulted")
    return `Failed: ${record.error?.title ?? "an error"}`;

  if (record.status === "skipped") return "Skipped";

  const returned = outputWordsOf(record.output);

  if (step.summary === null) return returned;

  return `${step.summary} → ${returned}`;
}

export function durationOf(
  startedAt: string | null,
  endedAt: string | null,
): string | null {
  if (startedAt === null || endedAt === null) return null;

  const started = Date.parse(startedAt);
  const ended = Date.parse(endedAt);
  const milliseconds = ended - started;

  if (milliseconds < MILLISECONDS_IN_SECOND)
    return `${String(milliseconds)} ms`;

  const seconds = (milliseconds / MILLISECONDS_IN_SECOND).toFixed(1);
  return `${seconds} s`;
}

function handlerIdsOf(step: Step): string[] {
  const handlers = step.lists.filter((list) => list.part === HANDLER);
  const held = handlers.flatMap(stepsIn);
  return held.map((each) => each.id);
}

function reasonOf(step: Step, record: TaskRecord | null): string {
  if (record?.status === "faulted")
    return `“${step.name}” failed: ${record.error?.title ?? "an error"}`;

  const ending = step.flow.find(
    (transition) => transition.on === "case" && transition.kind === "end",
  );

  if (ending === undefined) return `The run ended after “${step.name}”`;

  const branch = branchNameOf(ending);
  return `“${step.name}” took “${branch}”, which ends the run`;
}

function outputWordsOf(output: JsonValue): string {
  if (Array.isArray(output)) return countOf(output.length, "item");

  if (output === null) return "nothing";

  if (typeof output === "object")
    return countOf(Object.keys(output).length, "field");

  if (typeof output === "string") return "a text";

  return String(output);
}

function countOf(count: number, noun: string): string {
  return count === 1 ? `1 ${noun}` : `${String(count)} ${noun}s`;
}
