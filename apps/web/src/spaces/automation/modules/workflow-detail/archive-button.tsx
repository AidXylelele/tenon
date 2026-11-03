'use client';

import { ArchiveIcon } from 'lucide-react';
import { useTransition } from 'react';
import { toast } from 'sonner';
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
import { archiveAction } from './actions';

export function ArchiveButton({
  namespace,
  name,
}: {
  readonly namespace: string;
  readonly name: string;
}) {
  const [pending, start] = useTransition();

  function archive() {
    start(async () => {
      const outcome = await archiveAction(namespace, name);

      if (!outcome.ok) toast.error(outcome.problem.detail);
      else toast.success(`${name} archived`);
    });
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" disabled={pending}>
          {pending ? (
            <Spinner data-icon="inline-start" />
          ) : (
            <ArchiveIcon data-icon="inline-start" />
          )}
          Archive
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Archive {name}?</AlertDialogTitle>
          <AlertDialogDescription>
            It is turned off, takes no new version and starts no run. Its
            versions and past runs stay readable. Archiving cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep it</AlertDialogCancel>
          <AlertDialogAction onClick={archive}>Archive</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
