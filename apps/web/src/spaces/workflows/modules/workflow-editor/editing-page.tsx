"use client";

import type { LSPClient } from "@codemirror/lsp-client";
import type { ViewUpdate } from "@codemirror/view";
import type { EditAction, Step } from "language-server/protocol";
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
import type { DraftRevision } from "@/libs/data-access/types";
import type { JsonValue } from "@/libs/json/json";
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
import { Announcer } from "@/libs/ui/composites/announcer";
import { useIsMobile } from "@/libs/ui/hooks/use-mobile";
import { cn } from "@/libs/ui/tokens/cn";
import { isUnended } from "@/operations/run-progress";
import type { QuickFix } from "@/features/problems";
import {
  type FlowHandle,
  type FlowMode,
  type InsertPlace,
  listsOf,
  type RunStart,
  START,
  stepAt,
  stepsIn,
  WorkflowFlow,
} from "@/features/workflow-flow";
import { CodeView } from "./code-view";
import { DraftStore } from "./draft-store";
import { DraftGuard, DraftLine, DraftResolution } from "./draft-views";
import { EditingAside } from "./editing-aside";
import { EditorToolbar } from "./editor-toolbar";
import type { SlotSources } from "./form-slots";
import type { Aside, CodeShown, Starts, WorkflowName } from "./interfaces";
import { marksOf } from "./marks";
import { PublishBar } from "./publish-bar";
import type { EntryAction } from "./step-catalog";
import type { Webhook } from "./step-form";
import { samplesOf, stepRunsOf } from "./test-run";
import { useEditingSession } from "./use-editing-session";
import { usePublishing } from "./use-publishing";
import { useStepChanges } from "./use-step-changes";
import { useTestRun } from "./use-test-run";
import { nextVersion, versionEdit } from "./version";
import { yamlOf } from "./yaml-text";

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

const NO_PROBLEMS: readonly Diagnostic[] = [];

const NO_SAMPLES: Readonly<Record<string, JsonValue>> = {};

const FORM: Aside = { kind: "form" };

const TEST: Aside = { kind: "test" };

const PROBLEMS: Aside = { kind: "problems" };

