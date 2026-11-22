import type { Phase } from "@/libs/data-access/types";
import type { RunStatus, Started } from "./interfaces";
import { periodPhrase } from "./periods";

interface StatusWords {
  readonly label: string;
  readonly phases: readonly Phase[];
}

const STATUS: Record<RunStatus, StatusWords> = {
  "in-progress": {
    label: "In progress",
    phases: ["pending", "running", "waiting", "suspended"],
  },
  succeeded: { label: "Succeeded", phases: ["completed"] },
  failed: { label: "Failed", phases: ["faulted"] },
  cancelled: { label: "Cancelled", phases: ["cancelled"] },
};

export const STATUSES: readonly RunStatus[] = [
  "in-progress",
  "succeeded",
  "failed",
  "cancelled",
];

const SEPARATOR = ",";

const ALL_RUNS = "All runs";

const disjunction = new Intl.ListFormat("en-GB", { type: "disjunction" });

export function statusLabel(status: RunStatus): string {
  return STATUS[status].label;
}

export function phasesOf(status: RunStatus): readonly Phase[] {
  return STATUS[status].phases;
}

export function statusParamOf(statuses: readonly RunStatus[]): string {
  const chosen = inOrder(statuses);
  return chosen.join(SEPARATOR);
}

export function statusesOf(param: string | undefined): readonly RunStatus[] {
  const words = param?.split(SEPARATOR) ?? [];
  return inOrder(words);
}

export function summaryOf(
  statuses: readonly RunStatus[],
  started: Started,
): string {
  const runs = runsOf(statuses);
  const phrase = periodPhrase(started);
  return `${runs} ${phrase}`;
}

function runsOf(statuses: readonly RunStatus[]): string {
  const chosen = inOrder(statuses);

  if (chosen.length === 0) return ALL_RUNS;

  const words = chosen.map((status) => STATUS[status].label.toLowerCase());
  const listed = disjunction.format(words);
  return capitalised(listed);
}

function inOrder(words: readonly string[]): readonly RunStatus[] {
  return STATUSES.filter((status) => words.includes(status));
}

function capitalised(text: string): string {
  const first = text.charAt(0).toUpperCase();
  const rest = text.slice(1);
  return `${first}${rest}`;
}
