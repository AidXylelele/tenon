'use client';

import { KeyRoundIcon, PencilIcon, PlusIcon } from 'lucide-react';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import type { Problem } from '@/libs/data-access/problem';
import { Button } from '@/libs/ui/components/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/libs/ui/components/dialog';
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from '@/libs/ui/components/field';
import { Input } from '@/libs/ui/components/input';
import { Spinner } from '@/libs/ui/components/spinner';
import { Textarea } from '@/libs/ui/components/textarea';
import { ProblemMessage } from '@/libs/ui/composites/problem-message';
import { createSecretAction, replaceSecretAction } from './actions';

const SHAPES = [
  { label: 'Basic', value: '{\n  "username": "",\n  "password": ""\n}' },
  { label: 'Bearer', value: '{\n  "token": ""\n}' },
];

// Creates a secret, or replaces the value of one (`name` given). The value is typed here once
// and never shown again.
export function SecretValueDialog({ name }: { readonly name?: string }) {
  const replacing = name !== undefined;
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState('');
  const [problem, setProblem] = useState<Problem | null>(null);
  const [pending, start] = useTransition();

  function change(next: boolean) {
    setOpen(next);
    setValue('');
    setProblem(null);
  }

  function submit(form: FormData) {
    const chosen = replacing ? name : String(form.get('name') ?? '').trim();
    setProblem(null);
    start(async () => {
      const outcome = replacing
        ? await replaceSecretAction(chosen, value)
        : await createSecretAction(chosen, value);

      if (!outcome.ok) {
        setProblem(outcome.problem);
        return;
      }

      toast.success(
        replacing
          ? `${chosen} replaced; the next runs use the new value`
          : `${chosen} kept`,
      );
      change(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={change}>
      <DialogTrigger asChild>
        {replacing ? (
          <Button variant="ghost" size="sm">
            <PencilIcon data-icon="inline-start" />
            Replace
          </Button>
        ) : (
          <Button>
            <PlusIcon data-icon="inline-start" />
            New secret
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <form action={submit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRoundIcon className="size-4" />
              {replacing ? `Replace ${name}` : 'New secret'}
            </DialogTitle>
            <DialogDescription>
              Kept encrypted and resolved only while a run needs it; masked
              wherever a run records it.
            </DialogDescription>
          </DialogHeader>
          <ProblemMessage problem={problem} />
          <FieldGroup>
            {!replacing && (
              <Field>
                <FieldLabel htmlFor="secret-name">Name</FieldLabel>
                <Input
                  id="secret-name"
                  name="name"
                  required
                  pattern="[A-Za-z0-9_\-]{1,120}"
                  placeholder="crm-login"
                  className="font-mono text-xs"
                  autoFocus
                />
                <FieldDescription>
                  Letters, digits, dashes and underscores. Workflows refer to it
                  by this name.
                </FieldDescription>
              </Field>
            )}
            <Field>
              <div className="flex items-center justify-between">
                <FieldLabel htmlFor="secret-value">Value</FieldLabel>
                <span className="flex gap-1">
                  {SHAPES.map((shape) => (
                    <Button
                      key={shape.label}
                      type="button"
                      variant="ghost"
                      size="xs"
                      onClick={() => setValue(shape.value)}
                    >
                      {shape.label}
                    </Button>
                  ))}
                </span>
              </div>
              <Textarea
                id="secret-value"
                value={value}
                onChange={(event) => setValue(event.target.value)}
                required
                maxLength={16384}
                rows={5}
                spellCheck={false}
                autoComplete="off"
                className="font-mono text-xs"
                autoFocus={replacing}
              />
              <FieldDescription>
                Text, or JSON: basic authentication takes a username and
                password, bearer a token.
              </FieldDescription>
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button type="submit" disabled={pending || value === ''}>
              {pending && <Spinner data-icon="inline-start" />}
              {replacing ? 'Replace value' : 'Keep secret'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
