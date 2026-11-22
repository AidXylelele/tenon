"use client";

import type { LSPClient } from "@codemirror/lsp-client";
import { Transaction } from "@codemirror/state";
import type { ViewUpdate } from "@codemirror/view";
import type { Trigger } from "language-server/protocol";
import { type LayoutStorage, useDefaultLayout } from "react-resizable-panels";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  type CodeAction,
  type Diagnostic,
  DiagnosticSeverity,
} from "vscode-languageserver-protocol";
import type { DraftRevision, Version } from "@/libs/data-access/types";
import { isObject } from "@/libs/json/json";
import {
  applyCodeAction,
  codeActionsFor,
  offersCodeActions,
} from "@/libs/language-client/code-actions";
import { isSameDiagnostic } from "@/libs/language-client/diagnostic-text";
import type { DiagnosticsBoard } from "@/libs/language-client/diagnostics-board";
import { WORKFLOWS_HREF, workflowHref } from "@/libs/routing/routes";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/libs/ui/components/resizable";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/libs/ui/components/toggle-group";
import type { StepKind } from "@/operations/step-kinds";
import { type Place, placeOf, START } from "@/operations/workflow-graph";
import { textFromJson } from "@/operations/workflow-language";
import { CodeEditor } from "@/features/code-editor";
import { Problems, type QuickFix } from "@/features/problems";
import { StepInspector } from "@/features/step-inspector";
import {
  type CanvasEditing,
  StepPicker,
  WorkflowCanvas,
} from "@/features/workflow-canvas";
import { DraftKeeper } from "./draft-keeper";
import { DraftGuard, DraftResolution } from "./draft-views";
import { EditorHeader } from "./editor-header";
import type { WorkflowName } from "./interfaces";
import { PublishBar } from "./publish-bar";
import { StartPanel } from "./start-panel";
import { flaggedSteps, useEditingSession } from "./use-editing-session";
import { nextVersion, VERSION_POINTER } from "./version";

type Pane = "text" | "canvas" | "task";

interface EditingSurfaceProps {
  readonly client: LSPClient;
  readonly board: DiagnosticsBoard;
  readonly name: WorkflowName;
  readonly text: string;
  readonly currentVersion: string | null;
  readonly revision: DraftRevision | null;
  readonly bumpFrom: string | null;
  readonly task: string | null;
  readonly userId: string;
}

const NO_PROBLEMS: readonly Diagnostic[] = [];

const LAYOUT_STORAGE: LayoutStorage = {
  getItem: (key) => {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem: (key, value) => {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      return;
    }
  },
};

