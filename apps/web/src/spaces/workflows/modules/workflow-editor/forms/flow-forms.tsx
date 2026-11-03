'use client';

import { PlusIcon, XIcon } from 'lucide-react';
import {
  isObject,
  type JsonObject,
  type JsonValue,
} from '@/libs/document-text/json';
import { Button } from '@/libs/ui/components/button';
import { Field, FieldLabel } from '@/libs/ui/components/field';
import { Input } from '@/libs/ui/components/input';
import { Switch } from '@/libs/ui/components/switch';
import {
  durationOf,
  durationValue,
  ERROR_TYPE_BASE,
  RAISE_TYPES,
} from '@/operations/workflow-document';
import { useEditing } from '../editing-context';
import { ChoiceField, DurationField, TextField } from './fields';
import { type TaskFormProps, taskEditor } from './task-form';

export function WaitForm(props: TaskFormProps) {
  const edit = taskEditor(props);
  const duration = durationOf(edit.value('/wait'));

  if (duration === null && edit.value('/wait') !== undefined)
    return (
      <p className="text-sm text-muted-foreground">
        This wait is written as code; edit it in the code view.
      </p>
    );

  return (
    <DurationField
      id="wait-duration"
      label="Wait for"
      at="wait"
      value={duration}
      onChange={(next) => edit.set('/wait', durationValue(next))}
    />
  );
}

export function RaiseForm(props: TaskFormProps) {
  const edit = taskEditor(props);
  const type = edit.text('/raise/error/type');
  const known = RAISE_TYPES.find(
    (each) => type === `${ERROR_TYPE_BASE}${each}`,
  );
  const status = edit.value('/raise/error/status');

  return (
    <>
      <ChoiceField
        id="raise-type"
        label="Kind of error"
        at="raise/error/type"
        value={known ?? 'runtime'}
        onChange={(next) =>
          edit.set('/raise/error/type', `${ERROR_TYPE_BASE}${next}`)
        }
        options={RAISE_TYPES.map((each) => ({ value: each, label: each }))}
      />
      <TextField
        id="raise-status"
        label="Status"
        at="raise/error/status"
        type="number"
        value={typeof status === 'number' ? String(status) : ''}
        onChange={(next) =>
          edit.set(
            '/raise/error/status',
            next === '' ? undefined : Number(next),
          )
        }
        description="An HTTP-like code, such as 400 or 500."
      />
      <TextField
        id="raise-title"
        label="Title"
        at="raise/error/title"
        optional
        value={edit.text('/raise/error/title')}
        onChange={(title) => edit.set('/raise/error/title', title)}
      />
      <TextField
        id="raise-detail"
        label="Detail"
        at="raise/error/detail"
        optional
        value={edit.text('/raise/error/detail')}
        onChange={(detail) => edit.set('/raise/error/detail', detail)}
      />
    </>
  );
}

export function ForForm(props: TaskFormProps) {
  const edit = taskEditor(props);

  return (
    <>
      <TextField
        id="for-in"
        label="List"
        at="for/in"
        mono
        value={edit.text('/for/in')}
        onChange={(list) => edit.set('/for/in', list)}
        placeholder="${ .leads }"
        description="An expression that gives the list."
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField
          id="for-each"
          label="Item name"
          at="for/each"
          mono
          value={edit.text('/for/each')}
          onChange={(each) => edit.set('/for/each', each)}
          placeholder="item"
          description="Read it as $item in the steps."
        />
        <TextField
          id="for-at"
          label="Position name"
          at="for/at"
          optional
          mono
          value={edit.text('/for/at')}
          onChange={(at) => edit.set('/for/at', at)}
          placeholder="index"
        />
      </div>
      <TextField
        id="for-while"
        label="Go on while"
        at="while"
        optional
        mono
        value={edit.text('/while')}
        onChange={(condition) => edit.set('/while', condition)}
        placeholder="${ .count < 10 }"
      />
    </>
  );
}

export function ForkForm(props: TaskFormProps) {
  const edit = taskEditor(props);

  return (
    <Field orientation="horizontal">
      <Switch
        id="fork-compete"
        checked={edit.value('/fork/compete') === true}
        onCheckedChange={(on) => edit.set('/fork/compete', on)}
      />
      <FieldLabel htmlFor="fork-compete">
        The first branch to finish wins; the others stop
      </FieldLabel>
    </Field>
  );
}

const ANY = 'any';

