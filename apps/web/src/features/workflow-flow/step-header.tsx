"use client";

import { cn } from "@/libs/ui/tokens/cn";
import { useFlow } from "./context";
import type { StepPlace } from "./interfaces";
import { kindLookOf } from "./looks";
import { KindTile, Selectable, StateLine } from "./parts";
import { StepMenu } from "./step-menu";

interface StepHeaderProps {
  readonly place: StepPlace;
  readonly line: string;
  readonly empty: boolean;
  readonly className?: string;
}

export function StepHeader({ place, line, empty, className }: StepHeaderProps) {
  const { mode, selected } = useFlow();
  const { step } = place;
  const look = kindLookOf(step.kind);
  const menu = mode.kind === "edit" && selected === step.id;
  const row = cn("flex items-center", className);

  return (
    <div className={row}>
      <Selectable
        target={step.id}
        className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg px-3 py-2.5 text-left"
      >
        <KindTile icon={look.icon} />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate font-semibold">{step.name}</span>
          <span className="line-clamp-2 text-caption text-muted-foreground [overflow-wrap:anywhere]">
            {line}
          </span>
          <StateLine step={step} empty={empty} />
        </span>
      </Selectable>
      {menu && (
        <span className="pr-2">
          <StepMenu place={place} />
        </span>
      )}
    </div>
  );
}
