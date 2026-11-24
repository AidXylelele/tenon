"use client";

import {
  CircleCheckIcon,
  CircleXIcon,
  InfoIcon,
  TriangleAlertIcon,
  WandSparklesIcon,
} from "lucide-react";
import {
  type Diagnostic,
  DiagnosticSeverity,
} from "vscode-languageserver-protocol";
import { diagnosticText } from "@/libs/language-client/diagnostic-text";
import { Button } from "@/libs/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/libs/ui/components/dropdown-menu";
import { Status, type StatusLook } from "@/libs/ui/composites/status";
import type { ProblemsProps, QuickFix } from "./interfaces";

const ERROR: StatusLook = { tone: "danger", icon: CircleXIcon, label: "Error" };
const WARNING: StatusLook = {
  tone: "warning",
  icon: TriangleAlertIcon,
  label: "Warning",
};
const INFORMATION: StatusLook = { tone: "info", icon: InfoIcon, label: "Info" };

export function Problems({ problems, onShow, fixesFor }: ProblemsProps) {
  if (problems.length === 0)
    return (
      <p className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground">
        <CircleCheckIcon className="size-4 text-success" aria-hidden />
        No problems.
      </p>
    );

  return (
    <ol className="flex flex-col divide-y" aria-label="Problems">
      {problems.map((problem, index) => (
        <ProblemRow
          key={`${String(index)}:${keyOf(problem)}`}
          problem={problem}
          onShow={onShow}
          fixesFor={fixesFor}
        />
      ))}
    </ol>
  );
}

function ProblemRow({
  problem,
  onShow,
  fixesFor,
}: {
  readonly problem: Diagnostic;
  readonly onShow: (problem: Diagnostic) => void;
  readonly fixesFor: ProblemsProps["fixesFor"];
}) {
  const look = lookOf(problem);
  const message = diagnosticText(problem);
  const line = `Line ${String(problem.range.start.line + 1)}`;
  const fixes = fixesFor(problem);

  return (
    <li className="flex min-h-7 items-center gap-3 px-3 py-1">
      <button
        type="button"
        onClick={() => {
          onShow(problem);
        }}
        className="flex min-w-0 flex-1 items-center gap-3 rounded-md text-left text-sm hover:bg-muted"
      >
        <Status look={look} className="w-24 shrink-0" />
        <span className="min-w-0 flex-1 truncate">{message}</span>
        <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
          {line}
        </span>
      </button>
      {fixes.length > 0 && <Fixes fixes={fixes} />}
    </li>
  );
}

function Fixes({ fixes }: { readonly fixes: readonly QuickFix[] }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="xs">
          <WandSparklesIcon data-icon="inline-start" />
          Quick fix
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        {fixes.map((fix) => (
          <DropdownMenuItem key={fix.title} onSelect={fix.apply}>
            {fix.title}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function lookOf(problem: Diagnostic): StatusLook {
  if (problem.severity === DiagnosticSeverity.Warning) return WARNING;

  const quiet =
    problem.severity === DiagnosticSeverity.Information ||
    problem.severity === DiagnosticSeverity.Hint;

  if (quiet) return INFORMATION;

  return ERROR;
}

function keyOf(problem: Diagnostic): string {
  const start = problem.range.start;
  const at = `${String(start.line)}:${String(start.character)}`;
  const message = diagnosticText(problem);
  return `${at}:${message}`;
}
