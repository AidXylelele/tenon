import {
  CalendarClockIcon,
  HandIcon,
  type LucideIcon,
  WebhookIcon,
} from "lucide-react";
import type { Schedule } from "@/libs/data-access/types";
import { scheduleText } from "@/operations/schedule-words";

export interface WorkflowStart {
  readonly icon: LucideIcon;
  readonly words: string;
  readonly automatic: boolean;
}

const BY_HAND: WorkflowStart = {
  icon: HandIcon,
  words: "By hand",
  automatic: false,
};

export function workflowStartOf(schedule: Schedule | null): WorkflowStart {
  if (schedule === null) return BY_HAND;

  const icon = schedule.kind === "on" ? WebhookIcon : CalendarClockIcon;
  const words = scheduleText(schedule);
  return { icon, words, automatic: true };
}
