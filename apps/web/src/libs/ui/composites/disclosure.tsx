"use client";

import { ChevronDownIcon } from "lucide-react";
import { useId } from "react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "../components/collapsible";

interface DisclosureProps {
  readonly title: string;
  readonly summary?: React.ReactNode;
  readonly summaryBelow?: boolean;
  readonly defaultOpen?: boolean;
  readonly open?: boolean;
  readonly onOpenChange?: (open: boolean) => void;
  readonly children: React.ReactNode;
}

export function Disclosure({
  title,
  summary,
  summaryBelow = false,
  defaultOpen,
  open,
  onOpenChange,
  children,
}: DisclosureProps) {
  const summaryId = useId();
  const described = summary === undefined ? undefined : summaryId;

  return (
    <Collapsible
      defaultOpen={defaultOpen}
      open={open}
      onOpenChange={onOpenChange}
      className="group/disclosure border-t border-border pt-3"
    >
      <CollapsibleTrigger
        aria-describedby={described}
        className="flex w-full items-center justify-between gap-2 rounded-sm py-1 text-left font-semibold text-foreground"
      >
        {summaryBelow ? (
          <span className="flex min-w-0 flex-col">
            <span className="truncate">{title}</span>
            {summary !== undefined && (
              <span
                id={summaryId}
                aria-hidden
                className="truncate text-caption font-normal text-muted-foreground"
              >
                {summary}
              </span>
            )}
          </span>
        ) : (
          title
        )}
        <span className="flex items-center gap-1.5">
          {!summaryBelow && summary !== undefined && (
            <span
              id={summaryId}
              aria-hidden
              className="text-right text-caption font-normal text-muted-foreground"
            >
              {summary}
            </span>
          )}
          <ChevronDownIcon
            aria-hidden
            className="size-4 shrink-0 text-muted-foreground transition-transform duration-(--duration-fast) ease-standard group-data-open/disclosure:rotate-180"
          />
        </span>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="flex flex-col gap-4 pt-3 pb-1">{children}</div>
      </CollapsibleContent>
    </Collapsible>
  );
}
