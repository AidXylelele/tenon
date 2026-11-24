import {
  CircleCheckIcon,
  CircleDashedIcon,
  CirclePauseIcon,
  CirclePlayIcon,
  CircleSlashIcon,
  CircleXIcon,
  HourglassIcon,
  SkipForwardIcon,
} from "lucide-react";
import type { Phase, TaskStatus } from "@/libs/data-access/types";
import { Status, type StatusLook } from "@/libs/ui/composites/status";
import { phaseLabel, stepStateLabel } from "@/operations/run-progress";

type Mark = Pick<StatusLook, "tone" | "icon">;

const PHASE: Record<Phase, Mark> = {
  pending: { tone: "neutral", icon: CircleDashedIcon },
  running: { tone: "info", icon: CirclePlayIcon },
  waiting: { tone: "info", icon: HourglassIcon },
  suspended: { tone: "warning", icon: CirclePauseIcon },
  completed: { tone: "success", icon: CircleCheckIcon },
  faulted: { tone: "danger", icon: CircleXIcon },
  cancelled: { tone: "neutral", icon: CircleSlashIcon },
};

const SKIPPED: Mark = { tone: "neutral", icon: SkipForwardIcon };

function phaseLook(phase: Phase): StatusLook {
  const mark = PHASE[phase];
  const label = phaseLabel(phase);
  return { tone: mark.tone, icon: mark.icon, label };
}

function taskLook(status: TaskStatus): StatusLook {
  const mark = status === "skipped" ? SKIPPED : PHASE[status];
  const label = stepStateLabel(status);
  return { tone: mark.tone, icon: mark.icon, label };
}

export function PhaseStatus({
  phase,
  className,
}: {
  readonly phase: Phase;
  readonly className?: string;
}) {
  const look = phaseLook(phase);
  const live = phase === "running";

  return <Status look={look} live={live} className={className} />;
}

export function TaskStatusOf({ status }: { readonly status: TaskStatus }) {
  const look = taskLook(status);
  const live = status === "running";

  return <Status look={look} live={live} />;
}
