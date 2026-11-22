import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Diagnostic } from "vscode-languageserver-protocol";
import type { WorkflowSession } from "@/operations/workflow-language";
import { PublishBar } from "./publish-bar";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("./actions", () => ({ checkAction: vi.fn() }));

const POINTED = {
  start: { line: 15, character: 8 },
  end: { line: 15, character: 30 },
};

const refusal = {
  type: "urn:problem:definition.invalid",
  title: "Invalid",
  status: 422,
  detail: "The workflow does not pass the platform.",
  errors: [
    { pointer: "/do/0/fetch", detail: "Placed by line.", line: 4, column: 7 },
    {
      pointer: "/do/1/notify",
      detail: "Placed by pointer.",
      line: null,
      column: null,
    },
  ],
  retryAfter: null,
};

describe("the publish bar", () => {
  it("places_each_refusal_by_its_line_or_else_by_its_pointer", async () => {
    const session = {
      document: () =>
        Promise.resolve({ kind: "document", version: 3, document: {} }),
      rangesOf: () => Promise.resolve({ version: 3, ranges: [null, POINTED] }),
    } as unknown as WorkflowSession;
    const onPlatformProblems =
      vi.fn<(problems: readonly Diagnostic[]) => void>();
    render(
      <PublishBar
        session={session}
        problems={0}
        onPlatformProblems={onPlatformProblems}
        publish={() => Promise.resolve({ kind: "refused", problem: refusal })}
        onPublished={() => Promise.resolve()}
        currentVersion={null}
        onUseVersion={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Publish" }));

    await waitFor(() => {
      expect(onPlatformProblems).toHaveBeenCalled();
    });
    const placed = onPlatformProblems.mock.calls[0]?.[0] ?? [];
    expect(placed.map((problem) => problem.range.start)).toEqual([
      { line: 3, character: 6 },
      POINTED.start,
    ]);
  });
});
