"use client";

import { useRef, useState, useTransition } from "react";
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
} from "../components/alert-dialog";
import { Spinner } from "../components/spinner";
import { ProblemMessage } from "./problem-message";

type FocusTarget = () => HTMLElement | null | undefined;

export interface ConfirmDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly title: string;
  readonly description: string;
  readonly actionLabel: string;
  readonly icon?: React.ReactNode;
  readonly action: () => Promise<Outcome<void>>;
  readonly success: string;
  readonly returnFocus?: FocusTarget;
  readonly doneFocus?: FocusTarget;
  readonly onDone?: () => void;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  actionLabel,
  icon,
  action,
  success,
  returnFocus,
  doneFocus,
  onDone,
}: ConfirmDialogProps) {
  const [refusal, setRefusal] = useState<Problem | null>(null);
  const [pending, start] = useTransition();
  const done = useRef(false);

  function change(next: boolean) {
    onOpenChange(next);

    if (!next) setRefusal(null);

    if (next) done.current = false;
  }

  function act(event: React.MouseEvent) {
    event.preventDefault();
    start(async () => {
      const outcome = await action();

      if (!outcome.ok) {
        setRefusal(outcome.problem);
        return;
      }

      done.current = true;
      change(false);
      toast.success(success);
      onDone?.();
    });
  }

  function giveFocusBack(event: Event) {
    const target = done.current ? (doneFocus ?? returnFocus) : returnFocus;
    const element = target?.();

    if (element === null || element === undefined || !element.isConnected)
      return;

    event.preventDefault();
    element.focus();
  }

  return (
    <AlertDialog open={open} onOpenChange={change}>
      <AlertDialogContent onCloseAutoFocus={giveFocusBack}>
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
            {pending ? <Spinner data-icon="inline-start" /> : icon}
            {actionLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
