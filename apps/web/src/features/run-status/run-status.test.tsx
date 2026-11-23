import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { Phase, TaskStatus } from "@/libs/data-access/types";
import { PhaseStatus, TaskStatusOf } from "./run-status";

describe("a run's status", () => {
  it.each<[Phase, string]>([
    ["pending", "Queued"],
    ["running", "Running"],
    ["waiting", "Waiting"],
    ["suspended", "Paused"],
    ["completed", "Succeeded"],
    ["faulted", "Failed"],
    ["cancelled", "Cancelled"],
  ])("%s_reads_%s", (phase, word) => {
    render(<PhaseStatus phase={phase} />);

    expect(screen.getByText(word)).toBeInTheDocument();
  });
});

describe("a step's status", () => {
  it.each<[TaskStatus, string]>([
    ["running", "Running"],
    ["completed", "Succeeded"],
    ["faulted", "Failed"],
    ["cancelled", "Cancelled"],
    ["skipped", "Skipped"],
  ])("%s_reads_%s", (status, word) => {
    render(<TaskStatusOf status={status} />);

    expect(screen.getByText(word)).toBeInTheDocument();
  });
});
