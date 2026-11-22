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
import {
  useFlow,
  useMark,
  useRovingItem,
  useRun,
  useSelected,
} from "./context";
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

interface SelectButtonProps {
  readonly target: string;
  readonly item: string;
  readonly marksSelection: boolean;
  readonly jump: string | undefined;
  readonly className: string;
  readonly onSelect: (target: string | null) => void;
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
  const { onSelect } = useFlow();

  if (onSelect === null)
    return (
      <div data-jump-source={jump} className={className}>
        {children}
      </div>
    );

  return (
    <SelectButton
      target={target}
      item={item}
      marksSelection={marksSelection}
      jump={jump}
      className={className}
      onSelect={onSelect}
    >
      {children}
    </SelectButton>
  );
}

function SelectButton({
  target,
  item,
  marksSelection,
  jump,
  className,
  onSelect,
  children,
}: SelectButtonProps) {
  const roving = useRovingItem(item);
  const selected = useSelected(target);
  const current = marksSelection && selected ? "true" : undefined;
  const classes = cn("cursor-pointer", className);

  return (
    <button
      type="button"
      {...roving}
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
  const { kind } = useFlow();

  switch (kind) {
    case "read":
      return null;
    case "edit":
      return <MarkLine step={step.id} empty={empty} />;
    case "run":
      return <RunLine step={step.id} />;
  }
}

function RunLine({ step }: { readonly step: string }) {
  const run = useRun(step);
  const look = runLookOf(run);

  return <Status look={look} live={look.live} className={LINE} />;
}

function MarkLine({
  step,
  empty,
}: {
  readonly step: string;
  readonly empty: boolean;
}) {
  const mark = useMark(step);

  if (empty) return <Problem words="No steps inside yet" />;

  if (mark === undefined) return null;

  if (mark.kind === "fill")
    return (
      <span className={cn(LINE, "text-warning-strong")}>
        <PencilIcon className="text-warning" aria-hidden />
        Fill in: the {mark.missing}
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
