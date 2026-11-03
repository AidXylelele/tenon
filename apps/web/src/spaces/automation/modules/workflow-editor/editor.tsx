'use client';

import type { Diagnostic } from '@codemirror/lint';
import {
  ArrowLeftIcon,
  Code2Icon,
  FileUpIcon,
  LayoutListIcon,
  SendIcon,
} from 'lucide-react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { toast } from 'sonner';
import { codeOf, type Problem } from '@/libs/data-access/problem';
import type {
  ConformanceStatement,
  JsonObject,
} from '@/libs/data-access/types';
import { Button } from '@/libs/ui/components/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/libs/ui/components/sheet';
import { Skeleton } from '@/libs/ui/components/skeleton';
import { Spinner } from '@/libs/ui/components/spinner';
import {
  ToggleGroup,
  ToggleGroupItem,
} from '@/libs/ui/components/toggle-group';
import { ProblemMessage } from '@/libs/ui/composites/problem-message';
import { useIsMobile } from '@/libs/ui/hooks/use-mobile';
import {
  formatOf,
  parseText,
  rangeOf,
  stringifyText,
  type TextFormat,
} from '@/libs/document-text/document-text';
import {
  headerOf,
  MAX_DOCUMENT_BYTES,
  nextVersion,
  sizeOf,
} from '../../__shared_context/document/draft';
import { isObject, withMember } from '../../__shared_context/document/json';
import { infoOf, newTask } from '../../__shared_context/document/kinds';
import { locate } from '../../__shared_context/document/problems';
import { withDeclaredSecrets } from '../../__shared_context/document/secrets';
import {
  entriesAt,
  entryAt,
  freeName,
  insertTask,
  moveTask,
  removeTask,
  renameTask,
  replaceTask,
  ROOT_LIST,
  type TaskKind,
} from '../../__shared_context/document/tasks';
import { workflowHref } from '../../__shared_context/links';
import { publishAction } from './actions';
import { CheckStatus } from './check-status';
import { EditingProvider } from './editing-context';
import { HeaderCard } from './header-card';
import { Inspector } from './inspector';
import { TaskList } from './task-list';
import { TriggerCard } from './trigger-card';
import { useCheck } from './use-check';

// The code view loads only when asked for, so the no-code builder opens without CodeMirror.
const CodeView = dynamic(() => import('./code-view'), {
  ssr: false,
  loading: () => <Skeleton className="h-[28rem] w-full rounded-xl" />,
});

interface EditorProps {
  readonly initial: JsonObject;
  // An existing workflow: its namespace and name stay, and leaving returns to it.
  readonly existing: {
    readonly namespace: string;
    readonly name: string;
  } | null;
  readonly secretNames: readonly string[];
  readonly conformance: ConformanceStatement;
}

type View = 'builder' | 'code';

