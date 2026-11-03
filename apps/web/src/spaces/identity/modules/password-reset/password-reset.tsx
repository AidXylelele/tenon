'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { IDLE } from '@/libs/forms/form-state';
import {
  Field,
  FieldDescription,
  FieldLabel,
} from '@/libs/ui/components/field';
import { Input } from '@/libs/ui/components/input';
import { ProblemMessage } from '@/libs/ui/composites/problem-message';
import { SubmitButton } from '@/libs/ui/composites/submit-button';
import { FORGOT_PASSWORD_HREF } from '@/operations/app-routes';
import { AuthCard } from '../../__shared_context/auth-card';
import { PASSWORD_MAX, PASSWORD_MIN } from '../../__shared_context/password';
import { resetPasswordAction } from './actions';

export function PasswordReset({ token }: { readonly token: string }) {
  const [state, action] = useActionState(resetPasswordAction, IDLE);
  const again = (
    <Link
      href={FORGOT_PASSWORD_HREF}
      className="underline-offset-4 hover:underline"
    >
      Ask for a new link
    </Link>
  );

  if (token === '')
    return (
      <AuthCard
        title="This link is incomplete"
        description="Open the link from the email as it is, or ask for a new one."
        footer={again}
      >
        <p className="text-sm text-muted-foreground">
          No token was found in the address.
        </p>
      </AuthCard>
    );

  return (
    <AuthCard
      title="Choose a new password"
      description="Every session of your account ends, and you sign in with the new password."
      footer={again}
    >
      <form action={action} className="flex flex-col gap-4">
        <input type="hidden" name="token" value={token} />
        <ProblemMessage problem={state.problem} />
        <Field>
          <FieldLabel htmlFor="password">New password</FieldLabel>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={PASSWORD_MIN}
            maxLength={PASSWORD_MAX}
            autoFocus
          />
          <FieldDescription>
            At least {PASSWORD_MIN} characters.
          </FieldDescription>
        </Field>
        <SubmitButton size="lg" pendingLabel="Saving…">
          Set password
        </SubmitButton>
      </form>
    </AuthCard>
  );
}
