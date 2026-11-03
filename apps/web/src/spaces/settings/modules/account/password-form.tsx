'use client';

import { useActionState, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { IDLE } from '@/libs/forms/form-state';
import { Field, FieldGroup, FieldLabel } from '@/libs/ui/components/field';
import { Input } from '@/libs/ui/components/input';
import { ProblemMessage } from '@/libs/ui/composites/problem-message';
import { SubmitButton } from '@/libs/ui/composites/submit-button';
import { NewPasswordField } from '@/features/new-password-field';
import { changePasswordAction } from './actions';

export function PasswordForm() {
  const [state, action] = useActionState(changePasswordAction, IDLE);
  const form = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!state.done) return;

    form.current?.reset();
    toast.success('Password changed. Your other sessions have ended.');
  }, [state]);

  return (
    <form ref={form} action={action} className="flex max-w-md flex-col gap-4">
      <ProblemMessage problem={state.problem} />
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="currentPassword">Current password</FieldLabel>
          <Input
            id="currentPassword"
            name="currentPassword"
            type="password"
            autoComplete="current-password"
            required
          />
        </Field>
        <NewPasswordField
          name="newPassword"
          label="New password"
          note="This browser stays signed in; every other session ends."
        />
      </FieldGroup>
      <div>
        <SubmitButton pendingLabel="Changing…">Change password</SubmitButton>
      </div>
    </form>
  );
}
