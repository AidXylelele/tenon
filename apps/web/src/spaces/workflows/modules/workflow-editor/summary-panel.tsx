"use client";

import {
  CircleCheckIcon,
  PencilIcon,
  PlayIcon,
  TriangleAlertIcon,
} from "lucide-react";
import type {
  EditAction,
  Step,
  StepList,
  StructureResult,
} from "language-server/protocol";
import { useId } from "react";
import { Button } from "@/libs/ui/components/button";
import { Field, FieldLabel } from "@/libs/ui/components/field";
import { Input } from "@/libs/ui/components/input";
import { PanelHeader } from "@/libs/ui/composites/panel-header";
import { Status, type StatusLook } from "@/libs/ui/composites/status";
import { blurOnEnter } from "./step-form";
import {
  kindLookOf,
  START,
  startCardOf,
  type StepMark,
} from "@/features/workflow-flow";

interface SummaryPanelProps {
  readonly structure: StructureResult;
  readonly title: string;
  readonly status: React.ReactNode;
  readonly marks: ReadonlyMap<string, StepMark>;
  readonly tested: boolean;
  readonly onSelect: (target: string) => void;
  readonly onTest: () => void;
  readonly onEdit: (actions: readonly EditAction[]) => void;
}

interface OutlineProps {
  readonly list: StepList;
  readonly marks: ReadonlyMap<string, StepMark>;
  readonly onSelect: (target: string) => void;
}

const TITLE_ID = "summary-panel-title";

const READY: StatusLook = {
  tone: "success",
  icon: CircleCheckIcon,
  label: "Ready",
};

const TITLE_POINTER = "/document/title";

export function SummaryPanel({
  structure,
  title,
  status,
  marks,
  tested,
  onSelect,
  onTest,
  onEdit,
}: SummaryPanelProps) {
  const id = useId();
  const stepsId = `${id}-steps`;
  const titleId = `${id}-title`;
  const root = structure.workflow.steps;
  const written = structure.workflow.title ?? "";
  const start = startCardOf(structure.workflow.triggers, null);
  const StartIcon = start.icon;

  function retitle(typed: string) {
    const value = typed.trim();

    if (value === written) return;

    const change: EditAction =
      value === ""
        ? { kind: "clearField", pointer: TITLE_POINTER }
        : { kind: "setField", pointer: TITLE_POINTER, value };
    onEdit([change]);
  }

  return (
    <section
      aria-labelledby={TITLE_ID}
      className="flex min-h-0 flex-1 flex-col"
    >
      <PanelHeader title={title} titleId={TITLE_ID} subtitle={status} />
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
        <Field>
          <FieldLabel htmlFor={titleId}>Title</FieldLabel>
          <Input
            key={written}
            id={titleId}
            defaultValue={written}
            onBlur={(event) => {
              retitle(event.currentTarget.value);
            }}
            onKeyDown={blurOnEnter}
          />
        </Field>
        <div className="flex flex-col gap-1.5">
          <h3 className="font-semibold">Starts</h3>
          <Button
            variant="outline"
            className="justify-start"
            onClick={() => {
              onSelect(START);
            }}
          >
            <StartIcon data-icon="inline-start" />
            {start.title}
          </Button>
        </div>
        <div className="flex flex-col gap-1.5">
          <h3 id={stepsId} className="font-semibold">
            Steps
          </h3>
          {root.steps.length === 0 ? (
            <p className="text-caption text-muted-foreground">
              No steps yet. Press + under the start to add your first step.
            </p>
          ) : (
            <ul aria-labelledby={stepsId} className="flex flex-col">
              <Outline list={root} marks={marks} onSelect={onSelect} />
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

function Outline({ list, marks, onSelect }: OutlineProps) {
  return list.steps.map((step) => (
    <StepLine key={step.id} step={step} marks={marks} onSelect={onSelect} />
  ));
}

function StepLine({
  step,
  marks,
  onSelect,
}: {
  readonly step: Step;
  readonly marks: ReadonlyMap<string, StepMark>;
  readonly onSelect: (target: string) => void;
}) {
  const look = lookOf(marks.get(step.id) ?? null);
  const kind = kindLookOf(step.kind);
  const Icon = kind.icon;

  return (
    <li>
      <button
        type="button"
        className="flex min-h-8 w-full items-center justify-between gap-2 rounded-sm px-2 py-1 text-left hover:bg-hover"
        onClick={() => {
          onSelect(step.id);
        }}
      >
        <span className="flex min-w-0 items-center gap-2">
          <Icon aria-hidden className="size-4 shrink-0 text-muted-foreground" />
          <span className="truncate">{step.name}</span>
        </span>
        <Status look={look} className="text-caption" />
      </button>
      {step.lists.map((inner) => (
        <ul key={inner.id} className="flex flex-col pl-4">
          <Outline list={inner} marks={marks} onSelect={onSelect} />
        </ul>
      ))}
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
