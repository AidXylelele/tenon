"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import type { Outcome, Problem } from "@/libs/data-access/problem";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "../components/alert-dialog";
import { Button } from "../components/button";
import { Spinner } from "../components/spinner";
import { Tooltip, TooltipContent, TooltipTrigger } from "../components/tooltip";
import { ProblemMessage } from "./problem-message";

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
  const controlled = open !== undefined;
  const shown = open ?? ownOpen;
  const [refusal, setRefusal] = useState<Problem | null>(null);
  const [pending, start] = useTransition();
  const iconOnly = size === "icon-sm";

  function change(next: boolean) {
    setOwnOpen(next);
    onOpenChange?.(next);

    if (!next) setRefusal(null);
  }

  function act(event: React.MouseEvent) {
    event.preventDefault();
    start(async () => {
      const outcome = await action();

      if (!outcome.ok) {
        setRefusal(outcome.problem);
        return;
      }

      change(false);
      toast.success(success);
      onDone?.();
    });
  }

  const trigger = (
    <AlertDialogTrigger asChild>
      <Button variant="ghost" size={size} aria-label={label}>
        {icon}
        {!iconOnly && label}
      </Button>
    </AlertDialogTrigger>
  );

  const opener = iconOnly ? (
    <Tooltip>
      <TooltipTrigger asChild>{trigger}</TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  ) : (
    trigger
  );

  return (
    <AlertDialog open={shown} onOpenChange={change}>
      {!controlled && opener}
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <ProblemMessage problem={refusal} />
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Keep it</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={act}
            disabled={pending}
            aria-busy={pending}
          >
            {pending && <Spinner data-icon="inline-start" />}
            {actionLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
