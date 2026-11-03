'use client';

import type { Diagnostic } from '@codemirror/lint';
import {
  ArrowLeftIcon,
  Code2Icon,
  FileUpIcon,
  SendIcon,
  WorkflowIcon,
  XIcon,
} from 'lucide-react';
import dynamic from 'next/dynamic';
import { Link } from '@/libs/routing/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { toast } from 'sonner';
import { codeOf, type Problem } from '@/libs/data-access/problem';
import type {
  ConformanceStatement,
  JsonObject,
} from '@/libs/data-access/types';
import { pointerOf, tokensOf } from '@/libs/document-text/json-pointer';
import {
  formatOf,
  parseText,
  rangeOf,
  stringifyText,
  type TextFormat,
} from '@/libs/document-text/document-text';
import { Button } from '@/libs/ui/components/button';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/libs/ui/components/resizable';
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
import { useHydrated } from '@/libs/ui/hooks/use-hydrated';
import { useIsMobile } from '@/libs/ui/hooks/use-mobile';
import { type CanvasEdge, START } from '../../__shared_context/canvas/graph';
import { WorkflowCanvas } from '../../__shared_context/canvas/workflow-canvas';
import {
  headerOf,
  MAX_DOCUMENT_BYTES,
  nextVersion,
  sizeOf,
} from '../../__shared_context/document/draft';
import {
  isObject,
  valueAt,
  withMember,
  withValue,
} from '../../__shared_context/document/json';
import { infoOf, newTask } from '../../__shared_context/document/kinds';
import { locate } from '../../__shared_context/document/problems';
import {
  protectionOf,
  protectorOf,
  renamedStep,
} from '../../__shared_context/document/protection';
import { withDeclaredSecrets } from '../../__shared_context/document/secrets';
import {
  duplicateTask,
  entriesAt,
  entryAt,
  freeName,
  insertTask,
  moveTask,
  removeTask,
  replaceTask,
  type TaskKind,
} from '../../__shared_context/document/tasks';
import { workflowHref } from '../../__shared_context/links';
import { publishAction } from './actions';
import { CheckStatus } from './check-status';
import { EditingProvider } from './editing-context';
import { HeaderCard } from './header-card';
import { Inspector } from './inspector';
import { NodeCreator } from './node-creator';
import { TriggerCard } from './trigger-card';
import { usePanelLayout } from './panel-layout';
import { useCheck } from './use-check';

// The code view loads only when asked for, so the canvas opens without CodeMirror.
const CodeView = dynamic(() => import('./code-view'), {
  ssr: false,
  loading: () => <Skeleton className="h-[28rem] w-full rounded-xl" />,
});

interface EditorProps {
  readonly initial: JsonObject;
  // A step to open at once, when it is in the draft.
  readonly initialStep: string | null;
  // An existing workflow: its namespace and name stay, and leaving returns to it.
  readonly existing: {
    readonly namespace: string;
    readonly name: string;
  } | null;
  readonly secretNames: readonly string[];
  readonly conformance: ConformanceStatement;
}

type View = 'canvas' | 'code';

interface TextError {
  readonly message: string;
  readonly from: number;
  readonly to: number;
  readonly line: number;
}

interface Place {
  readonly listPointer: string;
  readonly index: number;
}

const CASE = 'case-';