export function Editor({
  initial,
  existing,
  secretNames,
  conformance,
}: EditorProps) {
  const router = useRouter();
  const isMobile = useIsMobile();
  const [draft, setDraft] = useState(initial);
  const [view, setView] = useState<View>('builder');
  const [text, setText] = useState('');
  const [format, setFormat] = useState<TextFormat>('yaml');
  const [textError, setTextError] = useState<{
    message: string;
    from: number;
    to: number;
    line: number;
  } | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [focus, setFocus] = useState<{ from: number; to: number } | null>(null);
  const [publishProblem, setPublishProblem] = useState<Problem | null>(null);
  const [publishing, startPublish] = useTransition();
  const published = useRef(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const check = useCheck(draft, textError === null);
  const located =
    check.kind === 'problem' ? locate(draft, check.problem) : null;
  const header = headerOf(draft);
  const entry = selected === null ? null : entryAt(draft, selected);
  const changed = draft !== initial;

  useEffect(() => {
    if (!changed) return;

    const warn = (event: BeforeUnloadEvent) => {
      if (published.current) return;

      event.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [changed]);

  const diagnostics = useMemo<Diagnostic[]>(() => {
    if (view !== 'code') return [];

    if (textError !== null)
      return [
        {
          from: textError.from,
          to: textError.to,
          severity: 'error',
          message: textError.message,
        },
      ];

    if (located === null) return [];

    const range = rangeOf(text, located.pointer);
    return range === null
      ? []
      : [{ ...range, severity: 'error', message: located.detail }];
  }, [view, textError, located, text]);

  function update(next: JsonObject) {
    setDraft(withDeclaredSecrets(next));
    setPublishProblem(null);
  }

  function insert(listPointer: string, index: number, kind: TaskKind) {
    const name = freeName(draft, infoOf(kind).stem);
    update(insertTask(draft, listPointer, index, name, newTask(kind)));
    setSelected(`${listPointer}/${index}/${name}`);
  }

  function changeTask(task: JsonObject) {
    if (entry !== null) update(replaceTask(draft, entry, task));
  }

  function rename(name: string) {
    if (entry === null) return;

    update(renameTask(draft, entry, name));
    setSelected(`${entry.listPointer}/${entry.index}/${name}`);
  }

  function move(step: -1 | 1) {
    if (entry === null) return;

    update(moveTask(draft, entry.listPointer, entry.index, step));
    setSelected(`${entry.listPointer}/${entry.index + step}/${entry.name}`);
  }

  function remove() {
    if (entry === null) return;

    const before = draft;
    update(removeTask(draft, entry.listPointer, entry.index));
    setSelected(null);
    toast(`Removed ${entry.name}`, {
      action: { label: 'Undo', onClick: () => setDraft(before) },
    });
  }

  function showCode(nextFormat: TextFormat = format) {
    setText(stringifyText(draft, nextFormat));
    setFormat(nextFormat);
    setTextError(null);
    setView('code');
  }

  function editText(next: string) {
    setText(next);
    const parsed = parseText(next);

    if (!parsed.ok) {
      setTextError({
        ...parsed.error,
        message: `Line ${parsed.error.line}: ${parsed.error.message}`,
      });
      return;
    }

    if (!isObject(parsed.value)) {
      setTextError({
        message: 'A workflow document is an object',
        from: 0,
        to: 0,
        line: 1,
      });
      return;
    }

    setTextError(null);
    update(parsed.value);
  }

  function showBuilder() {
    if (textError !== null) {
      toast.error('Fix the text first', { description: textError.message });
      return;
    }

    setView('builder');
  }

  async function load(file: File) {
    const loaded = await file.text();
    setFormat(formatOf(loaded));
    setView('code');
    editText(loaded);
    toast.success(`Loaded ${file.name}`);
  }

  function showProblem() {
    if (located === null) return;

    if (view === 'code') {
      setFocus(rangeOf(text, located.pointer));
      return;
    }

    if (located.taskPointer !== null) {
      setSelected(located.taskPointer);
      document
        .getElementById('steps')
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }

    const card = located.field.startsWith('schedule') ? 'start' : 'about';
    document
      .getElementById(card)
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function publish() {
    if (sizeOf(draft) > MAX_DOCUMENT_BYTES) {
      toast.error(
        'The document is larger than 1 MiB, which the platform does not take',
      );
      return;
    }

    setPublishProblem(null);
    startPublish(async () => {
      const outcome = await publishAction(draft);

      if (!outcome.ok) {
        setPublishProblem(outcome.problem);
        return;
      }

      published.current = true;
      const target = workflowHref(outcome.value.namespace, outcome.value.name);
      toast.success(`Published version ${outcome.value.version}`, {
        description: 'Runs started from now on use it.',
        action: {
          label: 'Start a run',
          onClick: () => router.push(`${target}?start=1`),
        },
      });
      router.push(target);
    });
  }

  const versionTaken =
    publishProblem !== null &&
    codeOf(publishProblem) === 'workflow.version-taken';
  const back =
    existing === null
      ? '/workflows'
      : workflowHref(existing.namespace, existing.name);
  const ready = check.kind === 'clean' && textError === null;
  const editing = {
    located,
    taskPointer: null,
    secretNames,
    siblingNames: [],
    scriptLanguages: conformance.scriptLanguages,
  };

  const inspector = (
    <EditingProvider
      value={{
        ...editing,
        taskPointer: entry?.pointer ?? null,
        siblingNames:
          entry === null
            ? []
            : siblingsOf(draft, entry.listPointer, entry.name),
      }}
    >
      <Inspector
        key={entry?.pointer ?? 'none'}
        draft={draft}
        entry={entry}
        onChange={changeTask}
        onRename={rename}
        onMove={move}
        onRemove={remove}
      />
    </EditingProvider>
  );

  return (
    <EditingProvider value={editing}>
      <div className="sticky top-0 z-10 -mx-4 flex flex-col gap-3 border-b bg-background/95 px-4 py-3 backdrop-blur md:-mx-8 md:px-8">
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="ghost" size="icon-sm" asChild>
            <Link href={back} aria-label="Back">
              <ArrowLeftIcon />
            </Link>
          </Button>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold">
              {existing === null ? 'New workflow' : `Edit ${existing.name}`}
              <span className="ml-2 font-normal text-muted-foreground tabular-nums">
                {header.version}
              </span>
            </div>
          </div>
          <ToggleGroup
            type="single"
            variant="outline"
            size="sm"
            value={view}
            onValueChange={(next) =>
              next === 'code'
                ? showCode()
                : next === 'builder'
                  ? showBuilder()
                  : undefined
            }
          >
            <ToggleGroupItem value="builder" aria-label="Builder">
              <LayoutListIcon />
              <span className="hidden sm:inline">Builder</span>
            </ToggleGroupItem>
            <ToggleGroupItem value="code" aria-label="Code">
              <Code2Icon />
              <span className="hidden sm:inline">Code</span>
            </ToggleGroupItem>
          </ToggleGroup>
          <Button onClick={publish} disabled={!ready || publishing}>
            {publishing ? (
              <Spinner data-icon="inline-start" />
            ) : (
              <SendIcon data-icon="inline-start" />
            )}
            {publishing ? 'Publishing…' : 'Publish'}
          </Button>
        </div>
        <CheckStatus
          state={check}
          textError={textError?.message ?? null}
          onShow={showProblem}
        />
      </div>

      {publishProblem !== null && (
        <div className="flex flex-col gap-2">
          <ProblemMessage problem={publishProblem} />
          {versionTaken && (
            <Button
              variant="outline"
              size="sm"
              className="self-start"
              onClick={() =>
                update(
                  withMember(
                    draft,
                    '/document/version',
                    nextVersion(header.version),
                  ),
                )
              }
            >
              Use version {nextVersion(header.version)}
            </Button>
          )}
        </div>
      )}

      {view === 'code' ? (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <ToggleGroup
              type="single"
              variant="outline"
              size="sm"
              value={format}
              onValueChange={(next) =>
                next !== '' &&
                textError === null &&
                showCode(next as TextFormat)
              }
            >
              <ToggleGroupItem value="yaml">YAML</ToggleGroupItem>
              <ToggleGroupItem value="json">JSON</ToggleGroupItem>
            </ToggleGroup>
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInput.current?.click()}
            >
              <FileUpIcon data-icon="inline-start" />
              Load a file
            </Button>
            <input
              ref={fileInput}
              type="file"
              accept=".yaml,.yml,.json,application/json,application/yaml,text/yaml"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];

                if (file !== undefined) void load(file);

                event.target.value = '';
              }}
            />
            <span className="text-xs text-muted-foreground">
              Open Workflow DSL {conformance.dsl.at(-1)}; the builder and this
              text edit the same document.
            </span>
          </div>
          <CodeView
            text={text}
            onText={editText}
            diagnostics={diagnostics}
            focus={focus}
          />
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_24rem]">
          <div className="flex min-w-0 flex-col gap-6">
            <section id="about">
              <HeaderCard
                draft={draft}
                onChange={update}
                named={existing !== null}
              />
            </section>
            <section id="start">
              <TriggerCard draft={draft} onChange={update} />
            </section>
            <section id="steps" className="flex flex-col gap-3">
              <div>
                <h2 className="text-base font-semibold">Steps</h2>
                <p className="text-sm text-muted-foreground">
                  They run top to bottom; pick one to set it up.
                </p>
              </div>
              <TaskList
                draft={draft}
                listPointer={ROOT_LIST}
                selected={selected}
                flagged={located?.taskPointer ?? null}
                onSelect={setSelected}
                onInsert={insert}
              />
            </section>
          </div>
          {isMobile ? (
            <Sheet
              open={entry !== null}
              onOpenChange={(open) => !open && setSelected(null)}
            >
              <SheetContent
                side="bottom"
                className="max-h-[85svh] overflow-y-auto p-4"
              >
                <SheetHeader className="sr-only">
                  <SheetTitle>Step</SheetTitle>
                </SheetHeader>
                {inspector}
              </SheetContent>
            </Sheet>
          ) : (
            <aside className="lg:sticky lg:top-32 lg:max-h-[calc(100svh-9rem)] lg:overflow-y-auto">
              {inspector}
            </aside>
          )}
        </div>
      )}
    </EditingProvider>
  );
}

// The names a step may jump to with `then`: the other steps of its own list.
function siblingsOf(
  draft: JsonObject,
  listPointer: string,
  own: string,
): string[] {
  return entriesAt(draft, listPointer)
    .map((each) => each.name)
    .filter((name) => name !== own);
}
