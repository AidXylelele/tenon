import { LIVE_PHASES } from "@/libs/data-access/phases";
import type { Phase } from "@/libs/data-access/types";
import type { RunStatus } from "./interfaces";
import { statusLabel } from "./vocabulary";

const PHASES_OF: Readonly<Record<RunStatus, readonly Phase[]>> = {
  "in-progress": LIVE_PHASES,
  succeeded: ["completed"],
  failed: ["faulted"],
  cancelled: ["cancelled"],
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

export function phasesOf(status: RunStatus): readonly Phase[] {
  return PHASES_OF[status];
}

export function statusOf(phase: Phase): RunStatus {
  const found = STATUSES.find((status) => phasesOf(status).includes(phase));
  return found ?? "in-progress";
}

export function isUnended(phase: Phase): boolean {
  const status = statusOf(phase);
  return status === "in-progress";
}

export function statusParamOf(statuses: readonly RunStatus[]): string {
  const chosen = inOrder(statuses);
  return chosen.join(SEPARATOR);
}

export function statusesOf(param: string | undefined): readonly RunStatus[] {
  const words = param?.split(SEPARATOR) ?? [];
  return inOrder(words);
}

export function runsPhraseOf(statuses: readonly RunStatus[]): string {
  const chosen = inOrder(statuses);

  if (chosen.length === 0) return ALL_RUNS;

  const words = chosen.map((status) => statusLabel(status).toLowerCase());
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
