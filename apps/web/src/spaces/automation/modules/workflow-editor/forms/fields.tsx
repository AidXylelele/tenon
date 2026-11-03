'use client';

import { CodeEditor } from '@/libs/code-editor/code-editor';
import { PlusIcon, XIcon } from 'lucide-react';
import { useState } from 'react';
import type { JsonObject, JsonValue } from '@/libs/document-text/json';
import { Button } from '@/libs/ui/components/button';
import {
  Field,
  FieldDescription,
  FieldError,
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
import {
  type Duration,
  type DurationUnit,
  UNITS,
} from '../../../__shared_context/document/trigger';
import { useFieldProblem } from '../editing-context';

// The fields task forms are made of. Each names the path it edits (`at`), so the check's problem
// at that path shows under it.

interface FieldShellProps {
  readonly id: string;
  readonly label: string;
  readonly at: string;
  readonly description?: React.ReactNode;
  readonly optional?: boolean;
  readonly exact?: boolean;
  readonly children: React.ReactNode;
}

export function FieldShell({
  id,
  label,
  at,
  description,
  optional = false,
  exact = false,
  children,
}: FieldShellProps) {
  const problem = useFieldProblem(at, exact);

  return (
    <Field data-invalid={problem !== null}>
      <FieldLabel htmlFor={id}>
        {label}
        {optional && (
          <span className="font-normal text-muted-foreground">optional</span>
        )}
      </FieldLabel>
      {children}
      {problem !== null ? (
        <FieldError>{problem}</FieldError>
      ) : (
        description !== undefined && (
          <FieldDescription>{description}</FieldDescription>
        )
      )}
    </Field>
  );
}

interface TextFieldProps extends Omit<FieldShellProps, 'children'> {
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly placeholder?: string;
  readonly mono?: boolean;
  readonly type?: string;
  readonly readOnly?: boolean;
}

export function TextField({
  value,
  onChange,
  placeholder,
  mono = false,
  type = 'text',
  readOnly = false,
  ...shell
}: TextFieldProps) {
  const problem = useFieldProblem(shell.at);

  return (
    <FieldShell {...shell}>
      <Input
        id={shell.id}
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={problem !== null}
        readOnly={readOnly}
        spellCheck={!mono}
        className={mono ? 'font-mono text-xs' : undefined}
      />
    </FieldShell>
  );
}

interface ChoiceFieldProps extends Omit<FieldShellProps, 'children'> {
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly options: readonly {
    readonly value: string;
    readonly label: string;
  }[];
}

export function ChoiceField({
  value,
  onChange,
  options,
  ...shell
}: ChoiceFieldProps) {
  return (
    <FieldShell {...shell}>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={shell.id} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </FieldShell>
  );
}

interface JsonFieldProps extends Omit<FieldShellProps, 'children'> {
  readonly value: JsonValue | undefined;
  readonly onChange: (value: JsonValue | undefined) => void;
  readonly rows?: number;
  readonly placeholder?: string;
}

// A JSON value typed as text: it is written when it parses, and an empty text removes it. A
// runtime expression (`${ … }`) is written as the string it is.
export function JsonField({
  value,
  onChange,
  rows = 4,
  placeholder,
  ...shell
}: JsonFieldProps) {
  const [text, setText] = useState(() =>
    value === undefined ? '' : textOfJson(value),
  );
  const [error, setError] = useState<string | null>(null);
  const problem = useFieldProblem(shell.at);

  function edit(next: string) {
    setText(next);
    const parsed = parseJsonText(next);

    if (parsed.ok) {
      setError(null);
      onChange(parsed.value);
    } else setError(parsed.error);
  }

  return (
    <Field data-invalid={problem !== null || error !== null}>
      <FieldLabel htmlFor={shell.id}>
        {shell.label}
        {shell.optional === true && (
          <span className="font-normal text-muted-foreground">optional</span>
        )}
      </FieldLabel>
      <CodeEditor
        id={shell.id}
        label={shell.label}
        language="json"
        size={rows > 6 ? 'regular' : 'short'}
        value={text}
        placeholder={placeholder}
        onChange={edit}
        invalid={problem !== null || error !== null}
      />
      {error !== null ? (
        <FieldError>Not JSON yet: {error}</FieldError>
      ) : problem !== null ? (
        <FieldError>{problem}</FieldError>
      ) : (
        shell.description !== undefined && (
          <FieldDescription>{shell.description}</FieldDescription>
        )
      )}
    </Field>
  );
}

interface DurationFieldProps extends Omit<FieldShellProps, 'children'> {
  readonly value: Duration | null;
  readonly onChange: (value: Duration) => void;
}

export function DurationField({
  value,
  onChange,
  ...shell
}: DurationFieldProps) {
  const duration = value ?? { amount: 1, unit: 'minutes' as DurationUnit };

  return (
    <FieldShell {...shell}>
      <div className="flex gap-2">
        <Input
          id={shell.id}
          type="number"
          min={1}
          step={1}
          value={duration.amount}
          onChange={(event) =>
            onChange({
              ...duration,
              amount: Math.max(1, Math.floor(Number(event.target.value) || 1)),
            })
          }
          className="w-24 tabular-nums"
        />
        <Select
          value={duration.unit}
          onValueChange={(unit) =>
            onChange({ ...duration, unit: unit as DurationUnit })
          }
        >
          <SelectTrigger className="flex-1" aria-label="Unit">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {UNITS.map((unit) => (
              <SelectItem key={unit} value={unit}>
                {unit}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </FieldShell>
  );
}

interface PairsFieldProps extends Omit<FieldShellProps, 'children' | 'id'> {
  readonly value: JsonObject;
  readonly onChange: (value: JsonObject) => void;
  readonly keyLabel?: string;
  readonly valueLabel?: string;
}

// Names and values as rows (data to set, headers, query): a value is text, a number, true or
// false, JSON, or a runtime expression.
export function PairsField({
  value,
  onChange,
  keyLabel = 'Name',
  valueLabel = 'Value',
  ...shell
}: PairsFieldProps) {
  const [rows, setRows] = useState(() =>
    Object.entries(value).map(([key, item]) => ({
      key,
      text: textOfValue(item),
    })),
  );
  const problem = useFieldProblem(shell.at);

  function write(next: { key: string; text: string }[]) {
    setRows(next);
    const object: JsonObject = {};

    for (const row of next)
      if (row.key.trim() !== '') object[row.key.trim()] = valueOfText(row.text);

    onChange(object);
  }

  return (
    <Field data-invalid={problem !== null}>
      <FieldLabel>
        {shell.label}
        {shell.optional === true && (
          <span className="font-normal text-muted-foreground">optional</span>
        )}
      </FieldLabel>
      <div className="flex flex-col gap-2">
        {rows.map((row, index) => (
          <div key={index} className="flex gap-2">
            <Input
              aria-label={keyLabel}
              placeholder={keyLabel}
              value={row.key}
              onChange={(event) =>
                write(
                  rows.map((each, at) =>
                    at === index ? { ...each, key: event.target.value } : each,
                  ),
                )
              }
              className="w-2/5 font-mono text-xs"
            />
            <Input
              aria-label={valueLabel}
              placeholder={valueLabel}
              value={row.text}
              onChange={(event) =>
                write(
                  rows.map((each, at) =>
                    at === index ? { ...each, text: event.target.value } : each,
                  ),
                )
              }
              className="flex-1 font-mono text-xs"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={`Remove ${row.key || 'row'}`}
              onClick={() => write(rows.filter((_, at) => at !== index))}
            >
              <XIcon />
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="self-start"
          onClick={() => setRows([...rows, { key: '', text: '' }])}
        >
          <PlusIcon data-icon="inline-start" />
          Add {keyLabel.toLowerCase()}
        </Button>
      </div>
      {problem !== null ? (
        <FieldError>{problem}</FieldError>
      ) : (
        shell.description !== undefined && (
          <FieldDescription>{shell.description}</FieldDescription>
        )
      )}
    </Field>
  );
}

export function textOfValue(value: JsonValue): string {
  return typeof value === 'string' ? value : JSON.stringify(value);
}

// A typed text as the value it means: numbers, true, false, null and JSON as themselves,
// anything else (a runtime expression too) as text.
export function valueOfText(text: string): JsonValue {
  const trimmed = text.trim();

  if (trimmed === '') return '';

  if (/^-?\d+(\.\d+)?$/.test(trimmed)) return Number(trimmed);

  if (trimmed === 'true' || trimmed === 'false') return trimmed === 'true';

  if (trimmed === 'null') return null;

  if (
    trimmed.startsWith('{') ||
    trimmed.startsWith('[') ||
    trimmed.startsWith('"')
  ) {
    try {
      return JSON.parse(trimmed) as JsonValue;
    } catch {
      return text;
    }
  }

  return text;
}

function textOfJson(value: JsonValue): string {
  return typeof value === 'string' ? value : JSON.stringify(value, null, 2);
}

function parseJsonText(
  text: string,
): { ok: true; value: JsonValue | undefined } | { ok: false; error: string } {
  const trimmed = text.trim();

  if (trimmed === '') return { ok: true, value: undefined };

  if (trimmed.startsWith('${')) return { ok: true, value: trimmed };

  try {
    return { ok: true, value: JSON.parse(trimmed) as JsonValue };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'invalid',
    };
  }
}
