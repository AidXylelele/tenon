'use client';

import { useOptimistic, useTransition } from 'react';
import { toast } from 'sonner';
import { Spinner } from '@/libs/ui/components/spinner';
import { Switch } from '@/libs/ui/components/switch';
import { turnAction } from './actions';

interface OnOffSwitchProps {
  readonly namespace: string;
  readonly name: string;
  readonly on: boolean;
  readonly disabled: boolean;
}

// Turns automatic starts on and off; the switch moves at once and returns with the API's
// reason when the API refuses (US5 scenario 2).
export function OnOffSwitch({
  namespace,
  name,
  on,
  disabled,
}: OnOffSwitchProps) {
  const [shown, setShown] = useOptimistic(on);
  const [pending, start] = useTransition();

  function turn(next: boolean) {
    start(async () => {
      setShown(next);
      const outcome = await turnAction(namespace, name, next);

      if (!outcome.ok) toast.error(outcome.problem.detail);
      else
        toast.success(
          next
            ? 'Turned on: it now starts by itself'
            : 'Turned off: it starts only by hand',
        );
    });
  }

  return (
    <div className="flex items-center gap-2">
      {pending && <Spinner className="size-3.5 text-muted-foreground" />}
      <Switch
        checked={shown}
        onCheckedChange={turn}
        disabled={disabled || pending}
        aria-label="Starts automatically"
      />
      <span className="w-6 text-sm font-medium">{shown ? 'On' : 'Off'}</span>
    </div>
  );
}
