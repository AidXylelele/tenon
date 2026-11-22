"use client";

import { ArrowLeftIcon, PlusIcon } from "lucide-react";
import { IconButton } from "@/libs/ui/composites/icon-button";
import { cn } from "@/libs/ui/tokens/cn";
import { useFlow, useFlowView, useRovingItem } from "./context";
import { isSamePlace } from "./flow";
import type { Line, PlusProps } from "./interfaces";

interface ConnectorProps {
  readonly line: Line;
  readonly plus: PlusProps | null;
  readonly hint?: string;
}

export const DOWN: Readonly<Record<Line, string>> = {
  plain: "border-l-[1.5px] border-(--flow-edge)",
  taken: "border-l-2 border-accent-solid",
  dim: "border-l-[1.5px] border-dashed border-(--flow-edge)",
};

export const ACROSS: Readonly<Record<Line, string>> = {
  plain: "border-t-[1.5px] border-(--flow-edge)",
  taken: "border-t-2 border-accent-solid",
  dim: "border-t-[1.5px] border-dashed border-(--flow-edge)",
};

const PLUS = cn(
  "relative rounded-full text-muted-foreground before:absolute before:inset-1 before:rounded-full before:border before:border-control before:bg-surface before:transition-colors before:duration-(--duration-fast) [&_svg]:relative [&_svg]:size-3.5",
  "hover:bg-transparent hover:text-accent-text hover:before:border-accent-solid hover:before:bg-accent-soft active:bg-transparent",
  "aria-expanded:bg-transparent aria-expanded:text-on-accent aria-expanded:before:border-accent-solid aria-expanded:before:bg-accent-solid aria-expanded:hover:text-on-accent aria-expanded:hover:before:bg-accent-solid",
);

const ARROWS: Readonly<Record<Line, string>> = {
  plain: "text-(--flow-edge)",
  taken: "text-accent-solid",
  dim: "text-(--flow-edge)",
};

export function Connector({ line, plus, hint }: ConnectorProps) {
  const drawn = cn("absolute top-0 bottom-1 left-1/2 w-0", DOWN[line]);
  const arrow = cn("absolute bottom-0 left-1/2 -translate-x-1/2", ARROWS[line]);

  return (
    <div className="relative flex h-14 w-8 shrink-0 justify-center">
      <span className={drawn} aria-hidden />
      <svg
        className={arrow}
        width="10"
        height="7"
        viewBox="0 0 10 7"
        aria-hidden
      >
        <path
          d="M1 1 L5 6 L9 1"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        />
      </svg>
      {plus !== null && (
        <span className="absolute top-1/2 left-1/2 -translate-1/2">
          <PlusButton {...plus} />
        </span>
      )}
      {hint !== undefined && (
        <span className="absolute top-1/2 left-[calc(50%+28px)] flex -translate-y-1/2 items-center gap-1 rounded-sm bg-canvas px-1 text-caption font-semibold whitespace-nowrap text-accent-text">
          <ArrowLeftIcon className="size-3.5" aria-hidden />
          {hint}
        </span>
      )}
    </div>
  );
}

export function Gap() {
  return <div className="h-11" aria-hidden />;
}

export function EndPlus(plus: PlusProps) {
  return (
    <div className="flex h-12 items-center justify-center">
      <PlusButton {...plus} />
    </div>
  );
}

export function Placeholder() {
  return (
    <div
      role="note"
      className="flex h-11 w-70 items-center justify-center rounded-lg border border-dashed border-(--flow-node-border) text-caption text-muted-foreground"
    >
      No steps inside yet
    </div>
  );
}

export function PlusButton({ item, label, place }: PlusProps) {
  const { onInsert } = useFlow();
  const roving = useRovingItem(item);
  const open = useFlowView((view) => isSamePlace(place, view.inserting));

  if (onInsert === null) return null;

  return (
    <IconButton
      label={label}
      icon={PlusIcon}
      variant="ghost"
      size="icon"
      {...roving}
      aria-expanded={open}
      onClick={() => {
        onInsert(place);
      }}
      className={PLUS}
    />
  );
}
