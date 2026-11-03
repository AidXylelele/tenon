'use client';

import {
  ArrowDownIcon,
  ArrowUpIcon,
  MousePointerClickIcon,
  Trash2Icon,
} from 'lucide-react';
import { useState } from 'react';
import type { JsonObject } from '@/libs/data-access/types';
import { Button } from '@/libs/ui/components/button';
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from '@/libs/ui/components/field';
import { Input } from '@/libs/ui/components/input';
import { infoOf } from '../../__shared_context/document/kinds';
import {
  entriesAt,
  type TaskEntry,
} from '../../__shared_context/document/tasks';
import { TaskIcon } from '../../__shared_context/outline/task-icon';
import { useEditing } from './editing-context';
import { AdvancedForm } from './forms/advanced-form';
import { CommonForm } from './forms/common-form';
import { EmitForm, ListenForm } from './forms/event-forms';
import {
  ForForm,
  ForkForm,
  RaiseForm,
  SwitchForm,
  TryForm,
  WaitForm,
} from './forms/flow-forms';
import type { TaskFormProps } from './forms/task-form';
import {
  HttpForm,
  RunWorkflowForm,
  ScriptForm,
  SetForm,
  ShellForm,
} from './forms/work-forms';

interface InspectorProps {
  readonly draft: JsonObject;
  readonly entry: TaskEntry | null;
  readonly onChange: (task: JsonObject) => void;
  readonly onRename: (name: string) => void;
  readonly onMove: (step: -1 | 1) => void;
  readonly onRemove: () => void;
}

const NAME = /^[A-Za-z0-9_-]+$/;

// The selected step's form: its name, what it does, and the options every step has.
export function Inspector({
  draft,
  entry,
  onChange,
  onRename,
  onMove,
  onRemove,
}: InspectorProps) {
  if (entry === null)
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
        <MousePointerClickIcon className="size-5" />
        Pick a step to set it up, or add one.
      </div>
    );

  const siblings = entriesAt(draft, entry.listPointer);
  const info = infoOf(entry.kind);
  const form: TaskFormProps = { task: entry.task, onChange };

  return (
    <div className="flex flex-col gap-5 p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border">
            <TaskIcon kind={entry.kind} className="size-4" />
          </span>
          <div className="min-w-0">
            <div className="text-sm font-semibold">{info.label}</div>
            <div className="truncate text-xs text-muted-foreground">
              {info.description}
            </div>
          </div>
        </div>
        <div className="flex shrink-0 gap-0.5">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Move up"
            disabled={entry.index === 0}
            onClick={() => onMove(-1)}
          >
            <ArrowUpIcon />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Move down"
            disabled={entry.index === siblings.length - 1}
            onClick={() => onMove(1)}
          >
            <ArrowDownIcon />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={`Remove ${entry.name}`}
            onClick={onRemove}
          >
            <Trash2Icon />
          </Button>
        </div>
      </div>
      <NameField
        key={entry.pointer}
        name={entry.name}
        taken={siblings.map((each) => each.name)}
        onRename={onRename}
      />
      <KindForm entry={entry} form={form} />
      {entry.kind !== 'advanced' && <CommonForm {...form} />}
    </div>
  );
}

function KindForm({
  entry,
  form,
}: {
  readonly entry: TaskEntry;
  readonly form: TaskFormProps;
}) {
  switch (entry.kind) {
    case 'http':
      return <HttpForm {...form} />;
    case 'set':
      return <SetForm {...form} />;
    case 'run-script':
      return <ScriptForm {...form} />;
    case 'run-shell':
      return <ShellForm {...form} />;
    case 'run-workflow':
      return <RunWorkflowForm {...form} />;
    case 'emit':
      return <EmitForm {...form} />;
    case 'listen':
      return <ListenForm {...form} />;
    case 'wait':
      return <WaitForm {...form} />;
    case 'raise':
      return <RaiseForm {...form} />;
    case 'switch':
      return <SwitchForm {...form} />;
    case 'for':
      return <ForForm {...form} />;
    case 'fork':
      return <ForkForm {...form} />;
    case 'try':
      return <TryForm {...form} />;
    case 'do':
      return (
        <p className="text-sm text-muted-foreground">
          Its steps are on the run line, inside it.
        </p>
      );
    case 'advanced':
      return <AdvancedForm {...form} />;
  }
}

// The step's name, written when it is a free name of letters, digits, dashes and underscores.
function NameField({
  name,
  taken,
  onRename,
}: {
  readonly name: string;
  readonly taken: readonly string[];
  readonly onRename: (name: string) => void;
}) {
  const [text, setText] = useState(name);
  const { located, taskPointer } = useEditing();
  const others = taken.filter((each) => each !== name);
  const error =
    text === ''
      ? 'A step needs a name'
      : !NAME.test(text)
        ? 'Use letters, digits, dashes and underscores'
        : others.includes(text)
          ? 'Another step here has this name'
          : null;
  const problem =
    located !== null &&
    located.taskPointer === taskPointer &&
    located.field === ''
      ? located.detail
      : null;

  function commit() {
    if (error === null && text !== name) onRename(text);
  }

  return (
    <Field data-invalid={error !== null || problem !== null}>
      <FieldLabel htmlFor="step-name">Name</FieldLabel>
      <Input
        id="step-name"
        value={text}
        onChange={(event) => setText(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => event.key === 'Enter' && commit()}
        className="font-mono text-xs"
        aria-invalid={error !== null}
      />
      {error !== null ? (
        <FieldError>{error}</FieldError>
      ) : problem !== null ? (
        <FieldError>{problem}</FieldError>
      ) : (
        <FieldDescription>
          Other steps jump here by this name, and runs show it.
        </FieldDescription>
      )}
    </Field>
  );
}
