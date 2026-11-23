"use client";

import type { Diagnostic } from "vscode-languageserver-protocol";
import { PanelHeader } from "@/libs/ui/composites/panel-header";
import { Problems, type QuickFix } from "@/features/problems";

interface ProblemsPanelProps {
  readonly problems: readonly Diagnostic[];
  readonly onShow: (problem: Diagnostic) => void;
  readonly fixesFor: (problem: Diagnostic) => readonly QuickFix[];
  readonly onBack: () => void;
}

const TITLE_ID = "problems-panel-title";

export function ProblemsPanel({
  problems,
  onShow,
  fixesFor,
  onBack,
}: ProblemsPanelProps) {
  const count = problems.length;
  const counted = count === 1 ? "1 problem" : `${String(count)} problems`;

  return (
    <section
      aria-labelledby={TITLE_ID}
      className="flex min-h-0 flex-1 flex-col"
    >
      <PanelHeader
        title="Problems"
        titleId={TITLE_ID}
        subtitle={counted}
        onBack={onBack}
      />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <Problems problems={problems} onShow={onShow} fixesFor={fixesFor} />
      </div>
    </section>
  );
}
