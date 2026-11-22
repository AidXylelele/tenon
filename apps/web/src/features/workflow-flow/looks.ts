import {
  type LucideIcon,
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
  WorkflowIcon,
} from "lucide-react";
import type { Step, StepList, Trigger } from "language-server/protocol";
import type { Trigger as RunTrigger } from "@/libs/data-access/types";
import {
  startedBy,
  type StepState,
  stepStateLabel,
} from "@/operations/run-progress";
import { spanOf, triggerText } from "@/operations/schedule-words";
import { exitOf } from "./flow";
import type {
  Exit,
  ExitLook,
  KindLook,
  Lane,
  RunLook,
  RunStart,
  StartLook,
  StateLook,
  StepMark,
  StepRun,
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

const STATES: Readonly<Record<StepState, StateLook>> = {
  pending: { tone: "info", icon: ClockIcon },
  running: { tone: "info", icon: LoaderCircleIcon },
  waiting: { tone: "info", icon: HourglassIcon },
  suspended: { tone: "warning", icon: CirclePauseIcon },
  completed: { tone: "success", icon: CircleCheckIcon },
  faulted: { tone: "danger", icon: CircleXIcon },
  cancelled: { tone: "neutral", icon: CircleSlashIcon },
  retrying: { tone: "warning", icon: RotateCwIcon },
  skipped: { tone: "neutral", icon: CircleDashedIcon },
  "not-reached": { tone: "neutral", icon: CircleDashedIcon },
};

const STARTED_ICONS: Readonly<Record<RunTrigger, LucideIcon>> = {
  manual: HandIcon,
  schedule: CalendarClockIcon,
  event: WebhookIcon,
  parent: WorkflowIcon,
  detached: WorkflowIcon,
  restart: RotateCwIcon,
};

const BY_HAND: StartLook = {
  title: "Starts by hand",
  detail: "Or when another app starts it",
  icon: HandIcon,
};

export function kindLookOf(kind: Step["kind"]): KindLook {
  return KINDS[kind];
}

export function cardLineOf(step: Step, mark: StepMark | undefined): string {
  const written = writtenLineOf(step);
  const missing = mark?.missing ?? null;

  if (missing === null) return written;

  return `${written} · ${missing} to fill in`;
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
  const state = run?.status ?? "not-reached";
  const look = STATES[state];
  const word = stepStateLabel(state);
  const detail = run?.detail ?? null;
  const label = detail === null ? word : `${word} · ${detail}`;
  const live = state === "running";

  return { tone: look.tone, icon: look.icon, label, live };
}

export function startCardOf(
  triggers: readonly Trigger[],
  start: RunStart | null,
): StartLook {
  if (start === null) return startLookOf(triggers);

  return runStartLookOf(start);
}

function runStartLookOf(start: RunStart): StartLook {
  const title = startedBy(start.trigger);
  const icon = STARTED_ICONS[start.trigger];

  return { title, detail: start.detail, icon };
}

function startLookOf(triggers: readonly Trigger[]): StartLook {
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

function writtenLineOf(step: Step): string {
  if (step.kind === "switch") return blockLineOf(step);

  if (step.summary === null) return KINDS[step.kind].word;

  return spanOf(step.milliseconds, step.summary);
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
