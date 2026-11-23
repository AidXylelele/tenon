"use client";

import type { LSPClient } from "@codemirror/lsp-client";
import type { ViewUpdate } from "@codemirror/view";
import type { EditAction, Step, StepVariant } from "language-server/protocol";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePanelRef } from "react-resizable-panels";
import {
  type CodeAction,
  type Diagnostic,
  DiagnosticSeverity,
} from "vscode-languageserver-protocol";
import {
  isChangedHere,
  replaceTextAsOneStep,
} from "@/libs/codemirror/owned-text";
import type { DraftRevision, Version } from "@/libs/data-access/types";
import { isObject, type JsonValue } from "@/libs/json/json";
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
import { Announcer, useAnnounce } from "@/libs/ui/composites/announcer";
import { PanelHeader } from "@/libs/ui/composites/panel-header";
import { useIsMobile } from "@/libs/ui/hooks/use-mobile";
import { cn } from "@/libs/ui/tokens/cn";
import { isUnended } from "@/operations/run-progress";
import { textFromJson } from "@/operations/workflow-language";
import type { QuickFix } from "@/features/problems";
import {
  type FlowHandle,
  type FlowMode,
  type InsertPlace,
  type RunStart,
  START,
  WorkflowFlow,
} from "@/features/workflow-flow";
import { CodeView } from "./code-view";
import { DraftStore } from "./draft-store";
import { DraftGuard, DraftLine, DraftResolution } from "./draft-views";
import { EditorToolbar } from "./editor-toolbar";
import type { SlotSources } from "./form-slots";
import type { Aside, CodeShown, Starts, WorkflowName } from "./interfaces";
import { marksOf } from "./marks";
import { ProblemsPanel } from "./problems-panel";
import { PublishBar } from "./publish-bar";
import { StartPanel } from "./start-panel";
import { type EntryAction, StepCatalog } from "./step-catalog";
import type { Webhook } from "./step-form";
import { StepPanel } from "./step-panel";
import { placeOf, stepAt, stepsIn } from "./steps";
import { SummaryPanel } from "./summary-panel";
import { samplesOf, stepRunsOf } from "./test-run";
import { TestRunPanel } from "./test-run-panel";
import { useEditingSession } from "./use-editing-session";
import { useTestRun } from "./use-test-run";
import { nextVersion, VERSION_POINTER } from "./version";

interface EditingPageProps {
  readonly client: LSPClient;
  readonly board: DiagnosticsBoard;
  readonly name: WorkflowName;
  readonly text: string;
  readonly currentVersion: string | null;
  readonly revision: DraftRevision | null;
  readonly bumpFrom: string | null;
  readonly task: string | null;
  readonly userId: string;
  readonly webhooks: readonly Webhook[];
  readonly starts: Starts | null;
}

interface PendingStep {
  readonly list: string;
  readonly index: number;
}

const NO_PROBLEMS: readonly Diagnostic[] = [];

const NO_SAMPLES: Readonly<Record<string, JsonValue>> = {};

const FORM: Aside = { kind: "form" };

const TEST: Aside = { kind: "test" };

const PROBLEMS: Aside = { kind: "problems" };

const PANEL_SIZE = 400;
const PANEL_MIN = 360;
const PANEL_MAX = 520;

const TEST_START: RunStart = {
  trigger: "manual",
  detail: "Test run of the draft",
};

function ignoreIteration(): void {
  return;
}

export function EditingPage(props: EditingPageProps) {
  return (
    <Announcer>
      <EditingBody {...props} />
    </Announcer>
  );
}