// The builder (FR-022, FR-023): the workflow as a graph, a side panel for the picked node,
// "what happens next?" on every `+`, and the same document as YAML or JSON in the code view.
export function Editor({
  initial,
  initialStep,
  existing,
  secretNames,
  conformance,
}: EditorProps) {
  const router = useRouter();
  const isMobile = useIsMobile();
  const [draft, setDraft] = useState(initial);
  const [view, setView] = useState<View>('canvas');
  const [text, setText] = useState('');
  const [format, setFormat] = useState<TextFormat>('yaml');
  const [textError, setTextError] = useState<TextError | null>(null);
  // The step the editor opened at: picked, and brought into view once.
  const [opened] = useState(() => {
    const id = openedOf(initial, initialStep);
    return id === null ? null : { id };
  });
  const [selected, setSelected] = useState(opened?.id ?? null);
  const [creating, setCreating] = useState<Place | null>(null);
  const [focus, setFocus] = useState<{ from: number; to: number } | null>(null);
  const [publishProblem, setPublishProblem] = useState<Problem | null>(null);
  const [publishing, startPublish] = useTransition();
  const published = useRef(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const check = useCheck(draft, textError === null);
  const located = useMemo(
    () => (check.kind === 'problem' ? locate(draft, check.problem) : null),
    [check, draft],
  );
  const header = headerOf(draft);
  const entry =
    selected === null || selected === START ? null : entryAt(draft, selected);
  const changed = draft !== initial;

  useEffect(() => {
    if (!changed) return;

    const warn = (event: BeforeUnloadEvent) => {
      if (!published.current) event.preventDefault();
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

  // A step a `try` protects on its own is picked as its `try`, the node it is drawn as.
  function select(id: string | null) {
    setCreating(null);
    setSelected(id === null ? null : protectorOf(draft, id));
  }

  function openCreator(listPointer: string, index: number) {
    setSelected(null);
    setCreating({ listPointer, index });
  }

  function insert(kind: TaskKind) {
    if (creating === null) return;

    const name = freeName(draft, infoOf(kind).stem);
    update(
      insertTask(
        draft,
        creating.listPointer,
        creating.index,
        name,
        newTask(kind),
      ),
    );
    setCreating(null);
    setSelected(`${creating.listPointer}/${creating.index}/${name}`);
  }

  function changeTask(task: JsonObject) {
    if (entry !== null) update(replaceTask(draft, entry, task));
  }

  function rename(name: string) {
    if (entry === null) return;

    const protection = protectionOf(draft, entry);
    update(renamedStep(draft, entry, protection, name));
    setSelected(`${entry.listPointer}/${entry.index}/${name}`);
  }

  function duplicate() {
    if (entry === null) return;

    const next = duplicateTask(draft, entry);
    const copy = entriesAt(next, entry.listPointer)[entry.index + 1];
    update(next);
    setSelected(copy?.pointer ?? null);
    toast.success(`Duplicated ${entry.name}`);
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
      action: { label: 'Undo', onClick: () => update(before) },
    });
  }

  // A connection dragged from a step, or from a case of a choice, to another step of the
  // same list: the DSL says it with `then` (research R11).
  function connect(
    source: string,
    sourceHandle: string | null,
    target: string,
  ) {
    const from = entryAt(draft, source);
    const to = entryAt(draft, target);

    if (from === null || to === null) return;

    if (sourceHandle?.startsWith(CASE) === true) {
      const index = Number(sourceHandle.slice(CASE.length));
      update(withValue(draft, caseThen(draft, from.pointer, index), to.name));
      toast.success(`That path of ${from.name} now goes to ${to.name}`);
      return;
    }

    update(withValue(draft, `${from.pointer}/then`, to.name));
    toast.success(`${from.name} now goes on to ${to.name}`);
  }

  // A jump or a case removed: the step goes on to the next one again.
  function disconnect(edge: CanvasEdge) {
    const from = entryAt(draft, edge.source);

    if (from === null) return;

    if (edge.kind === 'case') {
      const index = edge.caseIndex ?? 0;
      update(
        withValue(draft, caseThen(draft, from.pointer, index), 'continue'),
      );
      return;
    }

    update(withMember(draft, `${from.pointer}/then`, undefined));
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

  function showCanvas() {
    if (textError !== null) {
      toast.error('Fix the text first', { description: textError.message });
      return;
    }

    setView('canvas');
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

    select(located.taskPointer ?? START);
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
  const flagged = located === null ? null : (located.taskPointer ?? START);
  const panelOpen = creating !== null || selected !== null;
  const layout = usePanelLayout(panelOpen);
  // The panels' sizes come from this browser, so the split is drawn after hydration.
  const hydrated = useHydrated();

  const panel =
    creating !== null ? (
      <NodeCreator onPick={insert} onClose={() => setCreating(null)} />
    ) : selected === START ? (
      <PanelFrame
        title="The workflow and its start"
        onClose={() => select(null)}
      >
        <div className="flex flex-col gap-4 p-4">
          <TriggerCard draft={draft} onChange={update} />
          <HeaderCard
            draft={draft}
            onChange={update}
            named={existing !== null}
          />
        </div>
      </PanelFrame>
    ) : entry !== null ? (
      <PanelFrame title="Step" onClose={() => select(null)}>
        <EditingProvider
          value={{
            ...editing,
            taskPointer: entry.pointer,
            siblingNames: siblingsOf(draft, entry.listPointer, entry.name),
          }}
        >
          <Inspector
            key={entry.pointer}
            draft={draft}
            entry={entry}
            onChange={changeTask}
            onRename={rename}
            onMove={move}
            onDuplicate={duplicate}
            onRemove={remove}
          />
        </EditingProvider>
      </PanelFrame>
    ) : null;

  const canvas = (
    <div className="relative size-full">
      <WorkflowCanvas
        document={draft}
        editable
        selected={selected}
        flagged={flagged}
        onSelect={select}
        onInsert={openCreator}
        onConnect={connect}
        onDisconnect={disconnect}
        reveal={opened}
      />
      {!panelOpen && (
        <div className="pointer-events-none absolute top-3 left-1/2 hidden -translate-x-1/2 rounded-full border bg-background/90 px-3 py-1 text-xs text-muted-foreground shadow-xs backdrop-blur lg:block">
          Click a step to set it up, + to add one, drag from a dot to jump
        </div>
      )}
    </div>
  );

  return (
    <EditingProvider value={editing}>
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex flex-wrap items-center gap-2 border-b bg-background px-3 py-2 md:px-4">
          <Button variant="ghost" size="icon-sm" asChild>
            <Link href={back} aria-label="Back">
              <ArrowLeftIcon />
            </Link>
          </Button>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold">
              {existing === null ? 'New workflow' : existing.name}
              <span className="ml-2 rounded-md bg-muted px-1.5 py-0.5 font-mono text-[11px] font-normal text-muted-foreground">
                {header.version}
              </span>
            </div>
            <div className="max-w-[60vw] md:max-w-xl">
              <CheckStatus
                state={check}
                textError={textError?.message ?? null}
                onShow={showProblem}
              />
            </div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <ToggleGroup
              type="single"
              variant="outline"
              size="sm"
              value={view}
              onValueChange={(next) =>
                next === 'code'
                  ? showCode()
                  : next === 'canvas'
                    ? showCanvas()
                    : undefined
              }
            >
              <ToggleGroupItem value="canvas" aria-label="Canvas">
                <WorkflowIcon />
                <span className="hidden sm:inline">Canvas</span>
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
        </div>

        {publishProblem !== null && (
          <div className="flex flex-col gap-2 border-b bg-red-500/[0.03] px-4 py-3">
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
          <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-auto p-4">
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
                Open Workflow DSL {conformance.dsl.at(-1)}; the canvas and this
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
          <div className="relative flex min-h-0 flex-1">
            {!hydrated ? (
              canvas
            ) : isMobile ? (
              <>
                {canvas}
                <Sheet
                  open={panelOpen}
                  onOpenChange={(open) => !open && select(null)}
                >
                  <SheetContent
                    side="bottom"
                    className="flex flex-col p-0 data-[side=bottom]:h-[85svh] [&>button]:hidden"
                  >
                    <SheetHeader className="sr-only">
                      <SheetTitle>Panel</SheetTitle>
                    </SheetHeader>
                    {panel}
                  </SheetContent>
                </Sheet>
              </>
            ) : (
              // The panel's width is the author's to drag, and is kept (research R17).
              <ResizablePanelGroup
                id="workflow-editor"
                orientation="horizontal"
                defaultLayout={layout.defaultLayout}
                onLayoutChanged={layout.onLayoutChanged}
              >
                <ResizablePanel id="canvas" minSize="35">
                  {canvas}
                </ResizablePanel>
                {panelOpen && (
                  <>
                    <ResizableHandle withHandle />
                    <ResizablePanel
                      id="panel"
                      defaultSize="32"
                      minSize={320}
                      maxSize="60"
                      className="flex min-h-0 flex-col bg-background shadow-[-8px_0_24px_-16px_rgb(0_0_0/0.15)]"
                    >
                      {panel}
                    </ResizablePanel>
                  </>
                )}
              </ResizablePanelGroup>
            )}
          </div>
        )}
      </div>
    </EditingProvider>
  );
}

function PanelFrame({
  title,
  onClose,
  children,
}: {
  readonly title: string;
  readonly onClose: () => void;
  readonly children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center justify-between border-b bg-background/95 px-4 py-2.5 backdrop-blur">
        <span className="text-xs font-medium text-muted-foreground">
          {title}
        </span>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Close"
          onClick={onClose}
        >
          <XIcon />
        </Button>
      </div>
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        {children}
      </div>
    </div>
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

// The pointer of the `then` of a choice's case, by the case's position.
// The case name is escaped as a pointer token (RFC 6901), as a name may hold `/` or `~`.
function caseThen(draft: JsonObject, pointer: string, index: number): string {
  const tokens = [...tokensOf(pointer), 'switch', index];
  const item = valueAt(draft, pointerOf(tokens));
  const name = isObject(item) ? (Object.keys(item)[0] ?? '') : '';
  return pointerOf([...tokens, name, 'then']);
}

// The step the editor opens with, as drawn on the canvas, or none when the draft lacks it.
function openedOf(draft: JsonObject, pointer: string | null): string | null {
  if (pointer === null || entryAt(draft, pointer) === null) return null;

  return protectorOf(draft, pointer);
}
