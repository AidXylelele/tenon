'use client';

import { Trash2Icon } from 'lucide-react';
import { useTransition } from 'react';
import { toast } from 'sonner';
import type { Outcome } from '@/libs/data-access/problem';
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
} from '@/libs/ui/components/alert-dialog';
import { Button } from '@/libs/ui/components/button';
import { Spinner } from '@/libs/ui/components/spinner';

interface DeleteButtonProps {
  readonly what: string;
  readonly consequence: string;
  readonly onDelete: () => Promise<Outcome<void>>;
}

// Deletes after a confirmation that says what stops working.
export function DeleteButton({
  what,
  consequence,
  onDelete,
}: DeleteButtonProps) {
  const [pending, start] = useTransition();

  function remove() {
    start(async () => {
      const outcome = await onDelete();

      if (!outcome.ok) toast.error(outcome.problem.detail);
      else toast.success(`${what} deleted`);
    });
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`Delete ${what}`}
          disabled={pending}
        >
          {pending ? <Spinner /> : <Trash2Icon />}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {what}?</AlertDialogTitle>
          <AlertDialogDescription>{consequence}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep it</AlertDialogCancel>
          <AlertDialogAction onClick={remove}>Delete</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
