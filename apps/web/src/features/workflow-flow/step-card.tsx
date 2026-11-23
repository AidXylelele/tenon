"use client";

import type { Step } from "language-server/protocol";
import { cn } from "@/libs/ui/tokens/cn";
import { PlusButton } from "./connector";
import { useFlow, useFlowView, useMark, useSelected } from "./context";
import { branchesOf, doneExitOf, jumpKeyOf } from "./flow";
import type { Branch, Exit, PlacedStep } from "./interfaces";
import { branchItemOf, branchPlusItemOf } from "./items";
import { cardLineOf, exitLookOf, kindLookOf } from "./looks";
import { Caption, Selectable } from "./parts";
import { StepHeader } from "./step-header";

interface BranchRowProps {
  readonly step: Step;
  readonly branch: Branch;
  readonly taken: string | null;
}

const NOT_TAKEN = "not taken";

export function StepCard({ place }: { readonly place: PlacedStep }) {
  const { kind } = useFlow();
  const { step, list } = place;
  const chosen = useSelected(step.id);
  const mark = useMark(step.id);
  const reached = useFlowView(
    (view) => view.run === null || view.run.steps.has(step.id),
  );
  const look = kindLookOf(step.kind);
  const branches = branchesOf(step, list);
  const exit = doneExitOf(step, list);
  const problem = mark?.kind === "problem";
  const label = `${look.word}: ${step.name}`;
  const line = cardLineOf(step, mark);
  const card = cn(
    "relative rounded-lg border border-(--flow-node-border) bg-surface transition-[border-color,box-shadow] duration-(--duration-fast) ease-standard hover:border-control",
    step.kind === "switch" ? "w-85" : "w-70",
    chosen &&
      "border-(--flow-selected) shadow-[inset_3px_0_0_var(--accent-solid),0_0_0_1px_var(--flow-selected)] hover:border-(--flow-selected)",
    chosen && kind !== "run" && "bg-accent-soft",
    problem && "border-2 border-danger hover:border-danger",
    !reached && "border-dashed bg-subtle text-muted-foreground",
  );

  return (
    <div className="flex flex-col">
      <Caption step={step.id} />
      <div
        data-step-box={step.id}
        role="group"
        aria-label={label}
        className={card}
      >
        <StepHeader place={place} line={line} empty={false} />
        {branches.length > 0 && <BranchList step={step} branches={branches} />}
        <Foot step={step.id} exit={exit} />
      </div>
    </div>
  );
}

export function Foot({
  step,
  exit,
}: {
  readonly step: string;
  readonly exit: Exit | null;
}) {
  if (exit === null || exit.kind === "next") return null;

  const look = exitLookOf(exit);
  const Icon = look.icon;
  const jump = jumpKeyOf(step, null);

  return (
    <p
      data-jump-source={jump}
      className="flex items-center gap-1.5 border-t px-3 py-1.5 text-caption text-muted-foreground"
    >
      <Icon className="size-3.5" aria-hidden />
      {look.words}
    </p>
  );
}

function BranchList({
  step,
  branches,
}: {
  readonly step: Step;
  readonly branches: readonly Branch[];
}) {
  const taken = useFlowView(
    (view) => view.run?.steps.get(step.id)?.branch ?? null,
  );

  return (
    <ul aria-label="Branches" className="flex flex-col gap-0.5 border-t p-1">
      {branches.map((branch) => (
        <BranchRow
          key={branch.case}
          step={step}
          branch={branch}
          taken={taken}
        />
      ))}
    </ul>
  );
}

function BranchRow({ step, branch, taken }: BranchRowProps) {
  const { onInsert } = useFlow();
  const edit = onInsert !== null;
  const chosen = taken === branch.case;
  const passed = taken !== null && !chosen;
  const look = exitLookOf(branch.exit);
  const Icon = look.icon;
  const words = passed ? NOT_TAKEN : look.words;
  const when = branch.when ?? "when no other branch matches";
  const jump = jumpKeyOf(step.id, branch.case);
  const item = branchItemOf(step.id, branch.case);
  const place = { kind: "branch", switch: step.id, case: branch.case } as const;
  const label = `Add a step on the branch ${branch.case}`;
  const plus = branchPlusItemOf(step.id, branch.case);
  const row = cn(
    "grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-md px-2 py-1.5 text-left text-caption hover:bg-hover",
    chosen && "bg-accent-soft hover:bg-accent-soft",
  );
  const name = cn(
    "font-semibold",
    passed && "font-normal text-muted-foreground",
  );
  const condition = cn(
    "truncate text-muted-foreground",
    branch.when !== null && "font-mono",
  );
  const exit = cn(
    "flex items-center gap-1 whitespace-nowrap text-muted-foreground",
    chosen && "text-accent-text",
  );

  return (
    <li
      className={cn(
        edit && "grid grid-cols-[minmax(0,1fr)_32px] items-center gap-0.5",
      )}
    >
      <Selectable
        target={step.id}
        item={item}
        marksSelection={false}
        jump={jump}
        className={row}
      >
        <span className="flex min-w-0 flex-col">
          <span className={name}>{branch.case}</span>
          <span className={condition}>{when}</span>
        </span>
        <span className={exit}>
          {!passed && <Icon className="size-3.5" aria-hidden />}
          {words}
        </span>
      </Selectable>
      {edit && <PlusButton item={plus} label={label} place={place} />}
    </li>
  );
}
