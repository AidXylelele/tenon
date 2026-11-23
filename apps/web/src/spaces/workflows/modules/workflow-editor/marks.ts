import type { StructureResult } from "language-server/protocol";
import {
  type Diagnostic,
  DiagnosticSeverity,
} from "vscode-languageserver-protocol";
import { isObject } from "@/libs/json/json";
import { diagnosticText } from "@/libs/language-client/diagnostic-text";
import type { StepMark } from "@/features/workflow-flow";
import { stepAt } from "./steps";

const NOUNS: ReadonlyMap<string, string> = new Map([
  ["endpoint", "address"],
  ["uri", "address"],
  ["in", "list"],
  ["when", "condition"],
]);

const NO_MARKS: ReadonlyMap<string, StepMark> = new Map();

export function marksOf(
  structure: StructureResult | null,
  diagnostics: readonly Diagnostic[],
  revealProblems: boolean,
): ReadonlyMap<string, StepMark> {
  if (structure === null) return NO_MARKS;

  const steps = structure.workflow.steps;
  const errors = diagnostics.filter(
    (diagnostic) => diagnostic.severity === DiagnosticSeverity.Error,
  );
  const placed = errors.flatMap((error) => {
    const step = stepAt(steps, error.range.start);
    return step === null ? [] : [{ step: step.id, error }];
  });
  const ids = new Set(placed.map((each) => each.step));
  const marks = [...ids].map((id) => {
    const own = placed.filter((each) => each.step === id);
    const errorsOfStep = own.map((each) => each.error);
    const mark = markOf(errorsOfStep, revealProblems);
    return [id, mark] as const;
  });
  return new Map(marks);
}

function markOf(
  errors: readonly Diagnostic[],
  revealProblems: boolean,
): StepMark {
  const [first] = errors;
  const missing = first === undefined ? null : missingOf(first);

  if (!revealProblems && missing !== null) return { kind: "fill", missing };

  const message = first === undefined ? "" : diagnosticText(first);
  return { kind: "problem", count: errors.length, message, missing };
}

function missingOf(diagnostic: Diagnostic): string | null {
  const data: unknown = diagnostic.data;

  if (!isObject(data) || typeof data.pointer !== "string") return null;

  const last = data.pointer.split("/").at(-1) ?? "";
  const isIndex = last === "" || /^\d+$/.test(last);

  if (isIndex) return null;

  const words = last.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase();
  return NOUNS.get(last) ?? words;
}
