'use client';

import { PlayIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useRef, useState, useTransition } from 'react';
import { toast } from 'sonner';
import type { Problem } from '@/libs/data-access/problem';
import type { JsonValue } from '@/libs/data-access/types';
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
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@/libs/ui/components/field';
import { Input } from '@/libs/ui/components/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/libs/ui/components/select';
import { Spinner } from '@/libs/ui/components/spinner';
import { Switch } from '@/libs/ui/components/switch';
import { Textarea } from '@/libs/ui/components/textarea';
import {
  ToggleGroup,
  ToggleGroupItem,
} from '@/libs/ui/components/toggle-group';
import { ProblemMessage } from '@/libs/ui/composites/problem-message';
import {
  type InputField,
  inputFrom,
} from '../../__shared_context/document/input-schema';
import { instanceHref } from '../../__shared_context/links';
import { startAction } from './actions';

interface StartDialogProps {
  readonly namespace: string;
  readonly name: string;
  readonly versions: readonly string[];
  readonly fields: readonly InputField[] | null;
  readonly defaultOpen?: boolean;
}

const LATEST = 'latest';

// Starts a run with an input. A retried start carries the same idempotency key, so the run
// exists once however often the request reaches the platform; changing what is started
// takes a new key (002 FR-009).
export function StartDialog({
  namespace,
  name,
  versions,
  fields,
  defaultOpen = false,
}: StartDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(defaultOpen);
  const [version, setVersion] = useState(LATEST);
  const [mode, setMode] = useState<'form' | 'json'>(
    fields === null ? 'json' : 'form',
  );
  const [values, setValues] = useState<Record<string, string>>(() =>
    initialValues(fields),
  );
  const [json, setJson] = useState('{}');
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [problem, setProblem] = useState<Problem | null>(null);
  const [pending, start] = useTransition();
  // One key per distinct start tried since the dialog opened, so going back to an input that
  // may already have started a run reuses that run's key.
  const keys = useRef(new Map<string, string>());

  function inputOf(): JsonValue | undefined {
    if (mode === 'form' && fields !== null) return inputFrom(fields, values);

    try {
      return JSON.parse(json) as JsonValue;
    } catch (error) {
      setJsonError(error instanceof Error ? error.message : 'Not JSON');
      return undefined;
    }
  }

  function keyFor(fingerprint: string): string {
    const known = keys.current.get(fingerprint);

    if (known !== undefined) return known;

    const key = crypto.randomUUID();
    keys.current.set(fingerprint, key);
    return key;
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const input = inputOf();

    if (input === undefined) return;

    const fingerprint = JSON.stringify([version, input]);
    const key = keyFor(fingerprint);
    setProblem(null);
    start(async () => {
      const outcome = await startAction(namespace, name, version, input, key);

      if (!outcome.ok) {
        setProblem(outcome.problem);
        return;
      }

      keys.current.clear();
      toast.success(`Started ${name}`, {
        description: 'Following the run live.',
      });
      router.push(instanceHref(outcome.value.id));
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);

        if (!next) keys.current.clear();
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <PlayIcon data-icon="inline-start" />
          Start
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={submit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Start {name}</DialogTitle>
            <DialogDescription>
              The run gets this input as its data. You follow it live on its
              page.
            </DialogDescription>
          </DialogHeader>
          <ProblemMessage problem={problem} />
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="start-version">Version</FieldLabel>
              <Select value={version} onValueChange={setVersion}>
                <SelectTrigger id="start-version" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={LATEST}>The current version</SelectItem>
                  {versions.map((each) => (
                    <SelectItem key={each} value={each}>
                      {each}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            {fields !== null && (
              <ToggleGroup
                type="single"
                variant="outline"
                size="sm"
                value={mode}
                onValueChange={(next) =>
                  next !== '' && setMode(next as 'form' | 'json')
                }
                className="self-start"
              >
                <ToggleGroupItem value="form">Form</ToggleGroupItem>
                <ToggleGroupItem value="json">JSON</ToggleGroupItem>
              </ToggleGroup>
            )}
            {mode === 'form' && fields !== null ? (
              fields.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  This workflow takes no input.
                </p>
              ) : (
                fields.map((field) => (
                  <InputFieldControl
                    key={field.name}
                    field={field}
                    value={values[field.name] ?? ''}
                    onChange={(value) =>
                      setValues({ ...values, [field.name]: value })
                    }
                  />
                ))
              )
            ) : (
              <Field data-invalid={jsonError !== null}>
                <FieldLabel htmlFor="start-input">Input</FieldLabel>
                <Textarea
                  id="start-input"
                  value={json}
                  onChange={(event) => {
                    setJson(event.target.value);
                    setJsonError(null);
                  }}
                  rows={8}
                  spellCheck={false}
                  className="font-mono text-xs"
                  aria-invalid={jsonError !== null}
                />
                {jsonError === null ? (
                  <FieldDescription>
                    Any JSON value, for example{' '}
                    {'{ "email": "ada@example.com" }'}.
                  </FieldDescription>
                ) : (
                  <FieldError>{jsonError}</FieldError>
                )}
              </Field>
            )}
          </FieldGroup>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Spinner data-icon="inline-start" />}
              {pending ? 'Starting…' : 'Start run'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function InputFieldControl({
  field,
  value,
  onChange,
}: {
  readonly field: InputField;
  readonly value: string;
  readonly onChange: (value: string) => void;
}) {
  const id = `input-${field.name}`;

  if (field.type === 'boolean')
    return (
      <Field orientation="horizontal">
        <Switch
          id={id}
          checked={value === 'true'}
          onCheckedChange={(on) => onChange(String(on))}
        />
        <FieldLabel htmlFor={id}>{field.name}</FieldLabel>
      </Field>
    );

  return (
    <Field>
      <FieldLabel htmlFor={id}>
        {field.name}
        {!field.required && (
          <span className="font-normal text-muted-foreground">optional</span>
        )}
      </FieldLabel>
      <Input
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={field.required}
        inputMode={field.type === 'string' ? undefined : 'decimal'}
      />
      {field.description !== '' && (
        <FieldDescription>{field.description}</FieldDescription>
      )}
    </Field>
  );
}

function initialValues(
  fields: readonly InputField[] | null,
): Record<string, string> {
  const values: Record<string, string> = {};

  for (const field of fields ?? [])
    if (field.fallback !== undefined && field.fallback !== null)
      values[field.name] = String(field.fallback);

  return values;
}
