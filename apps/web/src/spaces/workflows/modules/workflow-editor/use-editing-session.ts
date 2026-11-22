"use client";

import { type LSPClient, LSPPlugin } from "@codemirror/lsp-client";
import { EditorSelection } from "@codemirror/state";
import { EditorView, type ViewUpdate } from "@codemirror/view";
import type {
  EditAction,
  IdChange,
  StructureResult,
} from "language-server/protocol";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  type Diagnostic,
  DiagnosticSeverity,
  type Position,
} from "vscode-languageserver-protocol";
import { isObject } from "@/libs/json/json";
import type { DiagnosticsBoard } from "@/libs/language-client/diagnostics-board";
import { isOutdated, reasonOf } from "@/libs/language-client/failures";
import { applyTextEdits } from "@/libs/language-client/text-edits";
import { START, stepAt, stepWithId } from "@/operations/workflow-graph";
import { WorkflowSession } from "@/operations/workflow-language";
import type { EditingSession, FormReading } from "./interfaces";

const NONE: readonly Diagnostic[] = [];

export function useEditingSession(
  client: LSPClient,
  board: DiagnosticsBoard,
  uri: string,
  task: string | null,
): EditingSession {
  const session = useMemo(
    () => new WorkflowSession(client, uri),
    [client, uri],
  );
  const view = useRef<EditorView | null>(null);
  const diagnostics = useSyncExternalStore(
    board.subscribe,
    () => board.diagnosticsOf(uri),
    () => NONE,
  );
  const [structure, setStructure] = useState<StructureResult | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reading, setReading] = useState<FormReading | null>(null);
  const [refusal, setRefusal] = useState<string | null>(null);
  const known = useRef<StructureResult | null>(null);
  const pending = useRef<string | null>(task);

  useEffect(() => {
    let current = true;

    session.structure().then(
      (read) => {
        if (!current) return;

        known.current = read;
        setStructure(read);
        const asked = pending.current;

        if (asked === null) return;

        pending.current = null;
        const step = stepWithId(read.workflow.steps, asked);
        setSelectedId(step?.id ?? null);

        if (step === null)
          setRefusal("The task from the link is not in this draft any more.");
      },
      (failure: unknown) => {
        if (current && !isOutdated(failure)) setRefusal(reasonOf(failure));
      },
    );

    return () => {
      current = false;
    };
  }, [session, diagnostics]);

  useEffect(() => {
    let current = true;

    if (selectedId === null) return;

    const start = selectedId === START;
    const failed: FormReading = start
      ? { kind: "start", form: null }
      : { kind: "step", id: selectedId, form: null };
    const asked: Promise<FormReading> = start
      ? session.workflowForm().then((form) => ({ kind: "start", form }))
      : session
          .stepForm(selectedId)
          .then((form) => ({ kind: "step", id: selectedId, form }));

    asked.then(
      (read) => {
        if (current) setReading(read);
      },
      (failure: unknown) => {
        if (current && !isOutdated(failure)) setReading(failed);
      },
    );

    return () => {
      current = false;
    };
  }, [session, selectedId, structure]);

  const stepReading =
    reading?.kind === "step" && reading.id === selectedId ? reading : null;
  const startReading =
    reading?.kind === "start" && selectedId === START ? reading : null;

  const selected = useMemo(
    () =>
      selectedId === null || structure === null
        ? null
        : stepWithId(structure.workflow.steps, selectedId),
    [selectedId, structure],
  );

  const onView = useCallback((created: EditorView) => {
    view.current = created;
  }, []);

  const currentView = useCallback(() => view.current, []);

  const onUpdate = useCallback((update: ViewUpdate) => {
    const read = known.current;

    if (!update.selectionSet || !update.view.hasFocus || read === null) return;

    const plugin = LSPPlugin.get(update.view);

    if (plugin === null) return;

    const head = update.state.selection.main.head;
    const at = plugin.toPosition(head);
    const step = stepAt(read.workflow.steps, at);
    setSelectedId(step?.id ?? null);
  }, []);

  const reveal = useCallback((start: Position) => {
    const editor = view.current;
    const plugin = editor === null ? null : LSPPlugin.get(editor);

    if (editor === null || plugin === null) return;

    const synced = plugin.fromPosition(start, plugin.syncedDoc);
    const at = plugin.unsyncedChanges.mapPos(synced);
    editor.dispatch({
      selection: EditorSelection.cursor(at),
      effects: EditorView.scrollIntoView(at, { y: "center" }),
    });
  }, []);

  const select = useCallback(
    (id: string | null) => {
      setSelectedId(id);
      const read = known.current;

      if (id === null || read === null) return;

      const step = stepWithId(read.workflow.steps, id);
      const start = step?.selectionRange?.start ?? null;

      if (start !== null) reveal(start);
    },
    [reveal],
  );

  const edit = useCallback(
    async (action: EditAction, remembered = true) => {
      setRefusal(null);
      const editor = view.current;

      if (editor === null) return;

      try {
        const result = await session.edit(action);
        applyTextEdits(editor, result.edits, remembered);
        client.sync();
        setSelectedId((before) => selectionAfter(action, result.ids, before));
      } catch (failure) {
        if (!isOutdated(failure)) setRefusal(reasonOf(failure));
      }
    },
    [client, session],
  );

  return {
    session,
    structure,
    diagnostics,
    selected,
    selectedId,
    form: stepReading?.form ?? null,
    formless: stepReading !== null && stepReading.form === null,
    startForm: startReading?.form ?? null,
    startFormless: startReading !== null && startReading.form === null,
    refusal,
    view: currentView,
    onView,
    onUpdate,
    select,
    reveal,
    edit,
  };
}

function selectionAfter(
  action: EditAction,
  ids: readonly IdChange[],
  before: string | null,
): string | null {
  if (action.kind === "removeStep" && action.step === before) return null;

  if (action.kind === "setFailure") return before;

  const moved = ids.find((change) => change.from === before);
  return moved?.to ?? before;
}

export function flaggedSteps(
  structure: StructureResult | null,
  diagnostics: readonly Diagnostic[],
): ReadonlySet<string> {
  if (structure === null) return new Set();

  const errors = diagnostics.filter(
    (diagnostic) => diagnostic.severity === DiagnosticSeverity.Error,
  );
  const steps = errors.map((error) =>
    stepAt(structure.workflow.steps, error.range.start),
  );
  const ids = steps.flatMap((step) => (step === null ? [] : [step.id]));
  const triggers = structure.workflow.triggers.map((each) => each.pointer);
  const atStart = errors.some((error) => startsIt(pointerOf(error), triggers));
  const flagged = atStart ? [...ids, START] : ids;
  return new Set(flagged);
}

function pointerOf(diagnostic: Diagnostic): string | null {
  const data: unknown = diagnostic.data;

  if (!isObject(data) || typeof data.pointer !== "string") return null;

  return data.pointer;
}

function startsIt(
  pointer: string | null,
  triggers: readonly string[],
): boolean {
  if (pointer === null || pointer === "") return false;

  return triggers.some(
    (trigger) => within(trigger, pointer) || within(pointer, trigger),
  );
}

function within(inner: string, outer: string): boolean {
  return inner === outer || inner.startsWith(`${outer}/`);
}
