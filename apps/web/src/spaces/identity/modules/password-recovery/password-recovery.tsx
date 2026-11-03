'use client';

import { MailCheckIcon } from 'lucide-react';
import Link from 'next/link';
import { useActionState } from 'react';
import { IDLE } from '@/libs/forms/form-state';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@/libs/ui/components/alert';
import {
  Field,
  FieldDescription,
  FieldLabel,
} from '@/libs/ui/components/field';
import { Input } from '@/libs/ui/components/input';
import { ProblemMessage } from '@/libs/ui/composites/problem-message';
import { SubmitButton } from '@/libs/ui/composites/submit-button';
import { SIGN_IN_HREF } from '@/operations/app-routes';
import { AuthCard } from '../../__shared_context/auth-card';
import { requestRecoveryAction } from './actions';

// The answer is the same whether or not the address has an account (001 spec).
export function PasswordRecovery() {
  const [state, action] = useActionState(requestRecoveryAction, IDLE);
  const back = (
    <Link href={SIGN_IN_HREF} className="underline-offset-4 hover:underline">
      Back to sign in
    </Link>
  );

  if (state.done)
    return (
      <AuthCard title="Check your email" footer={back}>
        <Alert>
          <MailCheckIcon />
          <AlertTitle>
            A link is on its way if the address has an account
          </AlertTitle>
          <AlertDescription>
            It goes to {state.values.email} and works for one hour. Open it to
            choose a new password.
          </AlertDescription>
        </Alert>
      </AuthCard>
    );

  return (
    <AuthCard
      title="Reset your password"
      description="We email a link to set a new one."
      footer={back}
    >
      <form action={action} className="flex flex-col gap-4">
        <ProblemMessage problem={state.problem} />
        <Field>
          <FieldLabel htmlFor="email">Email</FieldLabel>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            autoFocus
            defaultValue={state.values.email}
          />
          <FieldDescription>The address you sign in with.</FieldDescription>
        </Field>
        <SubmitButton size="lg" pendingLabel="Sending…">
          Email me a link
        </SubmitButton>
      </form>
    </AuthCard>
  );
}
