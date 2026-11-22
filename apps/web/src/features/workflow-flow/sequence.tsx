"use client";

import { ChevronLeftIcon, ChevronRightIcon, RotateCwIcon } from "lucide-react";
import type { NestedList, Step, StepList } from "language-server/protocol";
import { Fragment } from "react";
import { Button } from "@/libs/ui/components/button";
import { IconButton } from "@/libs/ui/composites/icon-button";
import { cn } from "@/libs/ui/tokens/cn";
import {
  ACROSS,
  Connector,
  DOWN,
  EndPlus,
  Gap,
  Placeholder,
} from "./connector";
import { useFlow } from "./context";
import {
  continuesOf,
  doneExitOf,
  isEmptyBlock,
  isReached,
  lineOf,
} from "./flow";
import type { StepPlace } from "./interfaces";
import { iterationItemOf, plusItemOf } from "./items";
import { blockLineOf, kindLookOf, laneOf, plusLabelOf } from "./looks";
import { Caption } from "./parts";
import { Foot, StepCard } from "./step-card";
import { StepHeader } from "./step-header";

interface SequenceProps {
  readonly list: StepList;
  readonly owner: string | null;
}

interface NestedStepsProps {
  readonly list: NestedList;
  readonly owner: string;
}

interface ForkColumnProps {
  readonly fork: Step;
  readonly branches: NestedList;
  readonly index: number;
}

const FOR_EACH_EVENT = "For each event";

export function Sequence({ list, owner }: SequenceProps) {
  return (
    <div data-list={list.id} className="flex flex-col items-center">
      {list.steps.map((step, index) => (
        <Fragment key={step.id}>
          {index > 0 && <Between list={list} index={index} owner={owner} />}
          <StepItem place={{ step, list, index }} />
        </Fragment>
      ))}
    </div>
  );
}

function Between({
  list,
  index,
  owner,
}: {
  readonly list: StepList;
  readonly index: number;
  readonly owner: string | null;
}) {
  const { mode } = useFlow();
  const before = list.steps[index - 1];
  const step = list.steps[index];

  if (before === undefined || step === undefined) return null;

  if (!continuesOf(before)) return <Gap />;

  const line = lineOf(mode, before.id, step.id);
  const label = plusLabelOf(owner, before.name, step.name);
  const item = plusItemOf(list.id, index);
  const place = {
    kind: "list",
    list: list.id,
    index,
    above: before.name,
  } as const;
  const plus = mode.kind === "edit" ? { item, label, place } : null;

  return <Connector line={line} plus={plus} />;
}

function StepItem({ place }: { readonly place: StepPlace }) {
  if (place.step.lists.length === 0) return <StepCard place={place} />;

  return <Block place={place} />;
}

function NestedSteps({ list, owner }: NestedStepsProps) {
  const { mode } = useFlow();
  const count = list.steps.length;
  const last = list.steps.at(-1)?.name ?? null;
  const label = plusLabelOf(owner, last, null);
  const item = plusItemOf(list.id, count);
  const place = {
    kind: "list",
    list: list.id,
    index: count,
    above: last,
  } as const;

  return (
    <>
      {count === 0 ? <Placeholder /> : <Sequence list={list} owner={owner} />}
      {mode.kind === "edit" && (
        <EndPlus item={item} label={label} place={place} />
      )}
    </>
  );
}

function Block({ place }: { readonly place: StepPlace }) {
  const { mode, selected } = useFlow();
  const { step, list } = place;
  const look = kindLookOf(step.kind);
  const empty = mode.kind === "edit" && isEmptyBlock(step);
  const reached = mode.kind !== "run" || isReached(mode, step.id);
  const exit = doneExitOf(step, list);
  const chosen = selected === step.id;
  const label = `${look.word}: ${step.name}`;
  const line = blockLineOf(step);
  const frame = cn(
    "flex min-w-78 flex-col rounded-[10px] border border-control transition-[border-color,box-shadow] duration-(--duration-fast) ease-standard",
    chosen &&
      "border-(--flow-selected) shadow-[0_0_0_1px_var(--flow-selected)]",
    empty && "border-danger",
    !reached && "border-dashed",
  );
  const head = "rounded-t-[10px] bg-surface [contain:inline-size]";
  const fork = step.kind === "fork";
  const inside = cn(
    "flex flex-col items-center rounded-b-[10px] bg-canvas px-4 pb-4",
    !fork && "pt-3",
  );

  return (
    <div className="flex flex-col">
      <Caption step={step.id} />
      <div
        data-step-box={step.id}
        role="group"
        aria-label={label}
        className={frame}
      >
        <StepHeader place={place} line={line} empty={empty} className={head} />
        <IterationBar step={step} />
        <div role="group" aria-label={`Inside ${step.name}`} className={inside}>
          <BlockInside place={place} />
        </div>
        <Foot step={step.id} exit={exit} />
      </div>
    </div>
  );
}

function BlockInside({ place }: { readonly place: StepPlace }) {
  const { step } = place;

  if (step.kind === "fork") return <ForkInside fork={step} />;

  if (step.kind === "try") return <TryInside place={place} />;

  return step.lists.map((list) => (
    <Fragment key={list.id}>
      {list.part === "foreach" && <BlockLabel words={FOR_EACH_EVENT} />}
      <NestedSteps list={list} owner={step.name} />
    </Fragment>
  ));
}

