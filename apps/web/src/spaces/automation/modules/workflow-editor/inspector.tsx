'use client';

import {
  ArrowDownIcon,
  ArrowUpIcon,
  CopyIcon,
  EllipsisIcon,
  Trash2Icon,
} from 'lucide-react';
import { useState } from 'react';
import { isObject, type JsonObject } from '@/libs/document-text/json';
import { Button } from '@/libs/ui/components/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/libs/ui/components/dropdown-menu';
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from '@/libs/ui/components/field';
import { Input } from '@/libs/ui/components/input';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/libs/ui/components/tabs';
import { Textarea } from '@/libs/ui/components/textarea';
import {
  entriesAt,
  infoOf,
  protectionOf,
  type TaskEntry,
  withProtectedStep,
} from '@/operations/workflow-document';
import type { LocatedProblem } from './problems';
import { tileOf } from '../../__shared_context/outline/families';
import { TaskIcon } from '../../__shared_context/outline/task-icon';
import { EditingProvider, useEditing } from './editing-context';
import { AdvancedForm } from './forms/advanced-form';
import { CommonForm } from './forms/common-form';
import { EmitForm, ListenForm } from './forms/event-forms';
import { FailureForm } from './forms/failure-form';
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
  readonly entry: TaskEntry;
  // The entry's new task; a protected step is written inside its `try`.
  readonly onChange: (task: JsonObject) => void;
  readonly onRename: (name: string) => void;
  readonly onMove: (step: -1 | 1) => void;
  readonly onDuplicate: () => void;
  readonly onRemove: () => void;
}

type Section = 'settings' | 'failure' | 'data' | 'note';

const NAME = /^[A-Za-z0-9_-]+$/;
const DATA_FIELDS = ['if', 'then', 'input', 'output', 'export', 'timeout'];

