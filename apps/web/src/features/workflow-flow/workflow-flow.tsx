"use client";

import { FlagIcon } from "lucide-react";
import type { StepList, Trigger } from "language-server/protocol";
import { type KeyboardEvent, useLayoutEffect, useRef } from "react";
import { FlowCanvas } from "@/libs/flow/flow-canvas";
import { useRovingFocus } from "@/libs/ui/hooks/use-roving-focus";
import { cn } from "@/libs/ui/tokens/cn";
import { Connector, Gap } from "./connector";
import { FlowContext, useFlow } from "./context";
import {
  continuesOf,
  hasStep,
  isReached,
  jumpsOf,
  lineOf,
  sourcesOf,
} from "./flow";
import { sideRoomOf } from "./geometry";
import type { Deletion, FlowState, WorkflowFlowProps } from "./interfaces";
import { END, plusItemOf, START, START_ITEM, stepItemOf } from "./items";
import { JumpLines } from "./jump-lines";
import { plusLabelOf, startLookOf } from "./looks";
import { KindTile, Selectable } from "./parts";
import { Sequence } from "./sequence";

const FIRST_STEP_HINT = "Add your first step with this +";

const KEYBOARD =
  "The arrow keys move between the steps and the + buttons; Escape clears the selection.";

export function WorkflowFlow({
  workflow,
  mode,
  selected = null,
  onSelect,
}: WorkflowFlowProps) {
  const container = useRef<HTMLDivElement>(null);
  const deletion = useRef<Deletion | null>(null);
  const preferred = selected === null ? START_ITEM : stepItemOf(selected);
  const { itemProps, onFocus, onKeyDown, focus } = useRovingFocus(
    container,
    preferred,
    workflow,
  );
  const jumps = jumpsOf(workflow.steps);
  const sources = sourcesOf(jumps);
  const state: FlowState = {
    mode,
    selected,
    onSelect,
    itemProps,
    sources,
    onDeleting,
  };
  const label = mode.kind === "run" ? "The run's flow" : "The workflow's flow";
  const still = onSelect === undefined && mode.kind !== "edit";
  const description = still ? undefined : KEYBOARD;
  const room = { paddingInline: sideRoomOf(jumps.length) };

  useLayoutEffect(() => {
    const deleted = deletion.current;

    if (deleted === null || hasStep(workflow.steps, deleted.step)) return;

    deletion.current = null;
    focus(deleted.focus);
  }, [workflow, focus]);

  function onDeleting(deleted: Deletion) {
    deletion.current = deleted;
  }

  function press(event: KeyboardEvent<HTMLElement>) {
    const target = event.target;
    const inside =
      target instanceof Node && event.currentTarget.contains(target);
    const clearing = event.key === "Escape" && !event.defaultPrevented;

    if (!inside) return;

    if (clearing) onSelect?.(null);
    else onKeyDown(event);
  }

  return (
    <FlowContext value={state}>
      <FlowCanvas label={label} description={description} focusable={still}>
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
            <TopSequence workflow={workflow} />
            <EndNode />
          </div>
        </div>
      </FlowCanvas>
    </FlowContext>
  );
}

function StartCard({ triggers }: { readonly triggers: readonly Trigger[] }) {
  const { mode, selected } = useFlow();
  const look = startLookOf(triggers);
  const words = mode.kind === "run" ? mode.start : look;
  const chosen = selected === START;
  const label = `Start: ${words.title}`;
  const card = cn(
    "w-70 rounded-lg border border-(--flow-node-border) bg-surface transition-[border-color,box-shadow] duration-(--duration-fast) ease-standard",
    chosen &&
      "border-(--flow-selected) bg-accent-soft shadow-[inset_3px_0_0_var(--accent-solid),0_0_0_1px_var(--flow-selected)]",
  );
  const content = (
    <>
      <KindTile icon={look.icon} start />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="font-semibold">{words.title}</span>
        <span className="text-caption text-muted-foreground">
          {words.detail}
        </span>
      </span>
    </>
  );
  const row =
    "flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left";

  return (
    <div role="group" aria-label={label} className={card}>
      {mode.kind === "run" ? (
        <div className={row}>{content}</div>
      ) : (
        <Selectable target={START} className={row}>
          {content}
        </Selectable>
      )}
    </div>
  );
}

function TopSequence({ workflow }: Pick<WorkflowFlowProps, "workflow">) {
  const { mode } = useFlow();
  const list = workflow.steps;
  const first = list.steps[0];
  const edit = mode.kind === "edit";
  const below = first?.id ?? END;
  const line = lineOf(mode, START, below);
  const firstName = first?.name ?? null;
  const label = plusLabelOf(null, null, firstName);
  const place = { kind: "list", list: list.id, index: 0, above: null } as const;
  const item = plusItemOf(list.id, 0);
  const plus = edit ? { item, label, place } : null;
  const fresh = edit && first === undefined;
  const firstHint = fresh ? FIRST_STEP_HINT : undefined;

  return (
    <>
      <Connector line={line} plus={plus} hint={firstHint} />
      <Sequence list={list} owner={null} />
      <Closing list={list} />
    </>
  );
}

function Closing({ list }: { readonly list: StepList }) {
  const { mode } = useFlow();
  const last = list.steps.at(-1);

  if (last === undefined) return null;

  if (!continuesOf(last)) return <Gap />;

  const count = list.steps.length;
  const line = lineOf(mode, last.id, END);
  const label = plusLabelOf(null, last.name, null);
  const item = plusItemOf(list.id, count);
  const place = {
    kind: "list",
    list: list.id,
    index: count,
    above: last.name,
  } as const;
  const plus = mode.kind === "edit" ? { item, label, place } : null;

  return <Connector line={line} plus={plus} />;
}

function EndNode() {
  const { mode } = useFlow();
  const reached = mode.kind !== "run" || isReached(mode, END);
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
}
