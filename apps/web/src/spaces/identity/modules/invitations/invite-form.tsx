'use client';

import { useActionState, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { IDLE } from '@/libs/forms/form-state';
import { Field, FieldLabel } from '@/libs/ui/components/field';
import { Input } from '@/libs/ui/components/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/libs/ui/components/select';
import { ProblemMessage } from '@/libs/ui/composites/problem-message';
import { SubmitButton } from '@/libs/ui/composites/submit-button';
import { inviteAction } from './actions';

export function InviteForm() {
  const [state, action] = useActionState(inviteAction, IDLE);
  const form = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!state.done) return;

    form.current?.reset();
    toast.success(`Invitation emailed to ${state.values.email}`);
  }, [state]);

  return (
    <form ref={form} action={action} className="flex flex-col gap-3">
      <ProblemMessage problem={state.problem} />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <Field className="flex-1">
          <FieldLabel htmlFor="invite-email">Email</FieldLabel>
          <Input
            id="invite-email"
            name="email"
            type="email"
            required
            placeholder="name@company.com"
            defaultValue={state.values.email}
          />
        </Field>
        <Field className="sm:w-40">
          <FieldLabel htmlFor="invite-role">Role</FieldLabel>
          <Select name="role" defaultValue={state.values.role ?? 'editor'}>
            <SelectTrigger id="invite-role" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="editor">Editor</SelectItem>
              <SelectItem value="viewer">Viewer</SelectItem>
              <SelectItem value="admin">Administrator</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <SubmitButton pendingLabel="Inviting…">Invite</SubmitButton>
      </div>
    </form>
  );
}
