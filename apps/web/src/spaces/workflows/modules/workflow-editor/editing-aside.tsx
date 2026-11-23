"use client";

import type { Step, StepVariant } from "language-server/protocol";
import type { ReactNode } from "react";
import type { Diagnostic } from "vscode-languageserver-protocol";
import type { JsonValue } from "@/libs/json/json";
import { PanelHeader } from "@/libs/ui/composites/panel-header";
import type { QuickFix } from "@/features/problems";
import {
  type InsertPlace,
  placeOf,
  START,
  type StepMark,
} from "@/features/workflow-flow";
import type { SlotSources } from "./form-slots";
import type { Aside, EditingSession, Starts, WorkflowName } from "./interfaces";
import { ProblemsPanel } from "./problems-panel";
import { StartPanel } from "./start-panel";
import { type EntryAction, StepCatalog } from "./step-catalog";
import type { Webhook } from "./step-form";
import { StepPanel } from "./step-panel";
import { SummaryPanel } from "./summary-panel";
import { TestRunPanel } from "./test-run-panel";
import type { TestRunState } from "./use-test-run";

interface TestControls {
  readonly state: TestRunState;
  readonly lost: boolean;
  readonly reset: () => void;
  readonly readAgain: () => void;
}

interface EditingAsideProps {
  readonly aside: Aside;
  readonly editing: EditingSession;
  readonly name: WorkflowName;
  readonly webhooks: readonly Webhook[];
  readonly starts: Starts | null;
  readonly title: string;
  readonly status: ReactNode;
  readonly marks: ReadonlyMap<string, StepMark>;
  readonly steps: readonly Step[];
  readonly problems: readonly Diagnostic[];
  readonly test: TestControls;
  readonly revealProblems: boolean;
  readonly languageTerms: boolean;
  readonly sources: SlotSources;
  readonly fixesFor: (problem: Diagnostic) => readonly QuickFix[];
  readonly onLanguageTerms: (shown: boolean) => void;
  readonly onChoose: (place: InsertPlace, action: EntryAction) => void;
  readonly onRemove: (step: string) => void;
  readonly onRun: (input: JsonValue) => void;
  readonly onShowProblem: (problem: Diagnostic) => void;
  readonly onSelect: (target: string | null) => void;
  readonly onTest: () => void;
  readonly onForm: () => void;
}

export function EditingAside(props: EditingAsideProps) {
  return (
    <aside className="flex size-full min-h-0 flex-col border-l bg-surface max-lg:border-t max-lg:border-l-0">
      <AsideContent {...props} />
    </aside>
  );
}

function AsideContent({
  aside,
  editing,
  name,
  webhooks,
  starts,
  title,
  status,
  marks,
  steps,
  problems,
  test,
  revealProblems,
  languageTerms,
  sources,
  fixesFor,
  onLanguageTerms,
  onChoose,
  onRemove,
  onRun,
  onShowProblem,
  onSelect,
  onTest,
  onForm,
}: EditingAsideProps) {
  const { structure, selected, selectedId } = editing;

  function close() {
    onSelect(null);
  }

  if (aside.kind === "catalog")
    return (
      <CatalogAside
        place={aside.place}
        root={structure?.workflow.steps.id ?? ""}
        variants={editing.variants}
        languageTerms={languageTerms}
        onChoose={(action) => {
          onChoose(aside.place, action);
        }}
        onClose={onForm}
      />
    );

  if (aside.kind === "test")
    return (
      <TestRunPanel
        state={test.state}
        lost={test.lost}
        steps={steps}
        onRun={onRun}
        onAgain={test.reset}
        onReadAgain={test.readAgain}
        onBack={onForm}
      />
    );

  if (aside.kind === "problems")
    return (
      <ProblemsPanel
        problems={problems}
        onShow={onShowProblem}
        fixesFor={fixesFor}
        onBack={onForm}
      />
    );

  if (selectedId === START)
    return (
      <StartPanel
        name={name}
        form={editing.startForm}
        formless={editing.startFormless}
        webhooks={webhooks}
        starts={starts}
        revealProblems={revealProblems}
        languageTerms={languageTerms}
        onEdit={sources.onEdit}
        onClose={close}
      />
    );

  if (structure === null) return null;

  if (selected !== null)
    return (
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
        onLanguageTerms={onLanguageTerms}
        onRemove={onRemove}
        onClose={close}
      />
    );

  if (selectedId !== null) return null;

  return (
    <SummaryPanel
      structure={structure}
      title={title}
      status={status}
      marks={marks}
      tested={test.state.kind === "ran"}
      onSelect={onSelect}
      onTest={onTest}
    />
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
