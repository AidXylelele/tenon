"use client";

import { EllipsisIcon, PencilIcon, Trash2Icon } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/libs/ui/components/dropdown-menu";
import { Spinner } from "@/libs/ui/components/spinner";
import { IconButton } from "@/libs/ui/composites/icon-button";
import { ProblemMessage } from "@/libs/ui/composites/problem-message";
import { deleteSecretAction } from "./actions";
import { SecretValueDialog } from "./secret-value-dialog";

interface SecretMenuProps {
  readonly name: string;
  readonly warning: string;
}

export function SecretMenu({ name, warning }: SecretMenuProps) {
  const [replacing, setReplacing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [refusal, setRefusal] = useState<Problem | null>(null);
  const [pending, start] = useTransition();
  const label = `Actions for ${name}`;
  const title = `Delete the secret ${name}?`;
  const description = `${warning} Its value cannot be recovered after deleting.`;

  function changeDeleting(next: boolean) {
    setDeleting(next);

    if (!next) setRefusal(null);
  }

  function remove(event: React.MouseEvent) {
    event.preventDefault();
    start(async () => {
      const outcome = await deleteSecretAction(name);

      if (!outcome.ok) {
        setRefusal(outcome.problem);
        return;
      }

      setDeleting(false);
      toast.success(`${name} deleted`);
    });
  }

  return (
    <>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <IconButton label={label} icon={EllipsisIcon} size="icon-sm" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onSelect={() => {
              setReplacing(true);
            }}
          >
            <PencilIcon aria-hidden />
            Replace value…
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            onSelect={() => {
              setDeleting(true);
            }}
          >
            <Trash2Icon aria-hidden />
            Delete…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <SecretValueDialog
        name={name}
        open={replacing}
        onOpenChange={setReplacing}
      />
      <AlertDialog open={deleting} onOpenChange={changeDeleting}>
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
              onClick={remove}
              disabled={pending}
              aria-busy={pending}
            >
              {pending ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <Trash2Icon data-icon="inline-start" />
              )}
              Delete secret
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
