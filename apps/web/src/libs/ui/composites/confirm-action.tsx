'use client';

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
} from '../components/alert-dialog';
import { Button } from '../components/button';
import { Spinner } from '../components/spinner';

interface ConfirmActionProps {
  readonly icon: React.ReactNode;
  // Names the button; it is shown beside the icon unless the size is an icon's.
  readonly label: string;
  readonly size?: 'icon-sm' | 'default';
  readonly title: string;
  // What the action changes, so the person knows what they confirm.
  readonly description: string;
  readonly actionLabel: string;
  readonly action: () => Promise<Outcome<void>>;
  readonly success: string;
}

// A button that acts after a confirmation, then says how it went: the success text, or the
// refusal's detail.
export function ConfirmAction({
  icon,
  label,
  size = 'default',
  title,
  description,
  actionLabel,
  action,
  success,
}: ConfirmActionProps) {
  const [pending, start] = useTransition();
  const iconOnly = size === 'icon-sm';

  function act() {
    start(async () => {
      const outcome = await action();

      if (!outcome.ok) toast.error(outcome.problem.detail);
      else toast.success(success);
    });
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          variant="ghost"
          size={size}
          aria-label={label}
          disabled={pending}
        >
          {pending ? <Spinner data-icon="inline-start" /> : icon}
          {!iconOnly && label}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep it</AlertDialogCancel>
          <AlertDialogAction onClick={act}>{actionLabel}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
