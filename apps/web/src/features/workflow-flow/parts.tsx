"use client";

import {
  CornerDownRightIcon,
  type LucideIcon,
  PencilIcon,
  TriangleAlertIcon,
} from "lucide-react";
import type { Step } from "language-server/protocol";
import type { ReactNode } from "react";
import { Status } from "@/libs/ui/composites/status";
import { cn } from "@/libs/ui/tokens/cn";
import { useFlow } from "./context";
import type { StepMark } from "./interfaces";
import { stepItemOf } from "./items";
import { runLookOf } from "./looks";

interface SelectableProps {
  readonly target: string;
  readonly item?: string;
  readonly marksSelection?: boolean;
  readonly jump?: string;
  readonly className: string;
  readonly children: ReactNode;
}

interface KindTileProps {
  readonly icon: LucideIcon;
  readonly start?: boolean;
}

interface StateLineProps {
  readonly step: Step;
  readonly empty: boolean;
}

const LINE = "mt-0.5 flex items-center gap-1.5 text-caption [&_svg]:size-3.5";

export function Selectable({
  target,
  item = stepItemOf(target),
  marksSelection = true,
  jump,
  className,
  children,
}: SelectableProps) {
  const { onSelect, selected, itemProps } = useFlow();

  if (onSelect === undefined)
    return (
      <div data-jump-source={jump} className={className}>
        {children}
      </div>
    );

  const current = marksSelection && selected === target ? "true" : undefined;
  const classes = cn("cursor-pointer", className);

  return (
    <button
      type="button"
      {...itemProps(item)}
      data-jump-source={jump}
      aria-current={current}
      onClick={() => {
        onSelect(target);
      }}
      className={classes}
    >
      {children}
    </button>
  );
}

export function KindTile({ icon: Icon, start = false }: KindTileProps) {
  const classes = cn(
    "grid size-8 shrink-0 place-items-center rounded-md border bg-subtle text-muted-foreground",
    start && "border-accent-border bg-accent-soft text-accent-text",
  );

  return (
    <span className={classes} aria-hidden>
      <Icon className="size-4" />
    </span>
  );
}

export function Caption({ step }: { readonly step: string }) {
  const { sources } = useFlow();
  const from = sources.get(step);

  if (from === undefined) return null;

  return (
    <p className="mb-1.5 flex items-center gap-1 self-start rounded-sm bg-canvas pr-1 text-caption text-muted-foreground">
      <CornerDownRightIcon className="size-3" aria-hidden />
      {from}
    </p>
  );
}

export function StateLine({ step, empty }: StateLineProps) {
  const { mode } = useFlow();

  switch (mode.kind) {
    case "read":
      return null;
    case "edit": {
      const mark = mode.marks.get(step.id);
      return <MarkLine mark={mark} empty={empty} />;
    }
    case "run": {
      const look = runLookOf(mode.steps.get(step.id));
      return <Status look={look} live={look.live} className={LINE} />;
    }
  }
}

function MarkLine({
  mark,
  empty,
}: {
  readonly mark: StepMark | undefined;
  readonly empty: boolean;
}) {
  if (empty) return <Problem words="No steps inside yet" />;

  if (mark === undefined) return null;

  if (mark.kind === "fill")
    return (
      <span className={cn(LINE, "text-warning-strong")}>
        <PencilIcon className="text-warning" aria-hidden />
        Fill in: {mark.what}
      </span>
    );

  const counted =
    mark.count === 1 ? "1 problem" : `${String(mark.count)} problems`;
  return <Problem words={`${counted}: ${mark.message}`} />;
}

function Problem({ words }: { readonly words: string }) {
  return (
    <span className={cn(LINE, "text-danger")}>
      <TriangleAlertIcon aria-hidden />
      {words}
    </span>
  );
}