export function EditingSurface({
  client,
  board,
  name,
  text,
  currentVersion,
  revision,
  bumpFrom,
  task,
  userId,
}: EditingSurfaceProps) {
  const uri = `file:///${encodeURIComponent(name.namespace)}/${encodeURIComponent(name.name)}.yaml`;
  const editing = useEditingSession(client, board, uri, task);
  const [keeper] = useState(
    () => new DraftKeeper(name, revision, editing.view),
  );
  const [platform, setPlatform] = useState<readonly Diagnostic[]>(NO_PROBLEMS);
  const [actions, setActions] = useState<readonly CodeAction[]>([]);
  const [inserting, setInserting] = useState<Place | null>(null);
  const [pane, setPane] = useState<Pane>("canvas");
  const layout = useDefaultLayout({
    id: "workflow-editor",
    storage: LAYOUT_STORAGE,
    onlySaveAfterUserInteractions: true,
  });
  const quiet = useRef(false);
  const bumped = useRef(false);
  const structure = editing.structure;
  const problems = useMemo(
    () => [...editing.diagnostics, ...platform],
    [editing.diagnostics, platform],
  );
  const flagged = useMemo(
    () => flaggedSteps(structure, problems),
    [structure, problems],
  );
  const back =
    currentVersion === null
      ? WORKFLOWS_HREF
      : workflowHref(name.namespace, name.name);
  const selected = editing.selected;
  const place =
    selected === null || structure === null
      ? null
      : placeOf(structure.workflow.steps, selected.id);
  const errors = editing.diagnostics.filter(
    (each) => each.severity === DiagnosticSeverity.Error,
  );
  const { onUpdate: follow, edit, select, reveal, session, view } = editing;

  const onUpdate = useCallback(
    (update: ViewUpdate) => {
      follow(update);
      const remote = update.transactions.some(
        (transaction) => transaction.annotation(Transaction.remote) === true,
      );

      if (!update.docChanged || quiet.current || remote) return;

      keeper.changed();
      setPlatform(NO_PROBLEMS);
    },
    [follow, keeper],
  );

  const onSelect = useCallback(
    (step: string | null) => {
      select(step);

      if (step !== null) setPane("task");
    },
    [select],
  );

  const canvasEditing = useMemo<CanvasEditing>(
    () => ({
      onInsert: setInserting,
      onRemove: (step) => {
        void edit({ kind: "removeStep", step });
      },
    }),
    [edit],
  );

  const readMine = useCallback(
    () => view()?.state.doc.toString() ?? "",
    [view],
  );

  useEffect(() => {
    let current = true;
    const offered = offersCodeActions(client);

    if (!offered || editing.diagnostics.length === 0) return;

    codeActionsFor(client, uri, editing.diagnostics).then(
      (found) => {
        if (current) setActions(found);
      },
      () => undefined,
    );

    return () => {
      current = false;
    };
  }, [client, uri, editing.diagnostics]);

  useEffect(() => {
    if (bumpFrom === null || structure === null || bumped.current) return;

    bumped.current = true;
    quiet.current = true;
    const value = nextVersion(bumpFrom);
    const bump = { kind: "setField" as const, pointer: VERSION_POINTER, value };
    void edit(bump, false).finally(() => {
      quiet.current = false;
    });
  }, [bumpFrom, structure, edit]);

  useEffect(() => {
    function recheck() {
      if (document.visibilityState === "visible")
        keeper.recheck().catch(() => undefined);
    }

    document.addEventListener("visibilitychange", recheck);
    return () => {
      document.removeEventListener("visibilitychange", recheck);
      keeper.dispose();
    };
  }, [keeper]);

  async function afterPublishing(version: Version) {
    const value = nextVersion(version.version);
    await edit({ kind: "setField", pointer: VERSION_POINTER, value }, false);
    await keeper.flush();
  }

  function takeVersion(value: string) {
    void edit({ kind: "setField", pointer: VERSION_POINTER, value });
  }

  async function load(loaded: string) {
    const editor = view();

    if (editor === null) return;

    const replacement = await yamlOf(loaded);
    const length = editor.state.doc.length;
    editor.dispatch({ changes: { from: 0, to: length, insert: replacement } });
    setPane("text");
  }

  async function yamlOf(loaded: string): Promise<string> {
    try {
      const value: unknown = JSON.parse(loaded);

      if (!isObject(value)) return loaded;

      const converted = await textFromJson(client, value);
      return converted.text;
    } catch {
      return loaded;
    }
  }

  async function showTrigger(trigger: Trigger) {
    const placed = await session.rangesOf([trigger.pointer]);
    const range = placed.ranges[0] ?? null;

    if (range === null) return;

    reveal(range.start);
    setPane("text");
  }

  function pick(kind: StepKind) {
    const at = inserting;
    setInserting(null);

    if (at === null) return;

    void edit({
      kind: "insertStep",
      list: at.list,
      index: at.index,
      step: kind,
      name: null,
    });
  }

  function fixesFor(problem: Diagnostic): readonly QuickFix[] {
    const offered = actions.filter((action) =>
      (action.diagnostics ?? []).some((each) =>
        isSameDiagnostic(each, problem),
      ),
    );
    return offered.map((action) => ({
      title: action.title,
      apply: () => {
        const editor = view();

        if (editor !== null) void applyCodeAction(client, editor, uri, action);
      },
    }));
  }

  const textPane = (
    <section aria-label="Text" className="flex size-full min-h-0 flex-col">
      <div className="min-h-0 flex-1">
        <CodeEditor
          client={client}
          uri={uri}
          text={text}
          onView={editing.onView}
          onUpdate={onUpdate}
        />
      </div>
      <div className="flex max-h-48 min-h-20 flex-col border-t">
        <h2 className="heading-3 px-3 pt-2">
          Problems{" "}
          <span className="text-muted-foreground tabular-nums">
            {problems.length}
          </span>
        </h2>
        <div className="min-h-0 overflow-y-auto">
          <Problems
            problems={problems}
            onShow={(problem) => {
              reveal(problem.range.start);
              setPane("text");
            }}
            fixesFor={fixesFor}
          />
        </div>
      </div>
    </section>
  );

  const canvasPane = (
    <section aria-label="Canvas" className="relative size-full min-h-96">
      {structure !== null && (
        <WorkflowCanvas
          workflow={structure.workflow}
          scope={`${name.namespace}/${name.name}`}
          editing={structure.stale ? null : canvasEditing}
          selected={editing.selectedId}
          flagged={flagged}
          onSelect={onSelect}
        />
      )}
      {structure?.stale === true && (
        <p className="absolute top-2 right-2 rounded-lg border bg-warning-soft px-3 py-1 text-xs">
          The text does not read; the canvas shows its last good state.
        </p>
      )}
    </section>
  );

  const taskPane = (
    <section aria-label="Task" className="flex size-full min-h-0 flex-col">
      {editing.selectedId === START && structure !== null ? (
        <StartPanel
          triggers={structure.workflow.triggers}
          form={editing.startForm}
          formless={editing.startFormless}
          onShow={(trigger) => {
            void showTrigger(trigger);
          }}
          onEdit={(action) => {
            void edit(action);
          }}
          onClose={() => {
            select(null);
          }}
        />
      ) : selected === null ? (
        <p className="p-4 text-sm text-muted-foreground">
          Select a task or the start on the canvas, or a task in the text, to
          see it here.
        </p>
      ) : (
        <StepInspector
          step={selected}
          form={editing.form}
          formless={editing.formless}
          place={place}
          onEdit={(action) => {
            void edit(action);
          }}
          onClose={() => {
            select(null);
          }}
        />
      )}
    </section>
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <EditorHeader
        name={name}
        back={back}
        keeper={keeper}
        userId={userId}
        onLoad={(loaded) => {
          void load(loaded);
        }}
      >
        <PublishBar
          session={session}
          problems={errors.length}
          onPlatformProblems={setPlatform}
          publish={() => keeper.publish()}
          onPublished={afterPublishing}
          currentVersion={currentVersion}
          onUseVersion={takeVersion}
        />
      </EditorHeader>
      <DraftResolution keeper={keeper} readMine={readMine} />
      {editing.refusal !== null && (
        <p
          role="alert"
          className="border-b bg-destructive-soft px-4 py-2 text-sm text-destructive"
        >
          {editing.refusal}
        </p>
      )}
      <ToggleGroup
        type="single"
        variant="outline"
        size="sm"
        value={pane}
        onValueChange={(value) => {
          if (value === "text" || value === "canvas" || value === "task")
            setPane(value);
        }}
        className="m-2 self-start lg:hidden"
        aria-label="Pane"
      >
        <ToggleGroupItem value="text">Text</ToggleGroupItem>
        <ToggleGroupItem value="canvas">Canvas</ToggleGroupItem>
        <ToggleGroupItem value="task">Task</ToggleGroupItem>
      </ToggleGroup>
      <ResizablePanelGroup
        id="workflow-editor"
        orientation="horizontal"
        defaultLayout={layout.defaultLayout}
        onLayoutChanged={layout.onLayoutChanged}
        className="min-h-0 flex-1 max-lg:[&>[data-shown=false]]:hidden! max-lg:[&>[data-shown=true]]:flex-[1_1_100%]!"
      >
        <ResizablePanel
          id="text"
          defaultSize="33"
          minSize="20"
          data-shown={pane === "text"}
        >
          {textPane}
        </ResizablePanel>
        <ResizableHandle withHandle className="max-lg:hidden" />
        <ResizablePanel
          id="canvas"
          defaultSize="40"
          minSize="25"
          data-shown={pane === "canvas"}
        >
          {canvasPane}
        </ResizablePanel>
        <ResizableHandle withHandle className="max-lg:hidden" />
        <ResizablePanel
          id="task"
          defaultSize="27"
          minSize={320}
          data-shown={pane === "task"}
        >
          {taskPane}
        </ResizablePanel>
      </ResizablePanelGroup>
      <StepPicker
        open={inserting !== null}
        onOpenChange={(open) => {
          if (!open) setInserting(null);
        }}
        onPick={pick}
      />
      <DraftGuard keeper={keeper} />
    </div>
  );
}
