import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/libs/ui/components/tooltip";
import {
  ORDER_ROUTER,
  ROUTER_STRUCTURE,
  ROUTER_VERSIONS,
} from "../../__shared_context/workflows.test-support";
import { VersionPage, type VersionPageProps } from "./version-page";

const { replace } = vi.hoisted(() => ({ replace: vi.fn() }));

vi.mock("next/navigation", async () => {
  const address = await import("@/libs/routing/navigation.test-support");
  return { ...address, useRouter: () => ({ push: vi.fn(), replace }) };
});
vi.mock("../../__shared_context/start-dialog/actions", () => ({
  startAction: vi.fn(),
}));
vi.mock("@/features/workflow-flow", () => ({
  WorkflowFlow: () => <section aria-label="The flow" />,
}));
vi.mock("@/features/code-editor", () => ({
  SourceView: ({ label }: { readonly label: string }) => (
    <section aria-label={label} />
  ),
}));

const PAGE = "/workflows/sales/order-router/versions/1.2.0";

const VERSION: VersionPageProps = {
  workflow: ORDER_ROUTER,
  version: "1.2.0",
  versions: ROUTER_VERSIONS,
  structure: ROUTER_STRUCTURE,
  file: { text: "do: []\n", kind: "YAML" },
  download: `${PAGE}/source`,
  view: "flow",
  hrefs: { flow: PAGE, code: `${PAGE}?view=code` },
  author: true,
  operator: true,
};

function show(props: Partial<VersionPageProps> = {}) {
  render(
    <TooltipProvider>
      <VersionPage {...VERSION} {...props} />
    </TooltipProvider>,
  );
}

describe("a version's page", () => {
  it("the_current_version_is_marked_and_runs_by_its_own_button", () => {
    show();

    const title = screen.getByRole("heading", { level: 1 });
    expect(title).toHaveTextContent("Version 1.2.0Current");
    expect(
      screen.getByRole("button", { name: "Run this version" }),
    ).toBeVisible();
    expect(screen.getByRole("region", { name: "The flow" })).toBeVisible();
  });

  it("an_earlier_version_is_not_marked_current", () => {
    show({ version: "1.1.0" });

    const title = screen.getByRole("heading", { level: 1 });
    expect(title).toHaveTextContent("Version 1.1.0");
    expect(title).not.toHaveTextContent("Current");
  });

  it("the_code_view_shows_the_yaml", () => {
    show({ view: "code" });

    const code = screen.getByRole("region", {
      name: "YAML of version 1.2.0",
    });
    expect(code).toBeVisible();
  });

  it("choosing_code_keeps_the_choice_in_the_address", () => {
    show();

    fireEvent.click(screen.getByRole("radio", { name: "Code" }));

    expect(replace).toHaveBeenCalledWith(`${PAGE}?view=code`, {
      scroll: false,
    });
  });

  it("download_takes_the_source_address", () => {
    show();

    fireEvent.pointerDown(
      screen.getByRole("button", { name: "More actions" }),
      { button: 0, ctrlKey: false },
    );

    expect(
      screen.getByRole("menuitem", { name: "Download YAML" }),
    ).toHaveAttribute("href", `${PAGE}/source`);
  });

  it("a_viewer_neither_edits_nor_runs", () => {
    show({ author: false, operator: false });

    expect(screen.queryByRole("link", { name: "Edit" })).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Run this version" }),
    ).toBeNull();
  });
});
