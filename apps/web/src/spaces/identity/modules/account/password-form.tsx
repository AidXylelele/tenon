'use client';

import { useActionState, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from '@/libs/ui/components/field';
import { Input } from '@/libs/ui/components/input';
import { ProblemMessage } from '@/libs/ui/composites/problem-message';
import { SubmitButton } from '@/libs/ui/composites/submit-button';
import {
  IDLE,
  PASSWORD_MAX,
  PASSWORD_MIN,
} from '../../__shared_context/form-state';
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
            maxLength={PASSWORD_MAX}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="newPassword">New password</FieldLabel>
          <Input
            id="newPassword"
            name="newPassword"
            type="password"
            autoComplete="new-password"
            required
            minLength={PASSWORD_MIN}
            maxLength={PASSWORD_MAX}
          />
          <FieldDescription>
            At least {PASSWORD_MIN} characters. This browser stays signed in;
            every other session ends.
          </FieldDescription>
        </Field>
      </FieldGroup>
      <div>
        <SubmitButton pendingLabel="Changing…">Change password</SubmitButton>
      </div>
    </form>
  );
}