// The picked step (FR-031), after n8n's node panel: what it does, what happens when it fails,
// how its data is shaped, and the author's note, each a tab, under a heading that keeps the
// step's actions at hand. The panel keeps its size; each tab scrolls on its own.
export function Inspector({
  draft,
  entry,
  onChange,
  onRename,
  onMove,
  onDuplicate,
  onRemove,
}: InspectorProps) {
  const editing = useEditing();
  const protection = protectionOf(draft, entry);
  const shown = protection?.step ?? entry;
  const [section, setSection] = useState<Section>(() =>
    sectionOf(editing.located),
  );
  const siblings = entriesAt(draft, entry.listPointer);
  const info = infoOf(shown.kind);
  const settings: TaskFormProps = {
    task: shown.task,
    onChange: (task) =>
      onChange(
        protection === null ? task : withProtectedStep(entry, protection, task),
      ),
  };
  const whole: TaskFormProps = { task: entry.task, onChange };
  const note = noteOf(entry.task);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-start gap-3 px-4 pt-4">
        <span
          className={`flex size-10 shrink-0 items-center justify-center rounded-xl ring-1 ${tileOf(shown.kind)}`}
        >
          <TaskIcon kind={shown.kind} className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">{shown.name}</div>
          <div className="truncate text-xs text-muted-foreground">
            {info.label}: {info.description}
          </div>
        </div>
        <StepActions
          name={shown.name}
          first={entry.index === 0}
          last={entry.index === siblings.length - 1}
          onMove={onMove}
          onDuplicate={onDuplicate}
          onRemove={onRemove}
        />
      </div>
      <Tabs
        value={section}
        onValueChange={(value) => setSection(value as Section)}
        className="flex min-h-0 flex-1 flex-col gap-0"
      >
        <TabsList className="mx-4 mt-3 grid w-[calc(100%-2rem)] shrink-0 grid-cols-4">
          <TabsTrigger value="settings">Settings</TabsTrigger>
          <TabsTrigger value="failure">If it fails</TabsTrigger>
          <TabsTrigger value="data">Data</TabsTrigger>
          <TabsTrigger value="note">
            Note
            {note !== '' && (
              <span
                className="size-1.5 rounded-full bg-primary"
                aria-label="has a note"
              />
            )}
          </TabsTrigger>
        </TabsList>
        <TabsContent
          value="settings"
          className="flex flex-col gap-5 overflow-y-auto p-4"
        >
          <EditingProvider value={{ ...editing, taskPointer: shown.pointer }}>
            <NameField
              key={entry.pointer}
              name={shown.name}
              taken={siblings.map((each) => each.name)}
              onRename={onRename}
            />
            <KindForm entry={shown} form={settings} />
          </EditingProvider>
        </TabsContent>
        <TabsContent value="failure" className="overflow-y-auto p-4">
          {entry.kind === 'try' && protection === null ? (
            <TryForm {...whole} />
          ) : shown.kind === 'raise' ? (
            <p className="text-sm text-muted-foreground">
              This step ends the run with its error on purpose; there is nothing
              to retry.
            </p>
          ) : (
            <FailureForm
              entry={entry}
              protection={protection}
              onChange={onChange}
            />
          )}
        </TabsContent>
        <TabsContent value="data" className="overflow-y-auto p-4">
          {entry.kind === 'advanced' ? (
            <p className="text-sm text-muted-foreground">
              Edit this step&apos;s options in its YAML, under Settings.
            </p>
          ) : (
            <CommonForm {...whole} />
          )}
        </TabsContent>
        <TabsContent value="note" className="overflow-y-auto p-4">
          <NoteField
            key={entry.pointer}
            note={note}
            onChange={(text) => onChange(withNote(entry.task, text))}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function StepActions({
  name,
  first,
  last,
  onMove,
  onDuplicate,
  onRemove,
}: {
  readonly name: string;
  readonly first: boolean;
  readonly last: boolean;
  readonly onMove: (step: -1 | 1) => void;
  readonly onDuplicate: () => void;
  readonly onRemove: () => void;
}) {
  return (
    <div className="flex shrink-0 items-center gap-0.5">
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label="Move up"
        title="Move up"
        disabled={first}
        onClick={() => onMove(-1)}
      >
        <ArrowUpIcon />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label="Move down"
        title="Move down"
        disabled={last}
        onClick={() => onMove(1)}
      >
        <ArrowDownIcon />
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={`More actions for ${name}`}
          >
            <EllipsisIcon />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={onDuplicate}>
            <CopyIcon />
            Duplicate
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={onRemove}>
            <Trash2Icon />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
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
      return (
        <p className="text-sm text-muted-foreground">
          Its steps are on the canvas, inside it; what it does when they fail is
          under If it fails.
        </p>
      );
    case 'do':
      return (
        <p className="text-sm text-muted-foreground">
          Its steps are on the canvas, inside it.
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

// The author's note (`metadata.note`), shown under the step's name on the canvas.
function NoteField({
  note,
  onChange,
}: {
  readonly note: string;
  readonly onChange: (note: string) => void;
}) {
  const [text, setText] = useState(note);

  return (
    <Field>
      <FieldLabel htmlFor="step-note">Note</FieldLabel>
      <Textarea
        id="step-note"
        rows={4}
        value={text}
        placeholder="What this step is for, what to check when it fails…"
        onChange={(event) => setText(event.target.value)}
        onBlur={() => text !== note && onChange(text)}
      />
      <FieldDescription>
        Shown under the step&apos;s name on the canvas, to everyone who reads
        the workflow. It is kept in the step&apos;s metadata and does not change
        how the step runs.
      </FieldDescription>
    </Field>
  );
}

// The tab that holds the check's problem, when it is in this step.
function sectionOf(located: LocatedProblem | null): Section {
  const field = located?.field ?? '';
  const [head] = field.split('/');

  if (head === 'metadata') return 'note';

  if (head === 'catch') return 'failure';

  if (head !== undefined && DATA_FIELDS.includes(head)) return 'data';

  return 'settings';
}

function noteOf(task: JsonObject): string {
  const metadata = isObject(task.metadata) ? task.metadata : {};
  return typeof metadata.note === 'string' ? metadata.note : '';
}

// The task with its note written, or removed when it is empty, and the metadata with it when
// nothing else is in it.
function withNote(task: JsonObject, note: string): JsonObject {
  const metadata = isObject(task.metadata) ? task.metadata : {};
  const others = Object.fromEntries(
    Object.entries(metadata).filter(([key]) => key !== 'note'),
  );
  const trimmed = note.trim();
  const next = trimmed === '' ? others : { ...others, note: trimmed };
  const rest = Object.fromEntries(
    Object.entries(task).filter(([key]) => key !== 'metadata'),
  );
  return Object.keys(next).length === 0 ? rest : { ...rest, metadata: next };
}