function EditingBody({
  client,
  board,
  name,
  text,
  currentVersion,
  revision,
  bumpFrom,
  task,
  userId,
  webhooks,
  starts,
}: EditingPageProps) {
  const uri = `file:///${encodeURIComponent(name.namespace)}/${encodeURIComponent(name.name)}.yaml`;
  const editing = useEditingSession(client, board, uri, task);
  const [store] = useState(() => new DraftStore(name, revision, editing.view));
  const flow = useRef<FlowHandle>(null);
  const panel = usePanelRef();
  const announce = useAnnounce();
  const isMobile = useIsMobile();
  const [shown, setShown] = useState<CodeShown>("flow");
  const [aside, setAside] = useState<Aside>(FORM);
  const [languageTerms, setLanguageTerms] = useState(false);
  const [wide, setWide] = useState(false);
  const [revealProblems, setRevealProblems] = useState(false);
  const [platform, setPlatform] = useState<readonly Diagnostic[]>(NO_PROBLEMS);
  const [actions, setActions] = useState<readonly CodeAction[]>([]);
  const pending = useRef<PendingStep | null>(null);
  const bumped = useRef(false);
  const quiet = useRef(false);
  const test = useTestRun(name, store);
  const {
    structure,
    diagnostics,
    select,
    reveal,
    edit,
    session,
    view,
    onUpdate: follow,
  } = editing;
  const problems = useMemo(
    () => [...diagnostics, ...platform],
    [diagnostics, platform],
  );
  const errors = useMemo(
    () =>
      problems.filter(
        (problem) => problem.severity === DiagnosticSeverity.Error,
      ),
    [problems],
  );
  const marks = useMemo(
    () => marksOf(structure, problems, revealProblems),
    [structure, problems, revealProblems],
  );
  const steps = useMemo(
    () => (structure === null ? [] : stepsIn(structure.workflow.steps)),
    [structure],
  );
  const testRun = test.state.kind === "ran" ? test.state.test : null;
  const records = testRun?.records ?? null;
  const samples = useMemo(
    () => (records === null ? NO_SAMPLES : samplesOf(records, steps)),
    [records, steps],
  );
  const stepRuns = useMemo(
    () => (records === null ? null : stepRunsOf(records, steps)),
    [records, steps],
  );
  const runEnded = testRun !== null && !isUnended(testRun.run.phase);
  const inserting = aside.kind === "catalog" ? aside.place : null;
  const showsRun = aside.kind === "test" && stepRuns !== null;
  const title = structure?.workflow.title ?? name.name;
  const back =
    currentVersion === null
      ? WORKFLOWS_HREF
      : workflowHref(name.namespace, name.name);
  const selectedId = editing.selectedId;
  const selected = editing.selected;

  const onEdit = useCallback(
    (list: readonly EditAction[]) => {
      void edit(list);
    },
    [edit],
  );

  const onInsert = useCallback((place: InsertPlace) => {
    setAside({ kind: "catalog", place });
  }, []);

  const onSelect = useCallback(
    (target: string | null) => {
      select(target);
      setAside(FORM);
    },
    [select],
  );

  const onWide = useCallback(
    (next: boolean) => {
      setWide(next);
      const size = next ? PANEL_MAX : PANEL_SIZE;
      panel.current?.resize(size);
    },
    [panel],
  );

  const mode = useMemo<FlowMode>(() => {
    if (showsRun)
      return {
        kind: "run",
        start: TEST_START,
        steps: stepRuns,
        ended: runEnded,
        onIteration: ignoreIteration,
      };

    return { kind: "edit", marks, inserting, onInsert };
  }, [showsRun, stepRuns, runEnded, marks, inserting, onInsert]);

  const sources = useMemo<SlotSources>(
    () => ({
      session,
      step: selectedId ?? "",
      samples,
      wide,
      onWide,
      onEdit,
    }),
    [session, selectedId, samples, wide, onWide, onEdit],
  );

  const onUpdate = useCallback(
    (update: ViewUpdate) => {
      follow(update);

      if (!isChangedHere(update) || quiet.current) return;

      store.changed();
      setPlatform(NO_PROBLEMS);
    },
    [follow, store],
  );

  const readMine = useCallback(
    () => view()?.state.doc.toString() ?? "",
    [view],
  );

  useEffect(() => {
    let current = true;
    const offered = offersCodeActions(client);

    if (!offered || diagnostics.length === 0) return;

    codeActionsFor(client, uri, diagnostics).then(
      (found) => {
        if (current) setActions(found);
      },
      () => undefined,
    );

    return () => {
      current = false;
    };
  }, [client, uri, diagnostics]);

  useEffect(() => {
    if (bumpFrom === null || structure === null || bumped.current) return;

    bumped.current = true;
    quiet.current = true;
    const value = nextVersion(bumpFrom);
    const bump: EditAction = {
      kind: "setField",
      pointer: VERSION_POINTER,
      value,
    };
    void edit([bump], false).finally(() => {
      quiet.current = false;
    });
  }, [bumpFrom, structure, edit]);

  useEffect(() => {
    const asked = pending.current;

    if (asked === null || structure === null) return;

    const lists = [
      structure.workflow.steps,
      ...steps.flatMap((step) => step.lists),
    ];
    const list = lists.find((each) => each.id === asked.list);
    const added = list?.steps[asked.index] ?? null;

    if (added === null) return;

    pending.current = null;
    select(added.id);
  }, [structure, steps, select]);

  useEffect(() => {
    function recheck() {
      if (document.visibilityState === "visible")
        store.recheck().catch(() => undefined);
    }

    document.addEventListener("visibilitychange", recheck);
    return () => {
      document.removeEventListener("visibilitychange", recheck);
      store.dispose();
    };
  }, [store]);

  function choose(action: EntryAction) {
    const place = inserting;

    if (place === null || structure === null) return;

    setAside(FORM);

    if (action.kind === "changeStart") {
      select(START);
      return;
    }

    if (action.kind === "setFailure") {
      const above = stepAbove(place);

      if (above === null) return;

      onEdit([{ kind: "setFailure", step: above.id, failure: action.failure }]);
      return;
    }

    const inserted = insertionOf(place, action.variant);
    pending.current = pendingOf(place);
    onEdit([inserted]);
    announce("Step added");
  }

  function stepAbove(place: InsertPlace): Step | null {
    if (place.kind !== "list" || structure === null) return null;

    const lists = [
      structure.workflow.steps,
      ...steps.flatMap((step) => step.lists),
    ];
    const list = lists.find((each) => each.id === place.list);
    return list?.steps[place.index - 1] ?? null;
  }

  function pendingOf(place: InsertPlace): PendingStep | null {
    if (place.kind === "list") return { list: place.list, index: place.index };

    if (structure === null) return null;

    const switched = placeOf(structure.workflow.steps, place.switch);
    const index = (switched?.index ?? 0) + 1;
    return switched === null ? null : { list: switched.list, index };
  }

  function remove(step: string) {
    flow.current?.focusAfterRemoving(step);
    onEdit([{ kind: "removeStep", step }]);
    announce("Step deleted");
  }

  function close() {
    select(null);
    setAside(FORM);
  }

  function showProblem(problem: Diagnostic) {
    const at =
      structure === null
        ? null
        : stepAt(structure.workflow.steps, problem.range.start);

    if (at !== null) {
      onSelect(at.id);
      return;
    }

    setShown("code");
    reveal(problem.range.start);
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

  function openTest() {
    setRevealProblems(true);
    setAside(errors.length > 0 ? PROBLEMS : TEST);
  }

  function showProblems() {
    setRevealProblems(true);
    setAside(PROBLEMS);
  }

  async function afterPublishing(version: Version) {
    const value = nextVersion(version.version);
    const bump: EditAction = {
      kind: "setField",
      pointer: VERSION_POINTER,
      value,
    };
    await edit([bump], false);
    await store.flush();
  }

  function takeVersion(value: string) {
    onEdit([{ kind: "setField", pointer: VERSION_POINTER, value }]);
  }

  async function load(loaded: string) {
    const editor = view();

    if (editor === null) return;

    const replacement = await yamlOf(loaded);
    replaceTextAsOneStep(editor, replacement, 0);
    setShown("code");
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

  function download() {
    const yaml = readMine();
    const file = new Blob([yaml], { type: "application/yaml" });
    const address = URL.createObjectURL(file);
    const link = document.createElement("a");
    link.href = address;
    link.download = `${name.name}.yaml`;
    link.click();
    URL.revokeObjectURL(address);
  }

  const status = (
    <>
      <DraftLine store={store} userId={userId} />
      {errors.length > 0 && revealProblems && (
        <>
          {" "}
          ·{" "}
          {errors.length === 1
            ? "1 problem"
            : `${String(errors.length)} problems`}
        </>
      )}
    </>
  );

  const sidePanel = (
    <aside className="flex size-full min-h-0 flex-col border-l bg-surface max-lg:border-t max-lg:border-l-0">
      {aside.kind === "catalog" && inserting !== null && (
        <CatalogAside
          place={inserting}
          root={structure?.workflow.steps.id ?? ""}
          variants={editing.variants}
          languageTerms={languageTerms}
          onChoose={choose}
          onClose={() => {
            setAside(FORM);
          }}
        />
      )}
      {aside.kind === "test" && (
        <TestRunPanel
          state={test.state}
          steps={steps}
          onRun={(input) => {
            void test.run(input);
          }}
          onAgain={test.reset}
          onBack={() => {
            setAside(FORM);
          }}
        />
      )}
      {aside.kind === "problems" && (
        <ProblemsPanel
          problems={problems}
          onShow={showProblem}
          fixesFor={fixesFor}
          onBack={() => {
            setAside(FORM);
          }}
        />
      )}
      {aside.kind === "form" && selectedId === START && (
        <StartPanel
          name={name}
          form={editing.startForm}
          formless={editing.startFormless}
          webhooks={webhooks}
          starts={starts}
          revealProblems={revealProblems}
          languageTerms={languageTerms}
          onEdit={onEdit}
          onClose={close}
        />
      )}
      {aside.kind === "form" && selected !== null && structure !== null && (
        <StepPanel
          key={selected.id}
          step={selected}
          form={editing.form}
          protection={editing.protection}
          formless={editing.formless}
          place={placeOf(structure.workflow.steps, selected.id)}
          variants={editing.variants}
          revealProblems={revealProblems}
          languageTerms={languageTerms}
          sources={sources}
          onLanguageTerms={setLanguageTerms}
          onRemove={remove}
          onClose={close}
        />
      )}
      {aside.kind === "form" && selectedId === null && structure !== null && (
        <SummaryPanel
          structure={structure}
          title={title}
          status={status}
          marks={marks}
          tested={testRun !== null}
          onSelect={onSelect}
          onTest={openTest}
        />
      )}
    </aside>
  );

  const main = (
    <div className="relative flex size-full min-h-0 min-w-0 flex-col">
      <section
        aria-label="Flow"
        className={cn("flex min-h-0 flex-1", shown !== "flow" && "hidden")}
      >
        {structure !== null && (
          <WorkflowFlow
            ref={flow}
            workflow={structure.workflow}
            mode={mode}
            selected={selectedId}
            onSelect={onSelect}
          />
        )}
      </section>
      <section
        aria-label="Code"
        className={cn(
          "flex min-h-0 flex-1 flex-col",
          shown !== "code" && "hidden",
        )}
      >
        <CodeView
          client={client}
          uri={uri}
          text={text}
          onView={editing.onView}
          onUpdate={onUpdate}
        />
      </section>
      {structure?.stale === true && (
        <p className="absolute top-2 right-2 rounded-lg border bg-warning-soft px-3 py-1 text-caption">
          The text does not read; the flow shows its last good state.
        </p>
      )}
    </div>
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <EditorToolbar
        title={title}
        back={back}
        status={status}
        shown={shown}
        problems={revealProblems ? errors.length : 0}
        testing={test.state.kind === "starting"}
        onShown={(next) => {
          setShown(next);
          setLanguageTerms(next === "code" || languageTerms);
        }}
        onProblems={showProblems}
        onTest={openTest}
        onLoad={(loaded) => {
          void load(loaded);
        }}
        onDownload={download}
      >
        <PublishBar
          session={session}
          problems={errors.length}
          onPlatformProblems={setPlatform}
          publish={() => store.publish()}
          onPublished={afterPublishing}
          currentVersion={currentVersion}
          onUseVersion={takeVersion}
          onShowProblems={showProblems}
        />
      </EditorToolbar>
      <DraftResolution store={store} readMine={readMine} />
      {editing.refusal !== null && (
        <p
          role="alert"
          className="border-b bg-destructive-soft px-4 py-2 text-sm text-destructive"
        >
          {editing.refusal}
        </p>
      )}
      {isMobile ? (
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          <p className="border-b bg-info-soft px-4 py-2 text-caption">
            Building is easier on a screen at least 1024 px wide. Here the flow
            scrolls in both directions and the panel is below it.
          </p>
          <div className="h-[60vh] min-h-80">{main}</div>
          <div className="min-h-96">{sidePanel}</div>
        </div>
      ) : (
        <ResizablePanelGroup
          id="workflow-editor"
          orientation="horizontal"
          className="min-h-0 flex-1"
        >
          <ResizablePanel id="main" minSize={560}>
            {main}
          </ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel
            id="panel"
            panelRef={panel}
            defaultSize={PANEL_SIZE}
            minSize={PANEL_MIN}
            maxSize={PANEL_MAX}
          >
            {sidePanel}
          </ResizablePanel>
        </ResizablePanelGroup>
      )}
      <DraftGuard store={store} />
    </div>
  );
}

function CatalogAside({
  place,
  root,
  variants,
  languageTerms,
  onChoose,
  onClose,
}: {
  readonly place: InsertPlace;
  readonly root: string;
  readonly variants: readonly StepVariant[];
  readonly languageTerms: boolean;
  readonly onChoose: (action: EntryAction) => void;
  readonly onClose: () => void;
}) {
  const where = whereOf(place, root);
  const stepAbove = place.kind === "list" ? place.above : null;

  return (
    <section
      aria-labelledby="catalog-title"
      className="flex min-h-0 flex-1 flex-col"
    >
      <PanelHeader
        title="Add a step"
        titleId="catalog-title"
        subtitle={where}
        onClose={onClose}
      />
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <StepCatalog
          variants={variants}
          stepAbove={stepAbove}
          languageTerms={languageTerms}
          onChoose={onChoose}
        />
      </div>
    </section>
  );
}

function whereOf(place: InsertPlace, root: string): string {
  if (place.kind === "branch") return `on the branch “${place.case}”`;

  if (place.above !== null) return `after ${place.above}`;

  return place.list === root ? "after the start" : "first in its block";
}

function insertionOf(place: InsertPlace, variant: StepVariant): EditAction {
  if (place.kind === "branch")
    return {
      kind: "insertStepOnBranch",
      switch: place.switch,
      case: place.case,
      step: variant,
      name: null,
    };

  return {
    kind: "insertStep",
    list: place.list,
    index: place.index,
    step: variant,
    name: null,
  };
}