const PANEL_SIZE = 400;
const PANEL_MIN = 360;
const PANEL_MAX = 520;
const MAIN_MIN = 560;
const ROOMY = "(min-width: 1200px)";
const MAIN_SHARE = "40";
const PANEL_SHARE = "40";
const PANEL_SHARE_MIN = "20";
const PANEL_SHARE_MAX = "60";

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
  const isMobile = useIsMobile();
  const [panelSize] = useState(panelSizeOf);
  const [shown, setShown] = useState<CodeShown>("flow");
  const [aside, setAside] = useState<Aside>(FORM);
  const [languageTerms, setLanguageTerms] = useState(false);
  const [wide, setWide] = useState(false);
  const [revealProblems, setRevealProblems] = useState(false);
  const [platform, setPlatform] = useState<readonly Diagnostic[]>(NO_PROBLEMS);
  const [actions, setActions] = useState<readonly CodeAction[]>([]);
  const bumped = useRef(false);
  const quiet = useRef(false);
  const test = useTestRun(name, store);
  const [testedText, setTestedText] = useState<string | null>(null);
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
  const root = structure?.workflow.steps ?? null;
  const changes = useStepChanges({ steps: root, flow, edit, select });
  const publishing = usePublishing({
    client,
    name,
    currentVersion,
    steps: root,
    store,
    edit,
  });
  const readMine = useCallback(
    () => view()?.state.doc.toString() ?? "",
    [view],
  );
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
  const steps = useMemo(() => (root === null ? [] : stepsIn(root)), [root]);
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
  const startsByItself = (structure?.workflow.triggers.length ?? 0) > 0;
  const tested = testedText !== null && testedText === readMine();
  const hasSteps = steps.length > 0;
  const ready = hasSteps && errors.length === 0 && tested;
  const testFirst = hasSteps && !ready;

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
      const size = next ? PANEL_MAX : panelSize;
      panel.current?.resize(size);
    },
    [panel, panelSize],
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
    const next = nextVersion(bumpFrom);
    const bump = versionEdit(next);
    void edit([bump], false).finally(() => {
      quiet.current = false;
    });
  }, [bumpFrom, structure, edit]);

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

  function choose(place: InsertPlace, action: EntryAction) {
    setAside(FORM);

    if (action.kind === "changeStart") {
      select(START);
      return;
    }

    if (action.kind === "insertStep") {
      void changes.choose(place, action);
      return;
    }

    const above = stepAbove(place);

    if (above === null) return;

    onEdit([{ kind: "setFailure", step: above.id, failure: action.failure }]);
  }

  function stepAbove(place: InsertPlace): Step | null {
    if (place.kind !== "list" || root === null) return null;

    const list = listsOf(root).find((each) => each.id === place.list);
    return list?.steps[place.index - 1] ?? null;
  }

  function showProblem(problem: Diagnostic) {
    const at = root === null ? null : stepAt(root, problem.range.start);

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

  async function load(loaded: string) {
    const editor = view();

    if (editor === null) return;

    const replacement = await yamlOf(client, loaded);
    replaceTextAsOneStep(editor, replacement, 0);
    setShown("code");
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

  const main = (
    <div className="relative flex size-full min-h-0 min-w-0 flex-col">
      <div className={cn("flex min-h-0 flex-1", shown !== "flow" && "hidden")}>
        {structure !== null && (
          <WorkflowFlow
            ref={flow}
            workflow={structure.workflow}
            mode={mode}
            selected={selectedId}
            onSelect={onSelect}
          />
        )}
      </div>
      <div
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
      </div>
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
        testFirst={testFirst}
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
        discard={publishing.discard}
      >
        <PublishBar
          session={session}
          problems={errors.length}
          onPlatformProblems={setPlatform}
          publish={publishing.publish}
          onPublished={publishing.afterPublishing}
          currentVersion={currentVersion}
          onUseVersion={(value) => {
            void publishing.setVersion(value);
          }}
          onShowProblems={showProblems}
          title={title}
          startsByItself={startsByItself}
          tested={tested}
          ready={ready}
          onTest={openTest}
          changesOf={publishing.changesSincePublished}
          setVersion={publishing.setVersion}
          turnOn={publishing.turnOn}
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
      {isMobile && (
        <p className="border-b bg-info-soft px-4 py-2 text-caption">
          Building is easier on a screen at least 1024 px wide. Here the flow
          scrolls in both directions and the panel is below it.
        </p>
      )}
      <ResizablePanelGroup
        id="workflow-editor"
        orientation={isMobile ? "vertical" : "horizontal"}
        className="min-h-0 flex-1"
      >
        <ResizablePanel id="main" minSize={isMobile ? MAIN_SHARE : MAIN_MIN}>
          {main}
        </ResizablePanel>
        <ResizableHandle withHandle aria-label="Resize the side panel" />
        <ResizablePanel
          id="panel"
          panelRef={panel}
          defaultSize={isMobile ? PANEL_SHARE : panelSize}
          minSize={isMobile ? PANEL_SHARE_MIN : PANEL_MIN}
          maxSize={isMobile ? PANEL_SHARE_MAX : PANEL_MAX}
        >
          <EditingAside
            aside={aside}
            editing={editing}
            name={name}
            webhooks={webhooks}
            starts={starts}
            title={title}
            status={status}
            marks={marks}
            steps={steps}
            problems={problems}
            test={test}
            revealProblems={revealProblems}
            languageTerms={languageTerms}
            sources={sources}
            fixesFor={fixesFor}
            onLanguageTerms={setLanguageTerms}
            onChoose={choose}
            onRemove={(step) => {
              void changes.remove(step);
            }}
            onRun={(input) => {
              setTestedText(readMine());
              void test.run(input);
            }}
            onShowProblem={showProblem}
            onSelect={onSelect}
            onTest={openTest}
            onForm={() => {
              setAside(FORM);
            }}
          />
        </ResizablePanel>
      </ResizablePanelGroup>
      <DraftGuard store={store} />
    </div>
  );
}

function panelSizeOf(): number {
  const roomy = window.matchMedia(ROOMY).matches;
  return roomy ? PANEL_SIZE : PANEL_MIN;
}
