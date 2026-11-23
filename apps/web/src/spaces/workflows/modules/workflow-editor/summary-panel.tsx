"use client";

import {
  CircleCheckIcon,
  PencilIcon,
  PlayIcon,
  TriangleAlertIcon,
} from "lucide-react";
import type { Step, StructureResult } from "language-server/protocol";
import { useId } from "react";
import { Button } from "@/libs/ui/components/button";
import { PanelHeader } from "@/libs/ui/composites/panel-header";
import { Status, type StatusLook } from "@/libs/ui/composites/status";
import { triggerText } from "@/operations/schedule-words";
import { START, type StepMark } from "@/features/workflow-flow";
import { stepsIn } from "./steps";

interface SummaryPanelProps {
  readonly structure: StructureResult;
  readonly title: string;
  readonly status: React.ReactNode;
  readonly marks: ReadonlyMap<string, StepMark>;
  readonly tested: boolean;
  readonly onSelect: (target: string) => void;
  readonly onTest: () => void;
}

const TITLE_ID = "summary-panel-title";

const READY: StatusLook = {
  tone: "success",
  icon: CircleCheckIcon,
  label: "Ready",
};

const BY_HAND = "By hand, or when another app starts it";

export function SummaryPanel({
  structure,
  title,
  status,
  marks,
  tested,
  onSelect,
  onTest,
}: SummaryPanelProps) {
  const id = useId();
  const stepsId = `${id}-steps`;
  const steps = stepsIn(structure.workflow.steps);
  const triggers = structure.workflow.triggers;
  const starts =
    triggers.length === 0 ? BY_HAND : triggers.map(triggerText).join(" · ");

  return (
    <section
      aria-labelledby={TITLE_ID}
      className="flex min-h-0 flex-1 flex-col"
    >
      <PanelHeader title={title} titleId={TITLE_ID} subtitle={status} />
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
        <div className="flex flex-col gap-1.5">
          <h3 className="font-semibold">Starts</h3>
          <Button
            variant="outline"
            className="justify-start"
            onClick={() => {
              onSelect(START);
            }}
          >
            {starts}
          </Button>
        </div>
        <div className="flex flex-col gap-1.5">
          <h3 id={stepsId} className="font-semibold">
            Steps
          </h3>
          {steps.length === 0 ? (
            <p className="text-caption text-muted-foreground">
              No steps yet. Press + under the start to add your first step.
            </p>
          ) : (
            <ul aria-labelledby={stepsId} className="flex flex-col">
              {steps.map((step) => (
                <StepLine
                  key={step.id}
                  step={step}
                  mark={marks.get(step.id) ?? null}
                  onSelect={onSelect}
                />
              ))}
            </ul>
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          <h3 className="font-semibold">Last test run</h3>
          {tested ? (
            <p className="text-caption text-muted-foreground">
              Tested in this session; open Test run to see it.
            </p>
          ) : (
            <p className="text-caption text-muted-foreground">Not tested yet</p>
          )}
          <Button variant="outline" className="self-start" onClick={onTest}>
            <PlayIcon data-icon="inline-start" />
            Test run
          </Button>
        </div>
      </div>
    </section>
  );
}

function StepLine({
  step,
  mark,
  onSelect,
}: {
  readonly step: Step;
  readonly mark: StepMark | null;
  readonly onSelect: (target: string) => void;
}) {
  const look = lookOf(mark);

  return (
    <li>
      <button
        type="button"
        className="flex min-h-8 w-full items-center justify-between gap-2 rounded-sm px-2 py-1 text-left hover:bg-hover"
        onClick={() => {
          onSelect(step.id);
        }}
      >
        <span className="truncate">{step.name}</span>
        <Status look={look} className="text-caption" />
      </button>
    </li>
  );
}

function lookOf(mark: StepMark | null): StatusLook {
  if (mark === null) return READY;

  if (mark.kind === "fill")
    return { tone: "warning", icon: PencilIcon, label: "Fill in" };

  const count = String(mark.count);
  const label = mark.count === 1 ? "1 problem" : `${count} problems`;
  return { tone: "danger", icon: TriangleAlertIcon, label };
}