function BlockLabel({
  words,
  className,
}: {
  readonly words: string;
  readonly className?: string;
}) {
  const classes = cn(
    "self-start pb-1.5 text-caption font-semibold text-muted-foreground",
    className,
  );

  return <p className={classes}>{words}</p>;
}

function ForkInside({ fork }: { readonly fork: Step }) {
  const { mode } = useFlow();
  const branches = fork.lists.find((list) => list.role === "branches");
  const line = lineOf(mode, fork.id, fork.id);
  const stub = cn("h-4 w-0", DOWN[line]);

  if (branches === undefined || branches.steps.length === 0)
    return <Placeholder />;

  return (
    <>
      <span className={stub} aria-hidden />
      <div className="flex">
        {branches.steps.map((branch, index) => (
          <ForkColumn
            key={branch.id}
            fork={fork}
            branches={branches}
            index={index}
          />
        ))}
      </div>
      <span className={stub} aria-hidden />
    </>
  );
}

function ForkColumn({ fork, branches, index }: ForkColumnProps) {
  const { mode } = useFlow();
  const branch = branches.steps[index];

  if (branch === undefined) return null;

  const count = branches.steps.length;
  const held = branch.kind === "do" ? branch.lists[0] : undefined;
  const first = held?.steps[0]?.id ?? branch.id;
  const line = lineOf(mode, fork.id, first);
  const owner = `${fork.name} · ${branch.name}`;
  const across = cn(
    "absolute h-0",
    ACROSS[line],
    index === 0 ? "left-1/2" : "left-0",
    index === count - 1 ? "right-1/2" : "right-0",
  );
  const join = count > 1;

  return (
    <div
      role="group"
      aria-label={`Branch ${branch.name}`}
      className="relative flex flex-col items-center px-3"
    >
      {join && <span className={cn(across, "top-0")} aria-hidden />}
      <span className={cn("h-4 w-0", DOWN[line])} aria-hidden />
      <span className="pb-2 text-caption font-semibold text-muted-foreground">
        {branch.name}
      </span>
      {held === undefined ? (
        <StepItem place={{ step: branch, list: branches, index }} />
      ) : (
        <NestedSteps list={held} owner={owner} />
      )}
      <span className={cn("min-h-4 w-0 flex-1", DOWN[line])} aria-hidden />
      {join && <span className={cn(across, "bottom-0")} aria-hidden />}
    </div>
  );
}

function TryInside({ place }: { readonly place: StepPlace }) {
  const { step, list } = place;
  const body = step.lists.find((each) => each.part === "try");
  const handler = step.lists.find((each) => each.part === "catch");
  const lane = laneOf(step, list);
  const said = lane.note !== null || lane.then !== null;
  const joined = lane.note !== null && lane.then !== null;

  return (
    <>
      <BlockLabel words="Try these steps" />
      {body !== undefined && <NestedSteps list={body} owner={step.name} />}
      <BlockLabel words="If it fails" className="mt-6 text-warning-strong" />
      <div
        role="group"
        aria-label={`If ${step.name} fails`}
        className="flex w-full flex-col items-center rounded-lg border border-dashed border-warning p-3"
      >
        {said && (
          <p className="flex items-start gap-1.5 self-stretch pb-3 text-caption">
            <RotateCwIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            <span>
              {lane.note}
              {joined && ". "}
              {lane.then !== null && (
                <>
                  <b className="font-semibold">Then:</b> {lane.then}
                </>
              )}
            </span>
          </p>
        )}
        {handler !== undefined && (
          <NestedSteps list={handler} owner={`${step.name} · if it fails`} />
        )}
      </div>
    </>
  );
}

function IterationBar({ step }: { readonly step: Step }) {
  const { mode, itemProps } = useFlow();

  if (mode.kind !== "run") return null;

  const iteration = mode.steps.get(step.id)?.iteration;

  if (iteration === undefined) return null;

  const { onIteration } = mode;
  const { shown, count } = iteration;
  const first = shown <= 1;
  const last = shown >= count;

  function show(to: number, allowed: boolean) {
    if (allowed) onIteration(step.id, to);
  }

  return (
    <div
      role="group"
      aria-label="Iteration"
      className="flex items-center gap-1 bg-surface px-3 pb-2 text-caption text-muted-foreground [contain:inline-size]"
    >
      <span>Iteration</span>
      <IconButton
        label="Previous iteration"
        icon={ChevronLeftIcon}
        variant="outline"
        size="icon-xs"
        {...itemProps(iterationItemOf(step.id, "previous"))}
        aria-disabled={first}
        onClick={() => {
          show(shown - 1, !first);
        }}
      />
      <span aria-live="polite" className="tabular-nums">
        <b className="font-semibold text-foreground">{shown}</b> of {count}
      </span>
      <IconButton
        label="Next iteration"
        icon={ChevronRightIcon}
        variant="outline"
        size="icon-xs"
        {...itemProps(iterationItemOf(step.id, "next"))}
        aria-disabled={last}
        onClick={() => {
          show(shown + 1, !last);
        }}
      />
      <Button
        variant="outline"
        size="xs"
        {...itemProps(iterationItemOf(step.id, "last"))}
        aria-label="Last iteration"
        aria-disabled={last}
        onClick={() => {
          show(count, !last);
        }}
      >
        Last
      </Button>
    </div>
  );
}
