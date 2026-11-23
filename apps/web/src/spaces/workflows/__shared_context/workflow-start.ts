import {
  CalendarClockIcon,
  HandIcon,
  type LucideIcon,
  WebhookIcon,
} from "lucide-react";
import type { Schedule } from "@/libs/data-access/types";
import type { Trigger } from "language-server/protocol";
import { scheduleText, triggerText } from "@/operations/schedule-words";

export interface WorkflowStart {
  readonly icon: LucideIcon;
  readonly words: string;
  readonly event: string | null;
  readonly automatic: boolean;
}

const BY_HAND: WorkflowStart = {
  icon: HandIcon,
  words: "By hand",
  event: null,
  automatic: false,
};

export function workflowStartOf(schedule: Schedule | null): WorkflowStart {
  if (schedule === null) return BY_HAND;

  const icon = schedule.kind === "on" ? WebhookIcon : CalendarClockIcon;
  const words = scheduleText(schedule);
  const event = schedule.kind === "on" ? schedule.stream : null;
  return { icon, words, event, automatic: true };
}

export function startWordsOf(triggers: readonly Trigger[]): string {
  if (triggers.length === 0) return BY_HAND.words;

  return triggers.map(triggerText).join(" · ");
}
