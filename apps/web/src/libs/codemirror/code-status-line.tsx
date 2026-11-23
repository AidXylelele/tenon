import { CircleAlertIcon, CircleCheckIcon } from "lucide-react";
import type { JSX } from "react";
import { Status, type StatusLook } from "@/libs/ui/composites/status";
import type { CodeProblem, ProblemSeverity } from "./interfaces";

interface CodeStatusLineProps {
  readonly problems: readonly CodeProblem[];
  readonly note: string;
  readonly message: string;
}

type Tone = StatusLook["tone"];

const TONES: Readonly<Record<ProblemSeverity, Tone>> = {
  error: "danger",
  warning: "warning",
  info: "info",
  hint: "neutral",
};

const CLEAN: StatusLook = {
  tone: "success",
  icon: CircleCheckIcon,
  label: "No problems",
};

export function CodeStatusLine({
  problems,
  note,
  message,
}: CodeStatusLineProps): JSX.Element {
  const look = lookOf(problems);

  return (
    <div className="flex flex-wrap items-center gap-x-2 border-t px-2.5 py-1 text-caption text-muted-foreground">
      <Status look={look} className="text-caption whitespace-normal" />
      <span className="ml-auto">{note}</span>
      <p role="status" className="basis-full">
        {message}
      </p>
    </div>
  );
}

function lookOf(problems: readonly CodeProblem[]): StatusLook {
  const [first] = problems;

  if (first === undefined) return CLEAN;

  const tone = TONES[first.severity];
  const line = String(first.line);
  const label = `Line ${line}: ${first.message}`;
  return { tone, icon: CircleAlertIcon, label };
}
