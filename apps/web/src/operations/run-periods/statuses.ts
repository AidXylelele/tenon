import type { Phase } from "@/libs/data-access/types";
import type { RunStatus, Started } from "./interfaces";
import { periodPhrase } from "./periods";

type PhaseWord = (phase: Phase) => string;

type StatusGroup =
  | {
      readonly kind: "group";
      readonly label: string;
      readonly phases: readonly Phase[];
    }
  | { readonly kind: "phase"; readonly phase: Phase };

const STATUS: Record<RunStatus, StatusGroup> = {
  "in-progress": {
    kind: "group",
    label: "In progress",
    phases: ["pending", "running", "waiting", "suspended"],
  },
  succeeded: { kind: "phase", phase: "completed" },
  failed: { kind: "phase", phase: "faulted" },
  cancelled: { kind: "phase", phase: "cancelled" },
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

export function statusLabel(status: RunStatus, phaseWord: PhaseWord): string {
  const group = STATUS[status];

  if (group.kind === "group") return group.label;

  return phaseWord(group.phase);
}

export function phasesOf(status: RunStatus): readonly Phase[] {
  const group = STATUS[status];

  if (group.kind === "group") return group.phases;

  return [group.phase];
}

export function statusOf(phase: Phase): RunStatus {
  const found = STATUSES.find((status) => phasesOf(status).includes(phase));
  return found ?? "in-progress";
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
  phaseWord: PhaseWord,
): string {
  const runs = runsPhraseOf(statuses, phaseWord);
  const phrase = periodPhrase(started);
  return `${runs} ${phrase}`;
}

export function runsPhraseOf(
  statuses: readonly RunStatus[],
  phaseWord: PhaseWord,
): string {
  const chosen = inOrder(statuses);

  if (chosen.length === 0) return ALL_RUNS;

  const words = chosen.map((status) =>
    statusLabel(status, phaseWord).toLowerCase(),
  );
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
