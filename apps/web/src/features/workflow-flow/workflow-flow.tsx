"use client";

import { FlagIcon } from "lucide-react";
import type { StepList, Trigger } from "language-server/protocol";
import {
  type KeyboardEvent,
  memo,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { FlowCanvas } from "@/libs/flow/flow-canvas";
import { useRovingFocus } from "@/libs/ui/hooks/use-roving-focus";
import { cn } from "@/libs/ui/tokens/cn";
import { Connector, Gap } from "./connector";
import { FlowContext, useFlow, useFlowView, useSelected } from "./context";
import {
  continuesOf,
  hasStep,
  isReached,
  jumpsOf,
  lineOf,
  removalFocusOf,
  sourcesOf,
} from "./flow";
import { FlowViewStore } from "./flow-view-store";
import { sideRoomOf } from "./geometry";
import type {
  ConditionWords,
  FlowMode,
  FlowState,
  FlowView,
  Removal,
  RunView,
  StepMark,
  WorkflowFlowProps,
} from "./interfaces";
import { END, plusItemOf, START, START_ITEM, stepItemOf } from "./items";
import { JumpLines } from "./jump-lines";
import { plusLabelOf, startCardOf } from "./looks";
import { KindTile, Selectable } from "./parts";
import { Sequence } from "./sequence";

const FIRST_STEP_HINT = "Add your first step with this +";

const KEYBOARD =
  "The arrow keys move between the steps and the + buttons; Escape clears the selection.";

const NO_MARKS: ReadonlyMap<string, StepMark> = new Map();

const NO_CONDITIONS: ConditionWords = new Map();

export function WorkflowFlow({
  workflow,
  mode,
  selected = null,
  onSelect,
  ref,
}: WorkflowFlowProps) {
  const container = useRef<HTMLDivElement>(null);
  const removal = useRef<Removal | null>(null);
  const preferred = selected === null ? START_ITEM : stepItemOf(selected);
  const { itemProps, onFocus, onKeyDown, focus } = useRovingFocus(
    container,
    preferred,
    workflow,
  );
  const runSteps = mode.kind === "run" ? mode.steps : null;
  const ended = mode.kind === "run" && mode.ended;
  const run = useMemo(
    () => (runSteps === null ? null : { steps: runSteps, ended }),
    [runSteps, ended],
  );
  const shown = viewOf(mode, selected, itemProps, run);
  const [store] = useState(() => new FlowViewStore(shown));
  const steps = workflow.steps;
  const jumps = useMemo(() => jumpsOf(steps), [steps]);
  const sources = useMemo(() => sourcesOf(jumps), [jumps]);
  const select = onSelect ?? null;
  const onInsert = mode.kind === "edit" ? mode.onInsert : null;
  const onIteration = mode.kind === "run" ? mode.onIteration : null;
  const start = mode.kind === "run" ? mode.start : null;
  const kind = mode.kind;
  const state = useMemo<FlowState>(
    () => ({
      kind,
      onSelect: select,
      onInsert,
      onIteration,
      start,
      sources,
      store,
    }),
    [kind, select, onInsert, onIteration, start, sources, store],
  );
  const label = kind === "run" ? "The run's flow" : "The workflow's flow";
  const still = select === null && kind !== "edit";
  const description = still ? undefined : KEYBOARD;
  const room = { paddingInline: sideRoomOf(jumps.length) };
  const zoomAt = kind === "read" ? "top-right" : "bottom-left";

  useLayoutEffect(() => {
    store.show(shown);
  });

  useLayoutEffect(() => {
    const removed = removal.current;

    if (removed === null || hasStep(steps, removed.step)) return;

    removal.current = null;
    focus(removed.focus);
  }, [steps, focus]);

  useImperativeHandle(
    ref,
    () => ({
      focusAfterRemoving: (step: string) => {
        const targets = removalFocusOf(steps, step);
        removal.current = { step, focus: targets };
      },
      focusStep: (step: string) => {
        const item = stepItemOf(step);
        focus([item]);
      },
    }),
    [steps, focus],
  );

  function press(event: KeyboardEvent<HTMLElement>) {
    const target = event.target;
    const inside =
      target instanceof Node && event.currentTarget.contains(target);
    const clearing = event.key === "Escape" && !event.defaultPrevented;

    if (!inside) return;

    if (clearing) select?.(null);
    else onKeyDown(event);
  }

  return (
    <FlowContext value={state}>
      <FlowCanvas
        label={label}
        description={description}
        focusable={still}
        zoomAt={zoomAt}
      >
        <div
          ref={container}
          onFocus={onFocus}
          onKeyDown={press}
          style={room}
          className="relative pt-7 pb-20"
        >
          <JumpLines jumps={jumps} />
          <div className="relative flex flex-col items-center">
            <StartCard triggers={workflow.triggers} />
            <TopSequence list={steps} />
            <EndNode />
          </div>
        </div>
      </FlowCanvas>
    </FlowContext>
  );
}

function viewOf(
  mode: FlowMode,
  selected: string | null,
  itemProps: FlowView["itemProps"],
  run: RunView | null,
): FlowView {
  const marks = mode.kind === "edit" ? mode.marks : NO_MARKS;
  const inserting = mode.kind === "edit" ? mode.inserting : null;
  const conditions = mode.kind === "edit" ? mode.conditions : NO_CONDITIONS;
  const languageTerms = mode.kind === "edit" && mode.languageTerms;

  return {
    selected,
    itemProps,
    marks,
    inserting,
    run,
    conditions,
    languageTerms,
  };
}

const StartCard = memo(function StartCard({
  triggers,
}: {
  readonly triggers: readonly Trigger[];
}) {
  const { start } = useFlow();
  const chosen = useSelected(START);
  const look = startCardOf(triggers, start);
  const label = `Start: ${look.title}`;
  const card = cn(
    "w-70 rounded-lg border border-(--flow-node-border) bg-surface transition-[border-color,box-shadow] duration-(--duration-fast) ease-standard",
    chosen &&
      "border-(--flow-selected) bg-accent-soft shadow-[inset_3px_0_0_var(--accent-solid),0_0_0_1px_var(--flow-selected)]",
  );
  const content = (
    <>
      <KindTile icon={look.icon} start />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="font-semibold">{look.title}</span>
        <span className="text-caption text-muted-foreground">
          {look.detail}
        </span>
      </span>
    </>
  );
  const row =
    "flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left";

  return (
    <div role="group" aria-label={label} className={card}>
      {start === null ? (
        <Selectable target={START} className={row}>
          {content}
        </Selectable>
      ) : (
        <div className={row}>{content}</div>
      )}
    </div>
  );
});

const TopSequence = memo(function TopSequence({
  list,
}: {
  readonly list: StepList;
}) {
  const { onInsert } = useFlow();
  const first = list.steps[0];
  const below = first?.id ?? END;
  const line = useFlowView((view) => lineOf(view.run, START, below));
  const firstName = first?.name ?? null;
  const label = plusLabelOf(null, null, firstName);
  const place = { kind: "list", list: list.id, index: 0, above: null } as const;
  const item = plusItemOf(list.id, 0);
  const editing = onInsert !== null;
  const plus = editing ? { item, label, place } : null;
  const fresh = editing && first === undefined;
  const firstHint = fresh ? FIRST_STEP_HINT : undefined;

  return (
    <>
      <Connector line={line} plus={plus} hint={firstHint} />
      <Sequence list={list} owner={null} />
      <Closing list={list} />
    </>
  );
});

function Closing({ list }: { readonly list: StepList }) {
  const { onInsert } = useFlow();
  const last = list.steps.at(-1);
  const from = last?.id ?? START;
  const line = useFlowView((view) => lineOf(view.run, from, END));

  if (last === undefined) return null;

  if (!continuesOf(last)) return <Gap />;

  const count = list.steps.length;
  const label = plusLabelOf(null, last.name, null);
  const item = plusItemOf(list.id, count);
  const place = {
    kind: "list",
    list: list.id,
    index: count,
    above: last.name,
  } as const;
  const plus = onInsert === null ? null : { item, label, place };

  return <Connector line={line} plus={plus} />;
}

const EndNode = memo(function EndNode() {
  const reached = useFlowView(
    (view) => view.run === null || isReached(view.run, END),
  );
  const words = reached ? "End" : "Not reached";
  const pill = cn(
    "flex h-8 w-35 items-center justify-center gap-1.5 rounded-full border border-(--flow-node-border) bg-surface font-semibold text-muted-foreground",
    !reached && "border-dashed bg-subtle",
  );

  return (
    <p className={pill}>
      <FlagIcon className="size-4" aria-hidden />
      {words}
    </p>
  );
});
