"use client";

import { EllipsisIcon, Trash2Icon } from "lucide-react";
import { useState, useTransition } from "react";
import type { Problem } from "@/libs/data-access/problem";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/libs/ui/components/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/libs/ui/components/dropdown-menu";
import { Spinner } from "@/libs/ui/components/spinner";
import { IconButton } from "@/libs/ui/composites/icon-button";
import { ProblemMessage } from "@/libs/ui/composites/problem-message";
import { deleteSubscriptionAction } from "./actions";

interface NotificationMenuProps {
  readonly id: string;
  readonly name: string;
}

export function NotificationMenu({ id, name }: NotificationMenuProps) {
  const [deleting, setDeleting] = useState(false);
  const [refusal, setRefusal] = useState<Problem | null>(null);
  const [pending, start] = useTransition();
  const title = `Delete the notification ${name}?`;

  function change(next: boolean) {
    setDeleting(next);

    if (!next) setRefusal(null);
  }

  function remove(event: React.MouseEvent) {
    event.preventDefault();
    start(async () => {
      const outcome = await deleteSubscriptionAction(id);

      if (!outcome.ok) setRefusal(outcome.problem);
    });
  }

  return (
    <>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <IconButton label="More actions" icon={EllipsisIcon} />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            variant="destructive"
            onSelect={() => {
              setDeleting(true);
            }}
          >
            <Trash2Icon aria-hidden />
            Delete notification…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <AlertDialog open={deleting} onOpenChange={change}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{title}</AlertDialogTitle>
            <AlertDialogDescription>
              Nothing more is delivered to it, and its pending retries stop.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <ProblemMessage problem={refusal} />
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Keep it</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={remove}
              disabled={pending}
              aria-busy={pending}
            >
              {pending ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <Trash2Icon data-icon="inline-start" />
              )}
              Delete notification
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
