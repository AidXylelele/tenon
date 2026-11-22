import type { StructureResult } from "language-server/protocol";
import { describe, expect, it } from "vitest";
import {
  type Diagnostic,
  DiagnosticSeverity,
} from "vscode-languageserver-protocol";
import { START } from "@/operations/workflow-graph";
import { flaggedSteps } from "./use-editing-session";

const structure: StructureResult = {
  version: 1,
  stale: false,
  workflow: {
    namespace: "sales",
    name: "leads",
    title: null,
    triggers: [
      {
        kind: "every",
        pointer: "/schedule/every",
        summary: "15 minutes",
        milliseconds: 900_000,
      },
      {
        kind: "cron",
        pointer: "/schedule/cron",
        summary: "0 9 * * *",
        milliseconds: null,
      },
    ],
    steps: { id: "/do", pointer: "/do", role: "sequence", steps: [] },
  },
};

const at = { line: 7, character: 0 };

function refusalAt(pointer: string): Diagnostic {
  return {
    range: { start: at, end: at },
    severity: DiagnosticSeverity.Error,
    source: "platform",
    message: "Tenon runs one trigger per workflow",
    data: { pointer },
  };
}

describe("the steps a problem flags", () => {
  it("a_refusal_at_the_schedule_flags_the_start", () => {
    const flagged = flaggedSteps(structure, [refusalAt("/schedule")]);

    expect(flagged.has(START)).toBe(true);
  });

  it("a_refusal_elsewhere_leaves_the_start_alone", () => {
    const flagged = flaggedSteps(structure, [refusalAt("/use/secrets")]);

    expect(flagged.has(START)).toBe(false);
  });
});
