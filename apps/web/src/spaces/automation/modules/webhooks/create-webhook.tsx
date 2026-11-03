'use client';

import { CircleCheckIcon, PlusIcon } from 'lucide-react';
import { useState, useTransition } from 'react';
import type { Problem } from '@/libs/data-access/problem';
import type { CreatedWebhook } from '@/libs/data-access/types';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@/libs/ui/components/alert';
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
import { CopyButton } from '@/libs/ui/composites/copy-button';
import { ProblemMessage } from '@/libs/ui/composites/problem-message';
import { createWebhookAction } from './actions';

// Creates a webhook and shows its URL once, with an example call; closing forgets it.
export function CreateWebhook() {
  const [open, setOpen] = useState(false);
  const [created, setCreated] = useState<CreatedWebhook | null>(null);
  const [problem, setProblem] = useState<Problem | null>(null);
  const [pending, start] = useTransition();

  function submit(form: FormData) {
    const name = String(form.get('name') ?? '').trim();
    const eventType = String(form.get('eventType') ?? '').trim();
    setProblem(null);
    start(async () => {
      const outcome = await createWebhookAction(name, eventType);

      if (outcome.ok) setCreated(outcome.value);
      else setProblem(outcome.problem);
    });
  }

  function change(next: boolean) {
    setOpen(next);

    if (next) return;

    setCreated(null);
    setProblem(null);
  }

  return (
    <Dialog open={open} onOpenChange={change}>
      <DialogTrigger asChild>
        <Button>
          <PlusIcon data-icon="inline-start" />
          New webhook
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        {created === null ? (
          <form action={submit} className="flex flex-col gap-4">
            <DialogHeader>
              <DialogTitle>New webhook</DialogTitle>
              <DialogDescription>
                Other applications call its URL without signing in; each call
                becomes one event of the type you choose.
              </DialogDescription>
            </DialogHeader>
            <ProblemMessage problem={problem} />
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="webhook-name">Name</FieldLabel>
                <Input
                  id="webhook-name"
                  name="name"
                  required
                  maxLength={120}
                  placeholder="Website form"
                  autoFocus
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="webhook-type">Event type</FieldLabel>
                <Input
                  id="webhook-type"
                  name="eventType"
                  required
                  maxLength={255}
                  placeholder="com.example.form.submitted"
                  className="font-mono text-xs"
                />
                <FieldDescription>
                  Workflows that start or wait on this type receive the calls.
                </FieldDescription>
              </Field>
            </FieldGroup>
            <DialogFooter>
              <Button type="submit" disabled={pending}>
                {pending && <Spinner data-icon="inline-start" />}
                {pending ? 'Creating…' : 'Create webhook'}
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <Created webhook={created} onDone={() => change(false)} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function Created({
  webhook,
  onDone,
}: {
  readonly webhook: CreatedWebhook;
  readonly onDone: () => void;
}) {
  const example = `curl -X POST '${webhook.url}' \\\n  -H 'content-type: application/json' \\\n  -H 'Idempotency-Key: form-1' \\\n  -d '{"email": "ada@example.com"}'`;

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <DialogHeader>
        <DialogTitle>{webhook.name} is ready</DialogTitle>
        <DialogDescription>
          Each call becomes an event of type {webhook.eventType}.
        </DialogDescription>
      </DialogHeader>
      <Alert>
        <CircleCheckIcon />
        <AlertTitle>Copy the URL now</AlertTitle>
        <AlertDescription>
          It is shown only here; the platform keeps only its fingerprint. A lost
          URL means a new webhook.
        </AlertDescription>
      </Alert>
      <div className="flex min-w-0 items-center gap-2 rounded-lg border bg-muted/40 p-2">
        <code className="min-w-0 flex-1 truncate font-mono text-xs">
          {webhook.url}
        </code>
        <CopyButton value={webhook.url} label="Copy URL" size="sm" />
      </div>
      <div className="flex min-w-0 flex-col gap-1">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">
            Try it from a terminal
          </span>
          <CopyButton value={example} label="Copy command" size="icon-xs" />
        </div>
        <pre className="overflow-x-auto rounded-lg border bg-muted/40 p-3 font-mono text-xs">
          {example}
        </pre>
        <p className="text-xs text-muted-foreground">
          Calls with the same Idempotency-Key are one event, however often they
          come.
        </p>
      </div>
      <DialogFooter>
        <Button onClick={onDone}>Done</Button>
      </DialogFooter>
    </div>
  );
}
