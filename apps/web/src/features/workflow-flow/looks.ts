import {
  ArrowDownIcon,
  BracesIcon,
  CalendarClockIcon,
  CircleCheckIcon,
  CircleDashedIcon,
  CirclePauseIcon,
  CircleSlashIcon,
  CircleXIcon,
  ClockIcon,
  CornerDownRightIcon,
  FlagIcon,
  GitForkIcon,
  GlobeIcon,
  HandIcon,
  HourglassIcon,
  InboxIcon,
  LoaderCircleIcon,
  LogOutIcon,
  OctagonXIcon,
  RepeatIcon,
  RotateCwIcon,
  SendIcon,
  ShieldIcon,
  SplitIcon,
  SquareStackIcon,
  TerminalIcon,
  TimerIcon,
  WebhookIcon,
} from "lucide-react";
import type { Step, StepList, Trigger } from "language-server/protocol";
import type { StatusLook } from "@/libs/ui/composites/status";
import { triggerText } from "@/operations/schedule-words";
import { exitOf } from "./flow";
import type {
  Exit,
  ExitLook,
  KindLook,
  Lane,
  RunLook,
  StartLook,
  StepRun,
  StepStatus,
} from "./interfaces";

const KINDS: Readonly<Record<Step["kind"], KindLook>> = {
  call: { word: "Call a service", icon: GlobeIcon },
  run: { word: "Run code", icon: TerminalIcon },
  set: { word: "Set data", icon: BracesIcon },
  switch: { word: "Choose a path", icon: SplitIcon },
  for: { word: "Repeat for each item", icon: RepeatIcon },
  fork: { word: "Run branches at once", icon: GitForkIcon },
  do: { word: "Group steps", icon: SquareStackIcon },
  try: { word: "Try and handle failure", icon: ShieldIcon },
  wait: { word: "Wait", icon: TimerIcon },
  listen: { word: "Wait for events", icon: InboxIcon },
  emit: { word: "Emit an event", icon: SendIcon },
  raise: { word: "Stop with an error", icon: OctagonXIcon },
};

const STATUSES: Readonly<Record<StepStatus, StatusLook>> = {
  pending: { tone: "info", icon: ClockIcon, label: "Queued" },
  running: { tone: "info", icon: LoaderCircleIcon, label: "Running" },
  waiting: { tone: "info", icon: HourglassIcon, label: "Waiting" },
  suspended: { tone: "warning", icon: CirclePauseIcon, label: "Paused" },
  completed: { tone: "success", icon: CircleCheckIcon, label: "Succeeded" },
  faulted: { tone: "danger", icon: CircleXIcon, label: "Failed" },
  cancelled: { tone: "neutral", icon: CircleSlashIcon, label: "Cancelled" },
  retrying: { tone: "warning", icon: RotateCwIcon, label: "Retrying" },
  skipped: { tone: "neutral", icon: CircleDashedIcon, label: "Skipped" },
};

const NOT_REACHED: RunLook = {
  tone: "neutral",
  icon: CircleDashedIcon,
  label: "Not reached",
  live: false,
};

const BY_HAND: StartLook = {
  title: "Starts by hand",
  detail: "Or when another app starts it",
  icon: HandIcon,
};

export function kindLookOf(kind: Step["kind"]): KindLook {
  return KINDS[kind];
}

export function cardLineOf(step: Step): string {
  if (step.kind === "switch") return blockLineOf(step);

  return step.summary ?? KINDS[step.kind].word;
}

export function blockLineOf(step: Step): string {
  const look = KINDS[step.kind];
  const detail = step.summary ?? countedStepsOf(step);

  if (detail === null) return look.word;

  return `${look.word} · ${detail}`;
}

export function plusLabelOf(
  owner: string | null,
  above: string | null,
  below: string | null,
): string {
  if (owner !== null) return innerPlusLabelOf(owner, above, below);

  if (above !== null) return `Add a step after ${above}`;

  if (below !== null) return `Add a step before ${below}`;

  return "Add the first step";
}

export function runLookOf(run: StepRun | undefined): RunLook {
  if (run === undefined) return NOT_REACHED;

  const status = STATUSES[run.status];
  const label =
    run.detail === null ? status.label : `${status.label} · ${run.detail}`;
  const live = run.status === "running";

  return { tone: status.tone, icon: status.icon, label, live };
}

export function startLookOf(triggers: readonly Trigger[]): StartLook {
  const [first, ...others] = triggers;

  if (first === undefined) return BY_HAND;

  const title = triggerText(first);
  const way = first.kind === "on" ? "On an event" : "On a schedule";
  const icon = first.kind === "on" ? WebhookIcon : CalendarClockIcon;
  const more =
    others.length === 0 ? "" : ` · and ${String(others.length)} more`;
  const detail = `${way}${more}`;

  return { title, detail, icon };
}

export function exitLookOf(exit: Exit): ExitLook {
  switch (exit.kind) {
    case "next":
      return { words: "continues", icon: ArrowDownIcon };
    case "end":
      return { words: "End the run", icon: FlagIcon };
    case "exit":
      return { words: "Leave the block", icon: LogOutIcon };
    case "jump": {
      const words = `go to ${exit.name ?? "a step that is not there"}`;
      return { words, icon: CornerDownRightIcon };
    }
  }
}

export function laneOf(step: Step, list: StepList): Lane {
  const handling = handlingWordsOf(step);
  const after = afterCaughtWordsOf(step, list);
  const said = [handling, after].filter((part) => part !== null);
  const then = said.length === 0 ? null : said.join(", then ");

  return { note: step.summary, then };
}

function handlingWordsOf(step: Step): string | null {
  const handler = step.lists.find((each) => each.part === "catch");

  if (handler === undefined) return null;

  if (handler.steps.length === 0) return "run the steps added here";

  return "run these steps";
}

function afterCaughtWordsOf(step: Step, list: StepList): string | null {
  const caught = step.flow.find((transition) => transition.on === "caught");

  if (caught === undefined) return null;

  const exit = exitOf(caught, list);
  return thenWordsOf(exit);
}

function innerPlusLabelOf(
  owner: string,
  above: string | null,
  below: string | null,
): string {
  if (above === null) return `Add the first step inside ${owner}`;

  if (below === null) return `Add a step at the end of ${owner}`;

  return `Add a step inside ${owner}, after ${above}`;
}

function countedStepsOf(step: Step): string | null {
  if (step.kind !== "do") return null;

  const count = step.lists[0]?.steps.length ?? 0;

  if (count === 1) return "1 step";

  return `${String(count)} steps`;
}

function thenWordsOf(exit: Exit): string {
  switch (exit.kind) {
    case "next":
      return "continue with the next step";
    case "end":
      return "end the run";
    case "exit":
      return "leave the block";
    case "jump":
      return `go to ${exit.name ?? "a step that is not there"}`;
  }
}
