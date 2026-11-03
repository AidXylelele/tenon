'use client';

import { useTransition } from 'react';
import { toast } from 'sonner';
import { Button } from '@/libs/ui/components/button';
import { Spinner } from '@/libs/ui/components/spinner';
import { revokeAction } from './actions';

export function RevokeButton({
  id,
  email,
}: {
  readonly id: string;
  readonly email: string;
}) {
  const [pending, start] = useTransition();

  function revoke() {
    start(async () => {
      const state = await revokeAction(id);

      if (state.problem !== null) toast.error(state.problem.detail);
      else toast.success(`Invitation for ${email} revoked`);
    });
  }

  return (
    <Button variant="ghost" size="sm" onClick={revoke} disabled={pending}>
      {pending && <Spinner data-icon="inline-start" />}
      Revoke
    </Button>
  );
}