export function TryForm(props: TaskFormProps) {
  const edit = taskEditor(props);
  const filterType = edit.text('/catch/errors/with/type');
  const known = RAISE_TYPES.find(
    (each) => filterType === `${ERROR_TYPE_BASE}${each}`,
  );
  const retry = edit.value('/catch/retry');
  const retrying = isObject(retry);
  const count = edit.value('/catch/retry/limit/attempt/count');

  function setRetry(on: boolean) {
    const policy: JsonObject = {
      delay: { seconds: 1 },
      backoff: { exponential: {} },
      limit: { attempt: { count: 3 } },
    };
    edit.set('/catch/retry', on ? policy : undefined);
  }

  return (
    <>
      <ChoiceField
        id="try-errors"
        label="Handle"
        at="catch/errors"
        value={filterType === '' ? ANY : (known ?? ANY)}
        onChange={(next) =>
          edit.set(
            '/catch/errors',
            next === ANY
              ? undefined
              : { with: { type: `${ERROR_TYPE_BASE}${next}` } },
          )
        }
        options={[
          { value: ANY, label: 'Any error' },
          ...RAISE_TYPES.map((each) => ({
            value: each,
            label: `${each} errors`,
          })),
        ]}
      />
      <Field orientation="horizontal">
        <Switch id="try-retry" checked={retrying} onCheckedChange={setRetry} />
        <FieldLabel htmlFor="try-retry">Retry before giving up</FieldLabel>
      </Field>
      {retrying && (
        <div className="grid gap-3 sm:grid-cols-2">
          <TextField
            id="try-attempts"
            label="Attempts"
            at="catch/retry/limit"
            type="number"
            value={typeof count === 'number' ? String(count) : ''}
            onChange={(next) =>
              edit.set(
                '/catch/retry/limit/attempt/count',
                next === '' ? undefined : Number(next),
              )
            }
          />
          <DurationField
            id="try-delay"
            label="First delay"
            at="catch/retry/delay"
            value={durationOf(edit.value('/catch/retry/delay'))}
            onChange={(next) =>
              edit.set('/catch/retry/delay', durationValue(next))
            }
            description="Doubles after each attempt."
          />
        </div>
      )}
      <TextField
        id="try-as"
        label="Error name"
        at="catch/as"
        optional
        mono
        value={edit.text('/catch/as')}
        onChange={(as) => edit.set('/catch/as', as)}
        placeholder="error"
        description="Read the error as $error in the steps that handle it."
      />
    </>
  );
}

const CONTINUE = 'continue';

interface Case {
  readonly name: string;
  readonly when: string;
  readonly then: string;
}

export function SwitchForm(props: TaskFormProps) {
  const edit = taskEditor(props);
  const { siblingNames } = useEditing();
  const raw = edit.value('/switch');
  const cases = Array.isArray(raw) ? raw.flatMap(caseOf) : [];

  function write(next: readonly Case[]) {
    const items: JsonValue[] = next.map((each) => {
      const body: JsonObject = { then: each.then };

      if (each.when.trim() !== '') body.when = each.when;

      return { [each.name]: body };
    });
    edit.set('/switch', items);
  }

  const targets = [
    { value: CONTINUE, label: 'Go on with the next step' },
    { value: 'exit', label: 'Leave the current block' },
    { value: 'end', label: 'End the run' },
    ...siblingNames.map((name) => ({ value: name, label: `Jump to ${name}` })),
  ];

  return (
    <div className="flex flex-col gap-3">
      {cases.map((each, index) => (
        <div key={index} className="flex flex-col gap-2 rounded-lg border p-3">
          <div className="flex items-center gap-2">
            <Input
              aria-label="Path name"
              value={each.name}
              onChange={(event) =>
                write(
                  cases.map((item, at) =>
                    at === index ? { ...item, name: event.target.value } : item,
                  ),
                )
              }
              className="h-7 flex-1 text-sm font-medium"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={`Remove ${each.name}`}
              onClick={() => write(cases.filter((_, at) => at !== index))}
            >
              <XIcon />
            </Button>
          </div>
          <TextField
            id={`case-when-${index}`}
            label="When"
            at={`switch/${index}`}
            mono
            value={each.when}
            onChange={(when) =>
              write(
                cases.map((item, at) =>
                  at === index ? { ...item, when } : item,
                ),
              )
            }
            placeholder="${ .score > 50 }"
            description={
              each.when === ''
                ? 'Empty: taken when no other path is.'
                : undefined
            }
          />
          <ChoiceField
            id={`case-then-${index}`}
            label="Then"
            at={`switch/${index}/${each.name}/then`}
            value={each.then}
            onChange={(then) =>
              write(
                cases.map((item, at) =>
                  at === index ? { ...item, then } : item,
                ),
              )
            }
            options={
              targets.some((target) => target.value === each.then)
                ? targets
                : [...targets, { value: each.then, label: each.then }]
            }
          />
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="self-start"
        onClick={() =>
          write([
            ...cases,
            {
              name: `path${cases.length + 1}`,
              when: '${ true }',
              then: CONTINUE,
            },
          ])
        }
      >
        <PlusIcon data-icon="inline-start" />
        Add a path
      </Button>
    </div>
  );
}

function caseOf(item: JsonValue): Case[] {
  if (!isObject(item)) return [];

  const [name] = Object.keys(item);

  if (name === undefined) return [];

  const body = item[name];

  if (!isObject(body)) return [];

  return [
    {
      name,
      when: typeof body.when === 'string' ? body.when : '',
      then: typeof body.then === 'string' ? body.then : CONTINUE,
    },
  ];
}
