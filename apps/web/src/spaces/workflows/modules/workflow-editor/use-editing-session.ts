"use client";

import { type LSPClient, LSPPlugin } from "@codemirror/lsp-client";
import { EditorSelection } from "@codemirror/state";
import { EditorView, type ViewUpdate } from "@codemirror/view";
import type {
  EditAction,
  IdChange,
  StepVariant,
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
import type { Diagnostic, Position } from "vscode-languageserver-protocol";
import type { DiagnosticsBoard } from "@/libs/language-client/diagnostics-board";
import { isOutdated, reasonOf } from "@/libs/language-client/failures";
import { applyTextEdits } from "@/libs/language-client/text-edits";
import {
  stepVariantsOf,
  WorkflowSession,
} from "@/operations/workflow-language";
import { START, stepAt, stepWithId } from "@/features/workflow-flow";
import type { EditingSession, FormReading } from "./interfaces";
import { protectingTryOf } from "./steps";

const NONE: readonly Diagnostic[] = [];

const NO_VARIANTS: readonly StepVariant[] = [];

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
  const [variants, setVariants] = useState<readonly StepVariant[]>(NO_VARIANTS);
  const known = useRef<StructureResult | null>(null);
  const pending = useRef<string | null>(task);

  useEffect(() => {
    let current = true;

    stepVariantsOf(client).then(
      (read) => {
        if (current) setVariants(read.variants);
      },
      (failure: unknown) => {
        if (current) setRefusal(reasonOf(failure));
      },
    );

    return () => {
      current = false;
    };
  }, [client]);

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
      : { kind: "step", id: selectedId, form: null, protection: null };
    const asked: Promise<FormReading> = start
      ? session.workflowForm().then((form) => ({ kind: "start", form }))
      : stepReadingOf(session, structure, selectedId);

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
    async (actions: readonly EditAction[], remembered = true) => {
      setRefusal(null);
      const editor = view.current;

      if (editor === null) return false;

      try {
        for (const action of actions) {
          const result = await session.edit(action);
          applyTextEdits(editor, result.edits, remembered);
          client.sync();
          setSelectedId((before) => selectionAfter(action, result.ids, before));
        }
        return true;
      } catch (failure) {
        if (!isOutdated(failure)) setRefusal(reasonOf(failure));

        return false;
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
    protection: stepReading?.protection ?? null,
    formless: stepReading !== null && stepReading.form === null,
    startForm: startReading?.form ?? null,
    startFormless: startReading !== null && startReading.form === null,
    variants,
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

async function stepReadingOf(
  session: WorkflowSession,
  structure: StructureResult | null,
  id: string,
): Promise<FormReading> {
  const steps = structure?.workflow.steps ?? null;
  const guard = steps === null ? null : protectingTryOf(steps, id);
  const asked = session.stepForm(id);
  const protecting = guard === null ? null : session.stepForm(guard.id);
  const [form, protection] = await Promise.all([asked, protecting]);
  return { kind: "step", id, form, protection };
}
