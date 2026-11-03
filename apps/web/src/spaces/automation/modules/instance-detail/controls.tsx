'use client';

import {
  CircleStopIcon,
  PauseIcon,
  PlayIcon,
  RotateCcwIcon,
  Trash2Icon,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { toast } from 'sonner';
import type { Phase } from '@/libs/data-access/types';
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
import { instanceHref } from '../../__shared_context/links';
import { controlsOf } from '../../__shared_context/vocabulary';
import { controlAction, deleteAction, restartAction } from './actions';

// What may be done with the run in its phase (002 FR-017); a refusal says why.
export function Controls({
  id,
  phase,
}: {
  readonly id: string;
  readonly phase: Phase;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const allowed = controlsOf(phase);

  function control(kind: 'suspend' | 'resume' | 'cancel', done: string) {
    start(async () => {
      const outcome = await controlAction(id, kind);

      if (!outcome.ok) toast.error(outcome.problem.detail);
      else toast.success(done);
    });
  }

  function runAgain() {
    start(async () => {
      const outcome = await restartAction(id);

      if (!outcome.ok) {
        toast.error(outcome.problem.detail);
        return;
      }

      toast.success('Started again with the same version and input');
      router.push(instanceHref(outcome.value.id));
    });
  }

  function remove() {
    start(async () => {
      const outcome = await deleteAction(id);

      if (!outcome.ok) {
        toast.error(outcome.problem.detail);
        return;
      }

      toast.success('Run deleted');
      router.push('/instances');
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {pending && <Spinner className="text-muted-foreground" />}
      {allowed.suspend && (
        <Button
          variant="outline"
          disabled={pending}
          onClick={() =>
            control('suspend', 'Suspended: it waits until resumed')
          }
        >
          <PauseIcon data-icon="inline-start" />
          Suspend
        </Button>
      )}
      {allowed.resume && (
        <Button
          variant="outline"
          disabled={pending}
          onClick={() => control('resume', 'Resumed')}
        >
          <PlayIcon data-icon="inline-start" />
          Resume
        </Button>
      )}
      {allowed.cancel && (
        <Confirm
          title="Cancel this run?"
          description="It stops where it is, with the runs it waits for. A cancelled run does not resume."
          action="Cancel the run"
          onConfirm={() => control('cancel', 'Cancelled')}
        >
          <Button variant="outline" disabled={pending}>
            <CircleStopIcon data-icon="inline-start" />
            Cancel
          </Button>
        </Confirm>
      )}
      {allowed.restart && (
        <Button variant="outline" disabled={pending} onClick={runAgain}>
          <RotateCcwIcon data-icon="inline-start" />
          Run again
        </Button>
      )}
      {allowed.remove && (
        <Confirm
          title="Delete this run?"
          description="Its record, steps and events are removed for good."
          action="Delete"
          onConfirm={remove}
        >
          <Button variant="ghost" disabled={pending}>
            <Trash2Icon data-icon="inline-start" />
            Delete
          </Button>
        </Confirm>
      )}
    </div>
  );
}

function Confirm({
  title,
  description,
  action,
  onConfirm,
  children,
}: {
  readonly title: string;
  readonly description: string;
  readonly action: string;
  readonly onConfirm: () => void;
  readonly children: React.ReactNode;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>{children}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep it</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>{action}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
