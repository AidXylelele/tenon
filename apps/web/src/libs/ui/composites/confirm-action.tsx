"use client";

import { useRef, useState } from "react";
import type { Outcome } from "@/libs/data-access/problem";
import { Button } from "../components/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "../components/tooltip";
import { ConfirmDialog } from "./confirm-dialog";

interface ConfirmActionProps {
  readonly icon: React.ReactNode;
  readonly label: string;
  readonly size?: "icon-sm" | "default";
  readonly title: string;
  readonly description: string;
  readonly actionLabel: string;
  readonly action: () => Promise<Outcome<void>>;
  readonly success: string;
  readonly onDone?: () => void;
  readonly open?: boolean;
  readonly onOpenChange?: (open: boolean) => void;
}

export function ConfirmAction({
  icon,
  label,
  size = "default",
  title,
  description,
  actionLabel,
  action,
  success,
  onDone,
  open,
  onOpenChange,
}: ConfirmActionProps) {
  const [ownOpen, setOwnOpen] = useState(false);
  const opener = useRef<HTMLButtonElement>(null);
  const controlled = open !== undefined;
  const shown = open ?? ownOpen;
  const iconOnly = size === "icon-sm";

  function change(next: boolean) {
    setOwnOpen(next);
    onOpenChange?.(next);
  }

  const trigger = (
    <Button
      ref={opener}
      variant="ghost"
      size={size}
      aria-label={label}
      onClick={() => {
        change(true);
      }}
    >
      {icon}
      {!iconOnly && label}
    </Button>
  );

  const button = iconOnly ? (
    <Tooltip>
      <TooltipTrigger asChild>{trigger}</TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  ) : (
    trigger
  );

  return (
    <>
      {!controlled && button}
      <ConfirmDialog
        open={shown}
        onOpenChange={change}
        title={title}
        description={description}
        actionLabel={actionLabel}
        action={action}
        success={success}
        returnFocus={() => opener.current}
        onDone={onDone}
      />
    </>
  );
}
