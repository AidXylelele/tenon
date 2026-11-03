'use client';

import { useActionState } from 'react';
import { IDLE } from '@/libs/forms/form-state';
import { Field, FieldGroup, FieldLabel } from '@/libs/ui/components/field';
import { Input } from '@/libs/ui/components/input';
import { ProblemMessage } from '@/libs/ui/composites/problem-message';
import { SubmitButton } from '@/libs/ui/composites/submit-button';
import { NewPasswordField } from '@/features/new-password-field';
import { acceptInvitationAction } from './actions';

export function InvitationForm({
  token,
  email,
}: {
  readonly token: string;
  readonly email: string;
}) {
  const [state, action] = useActionState(acceptInvitationAction, IDLE);

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="token" value={token} />
      <ProblemMessage problem={state.problem} />
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="email">Email</FieldLabel>
          <Input id="email" value={email} readOnly disabled />
        </Field>
        <Field>
          <FieldLabel htmlFor="name">Your name</FieldLabel>
          <Input
            id="name"
            name="name"
            autoComplete="name"
            required
            maxLength={120}
            autoFocus
            defaultValue={state.values.name}
          />
        </Field>
        <NewPasswordField name="password" label="Password" />
      </FieldGroup>
      <SubmitButton size="lg" pendingLabel="Creating your account…">
        Create account
      </SubmitButton>
    </form>
  );
}
