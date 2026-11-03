'use client';

import { RefreshCwIcon, SendIcon } from 'lucide-react';
import { Link } from '@/libs/routing/link';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import type { Problem } from '@/libs/data-access/problem';
import type { CloudEvent, JsonValue } from '@/libs/data-access/types';
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
import { Spinner } from '@/libs/ui/components/spinner';
import { Textarea } from '@/libs/ui/components/textarea';
import { ProblemMessage } from '@/libs/ui/composites/problem-message';
import { Time } from '@/libs/ui/composites/time';
import { sendEventAction } from './actions';

interface Sent {
  readonly id: string;
  readonly type: string;
  readonly at: string;
}

// Sends a CloudEvent 1.0 the way another application would (002 FR-023), to try triggers,
// waiting steps and subscriptions. The id and time are filled in; the id is kept until the
// event is accepted, so a resend after a failure is the same event.
export function EventSender() {
  const [id, setId] = useState(() => crypto.randomUUID());
  const [type, setType] = useState('com.example.order.paid');
  const [source, setSource] = useState('/console');
  const [subject, setSubject] = useState('');
  const [data, setData] = useState('{\n  "orderId": 1,\n  "total": 42\n}');
  const [dataError, setDataError] = useState<string | null>(null);
  const [problem, setProblem] = useState<Problem | null>(null);
  const [sent, setSent] = useState<readonly Sent[]>([]);
  const [pending, start] = useTransition();

  function send(event: React.FormEvent) {
    event.preventDefault();
    let parsed: JsonValue | undefined;

    try {
      parsed = data.trim() === '' ? undefined : (JSON.parse(data) as JsonValue);
    } catch (error) {
      setDataError(error instanceof Error ? error.message : 'Not JSON');
      return;
    }

    const time = new Date().toISOString();
    const cloudEvent: CloudEvent = {
      specversion: '1.0',
      id,
      source,
      type,
      time,
      ...(subject === '' ? {} : { subject }),
      ...(parsed === undefined
        ? {}
        : { datacontenttype: 'application/json', data: parsed }),
    };
    setProblem(null);
    start(async () => {
      const outcome = await sendEventAction(cloudEvent);

      if (!outcome.ok) {
        setProblem(outcome.problem);
        return;
      }

      toast.success('Event accepted', {
        description: `${type}, id ${id.slice(0, 8)}`,
      });
      setSent([{ id, type, at: time }, ...sent].slice(0, 8));
      setId(crypto.randomUUID());
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <Card>
        <CardHeader>
          <CardTitle>Event</CardTitle>
          <CardDescription>
            Workflows that start on its type start; steps waiting for it go on;
            subscriptions that match get it.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={send} className="flex flex-col gap-4">
            <ProblemMessage problem={problem} />
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="event-type">Type</FieldLabel>
                <Input
                  id="event-type"
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  required
                  className="font-mono text-xs"
                />
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="event-source">Source</FieldLabel>
                  <Input
                    id="event-source"
                    value={source}
                    onChange={(e) => setSource(e.target.value)}
                    required
                    className="font-mono text-xs"
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="event-subject">
                    Subject{' '}
                    <span className="font-normal text-muted-foreground">
                      optional
                    </span>
                  </FieldLabel>
                  <Input
                    id="event-subject"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                  />
                </Field>
              </div>
              <Field data-invalid={dataError !== null}>
                <FieldLabel htmlFor="event-data">Data</FieldLabel>
                <Textarea
                  id="event-data"
                  value={data}
                  onChange={(e) => {
                    setData(e.target.value);
                    setDataError(null);
                  }}
                  rows={8}
                  spellCheck={false}
                  className="font-mono text-xs"
                />
                {dataError === null ? (
                  <FieldDescription>
                    JSON; leave empty for an event without data.
                  </FieldDescription>
                ) : (
                  <FieldError>{dataError}</FieldError>
                )}
              </Field>
              <Field>
                <FieldLabel htmlFor="event-id">Id</FieldLabel>
                <div className="flex gap-2">
                  <Input
                    id="event-id"
                    value={id}
                    readOnly
                    className="font-mono text-xs"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    aria-label="New id"
                    onClick={() => setId(crypto.randomUUID())}
                  >
                    <RefreshCwIcon />
                  </Button>
                </div>
                <FieldDescription>
                  The same source and id are one event: sending it again has no
                  effect.
                </FieldDescription>
              </Field>
            </FieldGroup>
            <div>
              <Button type="submit" disabled={pending}>
                {pending ? (
                  <Spinner data-icon="inline-start" />
                ) : (
                  <SendIcon data-icon="inline-start" />
                )}
                {pending ? 'Sending…' : 'Send event'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
      <Card className="h-fit">
        <CardHeader>
          <CardTitle>Sent from here</CardTitle>
          <CardDescription>
            What they started shows on{' '}
            <Link href="/instances" className="underline underline-offset-4">
              Runs
            </Link>
            .
          </CardDescription>
        </CardHeader>
        <CardContent>
          {sent.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing yet.</p>
          ) : (
            <ol className="flex flex-col divide-y">
              {sent.map((each) => (
                <li key={each.id} className="py-2 first:pt-0">
                  <div className="truncate font-mono text-xs">{each.type}</div>
                  <div className="text-xs text-muted-foreground">
                    <Time value={each.at} />, id {each.id.slice(0, 8)}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
