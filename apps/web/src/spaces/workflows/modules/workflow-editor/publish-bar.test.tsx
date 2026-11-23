import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Diagnostic } from "vscode-languageserver-protocol";
import type { Version } from "@/libs/data-access/types";
import type { WorkflowSession } from "@/operations/workflow-language";
import { PublishBar } from "./publish-bar";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

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

const PUBLISHING = {
  title: "Daily digest",
  startsByItself: true,
  tested: false,
  ready: false,
  onTest: vi.fn(),
  changesOf: () => Promise.resolve({ kind: "read" as const, changes: [] }),
  setVersion: () => Promise.resolve(),
  turnOn: () => Promise.resolve({ ok: true as const, value: undefined }),
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
        onShowProblems={vi.fn()}
        {...PUBLISHING}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Publish" }));
    fireEvent.click(
      await screen.findByRole("button", { name: /^Publish 1\.0\.0/ }),
    );

    await waitFor(() => {
      expect(onPlatformProblems).toHaveBeenCalled();
    });
    const placed = onPlatformProblems.mock.calls[0]?.[0] ?? [];
    expect(placed.map((problem) => problem.range.start)).toEqual([
      { line: 3, character: 6 },
      POINTED.start,
    ]);
  });

  it("publishing_with_problems_shows_them_instead", () => {
    const session = {} as unknown as WorkflowSession;
    const publish = vi.fn(() => Promise.resolve({ kind: "held" as const }));
    const onShowProblems = vi.fn();
    render(
      <PublishBar
        session={session}
        problems={2}
        onPlatformProblems={vi.fn()}
        publish={publish}
        onPublished={() => Promise.resolve()}
        currentVersion={null}
        onUseVersion={vi.fn()}
        onShowProblems={onShowProblems}
        {...PUBLISHING}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Publish" }));

    expect(onShowProblems).toHaveBeenCalled();
    expect(publish).not.toHaveBeenCalled();
  });

  it("a_later_version_is_chosen_by_what_changed_and_turned_on", async () => {
    const session = {
      document: () =>
        Promise.resolve({
          kind: "document",
          version: 3,
          document: { document: { version: "1.0.1" } },
        }),
    } as unknown as WorkflowSession;
    const version = {
      namespace: "sales",
      name: "digest",
      version: "1.1.0",
    } as unknown as Version;
    const setVersion = vi.fn(() => Promise.resolve());
    const turnOn = vi.fn(() =>
      Promise.resolve({ ok: true as const, value: undefined }),
    );
    const changes = [
      { id: "/do/2/Post the items", name: "Post the items", kind: "changed" },
    ] as const;
    render(
      <PublishBar
        session={session}
        problems={0}
        onPlatformProblems={vi.fn()}
        publish={() => Promise.resolve({ kind: "published", version })}
        onPublished={() => Promise.resolve()}
        currentVersion="1.0.0"
        onUseVersion={vi.fn()}
        onShowProblems={vi.fn()}
        {...PUBLISHING}
        tested
        changesOf={() => Promise.resolve({ kind: "read", changes })}
        setVersion={setVersion}
        turnOn={turnOn}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Publish" }));
    const changed = await screen.findByText("Post the items — changed");
    const untested = screen.queryByText("Not tested since your last change");
    fireEvent.click(screen.getByRole("radio", { name: /A new feature/ }));
    fireEvent.click(
      screen.getByRole("button", { name: "Publish 1.1.0 and turn on" }),
    );

    await waitFor(() => {
      expect(turnOn).toHaveBeenCalled();
    });
    expect(changed).toHaveTextContent("Post the items — changed");
    expect(setVersion).toHaveBeenCalledWith("1.1.0");
    expect(untested).toBeNull();
  });

  it("what_changed_that_cannot_be_read_says_so_and_publishing_stays", async () => {
    const session = {
      document: () =>
        Promise.resolve({
          kind: "document",
          version: 3,
          document: { document: { version: "1.0.1" } },
        }),
    } as unknown as WorkflowSession;
    render(
      <PublishBar
        session={session}
        problems={0}
        onPlatformProblems={vi.fn()}
        publish={vi.fn()}
        onPublished={() => Promise.resolve()}
        currentVersion="1.0.0"
        onUseVersion={vi.fn()}
        onShowProblems={vi.fn()}
        {...PUBLISHING}
        changesOf={() => Promise.resolve({ kind: "unread" })}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Publish" }));
    const unread = await screen.findByText(
      "What changed could not be read; you can still publish.",
    );

    expect(unread).toBeVisible();
    expect(
      screen.getByRole("button", { name: /^Publish 1\.0\.1/ }),
    ).toBeEnabled();
  });

  it.each([
    [false, "outline"],
    [true, "default"],
  ])("publish_is_primary_only_once_ready_%s", (ready, variant) => {
    const session = {} as unknown as WorkflowSession;
    render(
      <PublishBar
        session={session}
        problems={0}
        onPlatformProblems={vi.fn()}
        publish={vi.fn()}
        onPublished={() => Promise.resolve()}
        currentVersion={null}
        onUseVersion={vi.fn()}
        onShowProblems={vi.fn()}
        {...PUBLISHING}
        ready={ready}
      />,
    );

    const publish = screen.getByRole("button", { name: "Publish" });

    expect(publish).toHaveAttribute("data-variant", variant);
  });
});
