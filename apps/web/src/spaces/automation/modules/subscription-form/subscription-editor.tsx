'use client';

import { PlusIcon, XIcon } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { codeOf, type Problem } from '@/libs/data-access/problem';
import type {
  DeliveryScheme,
  Endpoint,
  JsonObject,
  JsonValue,
} from '@/libs/data-access/types';
import { Button } from '@/libs/ui/components/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/libs/ui/components/card';
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
import { ProblemMessage } from '@/libs/ui/composites/problem-message';
import { createSubscriptionAction } from './actions';

const ATTRIBUTES = [
  'type',
  'source',
  'subject',
  'id',
  'datacontenttype',
  'dataschema',
  'data',
] as const;

const PRESETS = [
  {
    label: 'Any run that fails',
    value: 'io.serverlessworkflow.workflow.faulted.v1',
  },
  {
    label: 'Any run that completes',
    value: 'io.serverlessworkflow.workflow.completed.v1',
  },
];

interface Row {
  // Keeps a row's fields and its error with it when another row is removed.
  readonly id: string;
  readonly attribute: (typeof ATTRIBUTES)[number];
  readonly value: string;
}

const NONE = 'none';

// A subscription from fields: where to deliver, how to authenticate, and which events to take,
// with the API's refusal shown on the row or field it concerns (002 FR-025).
export function SubscriptionEditor({
  secretNames,
}: {
  readonly secretNames: readonly string[];
}) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [uri, setUri] = useState('https://');
  const [scheme, setScheme] = useState<DeliveryScheme | typeof NONE>(NONE);
  const [secret, setSecret] = useState(secretNames[0] ?? '');
  const [rows, setRows] = useState<readonly Row[]>(() => [
    {
      id: crypto.randomUUID(),
      attribute: 'type',
      value: 'com.example.order.paid',
    },
  ]);
  const [problem, setProblem] = useState<Problem | null>(null);
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();
  const located = problem?.errors[0];
  const foreign =
    problem !== null && codeOf(problem) === 'subscription.foreign-secret';

  function rowProblem(row: Row): string | null {
    if (located === undefined) return null;

    return located.pointer === `/filter/with/${row.attribute}` ||
      located.pointer.startsWith(`/filter/with/${row.attribute}/`)
      ? located.detail
      : null;
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const filter: JsonObject = {};
    const errors: Record<string, string> = {};

    rows.forEach((row) => {
      if (row.value.trim() === '') return;

      const value = valueOf(row);

      if (value === undefined)
        errors[row.id] = 'Data is matched by a JSON object it must contain';
      else filter[row.attribute] = value;
    });
    setRowErrors(errors);

    if (Object.keys(errors).length > 0) return;

    const endpoint: Endpoint =
      scheme === NONE ? { uri } : { uri, authentication: { scheme, secret } };
    setProblem(null);
    start(async () => {
      const outcome = await createSubscriptionAction(name.trim(), endpoint, {
        with: filter,
      });

      if (!outcome.ok) {
        setProblem(outcome.problem);
        return;
      }

      toast.success(`${outcome.value.name} subscribed`, {
        description: 'Matching events are delivered from now on.',
      });
      router.push(`/subscriptions/${outcome.value.id}`);
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-6">
      <ProblemMessage problem={problem} />
      <Card>
        <CardHeader>
          <CardTitle>Endpoint</CardTitle>
          <CardDescription>
            Events are POSTed there as CloudEvents in JSON, retried for about a
            day when refused.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="subscription-name">Name</FieldLabel>
              <Input
                id="subscription-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                maxLength={120}
                placeholder="CRM"
                autoFocus
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="subscription-uri">URL</FieldLabel>
              <Input
                id="subscription-uri"
                value={uri}
                onChange={(e) => setUri(e.target.value)}
                required
                type="url"
                className="font-mono text-xs"
              />
              <FieldDescription>
                An http or https address the platform may reach; private
                networks are refused.
              </FieldDescription>
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="subscription-auth">
                  Authentication
                </FieldLabel>
                <Select
                  value={scheme}
                  onValueChange={(next) =>
                    setScheme(next as DeliveryScheme | typeof NONE)
                  }
                >
                  <SelectTrigger id="subscription-auth" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>None</SelectItem>
                    <SelectItem value="basic">Basic, from a secret</SelectItem>
                    <SelectItem value="bearer">
                      Bearer token, from a secret
                    </SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              {scheme !== NONE && (
                <Field data-invalid={foreign}>
                  <FieldLabel htmlFor="subscription-secret">Secret</FieldLabel>
                  {secretNames.length === 0 ? (
                    <FieldDescription>
                      You have no secrets yet.{' '}
                      <Link
                        href="/secrets"
                        className="underline underline-offset-4"
                      >
                        Add one
                      </Link>{' '}
                      first.
                    </FieldDescription>
                  ) : (
                    <Select value={secret} onValueChange={setSecret}>
                      <SelectTrigger
                        id="subscription-secret"
                        className="w-full"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {secretNames.map((each) => (
                          <SelectItem key={each} value={each}>
                            {each}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  {foreign && <FieldError>{problem.detail}</FieldError>}
                </Field>
              )}
            </div>
          </FieldGroup>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Events to take</CardTitle>
          <CardDescription>
            Each attribute matches whole, as a regular expression or an
            expression such as{' '}
            <code className="font-mono">{'${ . > 100 }'}</code>; data matches a
            JSON object it contains. All rows must match.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-1.5">
            {PRESETS.map((preset) => (
              <button
                key={preset.value}
                type="button"
                onClick={() =>
                  setRows([
                    {
                      id: crypto.randomUUID(),
                      attribute: 'type',
                      value: preset.value,
                    },
                  ])
                }
                className="rounded-full border px-2.5 py-0.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                {preset.label}
              </button>
            ))}
          </div>
          {rows.map((row, index) => {
            const error = rowErrors[row.id] ?? rowProblem(row);

            return (
              <Field
                key={row.id}
                data-invalid={error !== null && error !== undefined}
              >
                <div className="flex gap-2">
                  <Select
                    value={row.attribute}
                    onValueChange={(attribute) =>
                      setRows(
                        rows.map((each, at) =>
                          at === index
                            ? {
                                ...each,
                                attribute: attribute as Row['attribute'],
                              }
                            : each,
                        ),
                      )
                    }
                  >
                    <SelectTrigger className="w-40" aria-label="Attribute">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ATTRIBUTES.map((attribute) => (
                        <SelectItem key={attribute} value={attribute}>
                          {attribute}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    aria-label="Matches"
                    value={row.value}
                    onChange={(e) =>
                      setRows(
                        rows.map((each, at) =>
                          at === index
                            ? { ...each, value: e.target.value }
                            : each,
                        ),
                      )
                    }
                    className="flex-1 font-mono text-xs"
                    placeholder={
                      row.attribute === 'data'
                        ? '{ "status": "paid" }'
                        : 'com\\.example\\..*'
                    }
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Remove"
                    disabled={rows.length === 1}
                    onClick={() =>
                      setRows(rows.filter((_, at) => at !== index))
                    }
                  >
                    <XIcon />
                  </Button>
                </div>
                {error !== null && error !== undefined && (
                  <FieldError>{error}</FieldError>
                )}
              </Field>
            );
          })}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="self-start"
            onClick={() =>
              setRows([
                ...rows,
                { id: crypto.randomUUID(), attribute: 'source', value: '' },
              ])
            }
          >
            <PlusIcon data-icon="inline-start" />
            Add a condition
          </Button>
        </CardContent>
      </Card>
      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending && <Spinner data-icon="inline-start" />}
          {pending ? 'Subscribing…' : 'Subscribe'}
        </Button>
        <Button type="button" variant="ghost" asChild>
          <Link href="/subscriptions">Cancel</Link>
        </Button>
      </div>
    </form>
  );
}

function valueOf(row: Row): JsonValue | undefined {
  if (row.attribute !== 'data') return row.value.trim();

  try {
    const parsed = JSON.parse(row.value) as JsonValue;
    return typeof parsed === 'object' &&
      parsed !== null &&
      !Array.isArray(parsed)
      ? parsed
      : undefined;
  } catch {
    return row.value.trim().startsWith('${') ? row.value.trim() : undefined;
  }
}
