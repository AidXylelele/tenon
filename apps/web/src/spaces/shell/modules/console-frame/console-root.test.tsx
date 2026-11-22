import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/libs/ui/components/dialog";
import { SidebarTrigger, useSidebar } from "@/libs/ui/components/sidebar";
import { fakeViewport } from "@/libs/ui/hooks/viewport.test-support";
import { ConsoleRoot } from "./console-root";

const address = vi.hoisted(() => ({ pathname: "/workflows" }));

vi.mock("next/navigation", () => ({ usePathname: () => address.pathname }));

function Sidebar() {
  const { state } = useSidebar();
  return (
    <>
      <p>{state}</p>
      <SidebarTrigger />
    </>
  );
}

function renderAt(width: number, defaultOpen: boolean | null) {
  const viewport = fakeViewport(width);
  vi.stubGlobal("matchMedia", viewport.matchMedia);
  return render(
    <ConsoleRoot defaultOpen={defaultOpen}>
      <Sidebar />
    </ConsoleRoot>,
  );
}

function rootOf(view: ReturnType<typeof render>): Element | null {
  return view.container.querySelector("[data-slot=sidebar-wrapper]");
}

function revisit(view: ReturnType<typeof render>, pathname: string) {
  address.pathname = pathname;
  view.rerender(
    <ConsoleRoot defaultOpen={null}>
      <Sidebar />
    </ConsoleRoot>,
  );
}

function toggle() {
  const trigger = screen.getByRole("button", { name: "Navigation" });
  fireEvent.click(trigger);
}

describe("the sidebar's state across the console", () => {
  beforeEach(() => {
    address.pathname = "/workflows";
    document.cookie = "sidebar_state=; max-age=0; path=/";
  });

  it.each([
    [1440, "expanded"],
    [1200, "expanded"],
    [1199, "collapsed"],
    [1024, "collapsed"],
  ])("with_no_saved_choice_at_%i_px_it_starts_%s", (width, state) => {
    renderAt(width, null);

    const shown = screen.getByText(state);
    expect(shown).toBeInTheDocument();
  });

  it.each([
    [1100, true, "expanded"],
    [1440, false, "collapsed"],
  ])("at_%i_px_the_saved_choice_%s_wins", (width, saved, state) => {
    renderAt(width, saved);

    const shown = screen.getByText(state);
    expect(shown).toBeInTheDocument();
  });

  it("a_toggle_is_kept_for_the_next_visit", () => {
    renderAt(1440, null);

    toggle();

    const shown = screen.getByText("collapsed");
    expect(shown).toBeInTheDocument();
    expect(document.cookie).toContain("sidebar_state=false");
  });

  it("the_editor_opens_with_the_sidebar_collapsed_whatever_was_chosen", () => {
    address.pathname = "/workflows/sales/route-lead/edit";

    renderAt(1440, true);

    const shown = screen.getByText("collapsed");
    expect(shown).toBeInTheDocument();
  });

  it("a_new_workflow_opens_in_the_editor_too", () => {
    address.pathname = "/workflows/new";

    renderAt(1440, null);

    const shown = screen.getByText("collapsed");
    expect(shown).toBeInTheDocument();
  });

  it("a_run_keeps_the_sidebar_as_chosen", () => {
    address.pathname = "/runs/7c41e2d0";

    renderAt(1440, null);

    const shown = screen.getByText("expanded");
    expect(shown).toBeInTheDocument();
  });

  it("in_the_editor_the_person's_toggle_wins", () => {
    address.pathname = "/workflows/sales/route-lead/edit";
    renderAt(1440, null);

    toggle();

    const shown = screen.getByText("expanded");
    expect(shown).toBeInTheDocument();
  });

  it("the_editor_opens_collapsed_again_on_the_next_visit", () => {
    address.pathname = "/workflows/sales/route-lead/edit";
    const view = renderAt(1440, null);
    toggle();

    revisit(view, "/workflows/sales/route-lead");
    revisit(view, "/workflows/sales/route-lead/edit");

    const shown = screen.getByText("collapsed");
    expect(shown).toBeInTheDocument();
  });

  it("a_toggle_in_the_editor_is_the_person's_choice_outside_it_too", () => {
    address.pathname = "/workflows/sales/route-lead/edit";
    const view = renderAt(1100, null);
    toggle();

    revisit(view, "/workflows/sales/route-lead");

    const shown = screen.getByText("expanded");
    expect(shown).toBeInTheDocument();
    expect(document.cookie).toContain("sidebar_state=true");
  });

  it("leaving_the_editor_brings_back_the_column_as_chosen", () => {
    address.pathname = "/workflows/sales/route-lead/edit";
    const view = renderAt(1440, null);

    revisit(view, "/workflows/sales/route-lead");

    const shown = screen.getByText("expanded");
    expect(shown).toBeInTheDocument();
  });
});

describe("the console behind a modal", () => {
  beforeEach(() => {
    address.pathname = "/workflows";
    const viewport = fakeViewport(1440);
    vi.stubGlobal("matchMedia", viewport.matchMedia);
  });

  function Behind({ open }: { readonly open: boolean }) {
    return (
      <>
        <ConsoleRoot defaultOpen={null}>
          <button type="button">Behind</button>
        </ConsoleRoot>
        <Dialog open={open}>
          <DialogContent aria-describedby={undefined}>
            <DialogTitle>In front</DialogTitle>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  it("is_inert_while_a_modal_is_open", async () => {
    const view = render(<Behind open={false} />);

    view.rerender(<Behind open />);
    await act(async () => {
      await Promise.resolve();
    });

    const root = rootOf(view);
    expect(root).toHaveAttribute("inert");
  });

  it("is_reachable_again_once_the_modal_closes", async () => {
    const view = render(<Behind open />);
    await act(async () => {
      await Promise.resolve();
    });

    view.rerender(<Behind open={false} />);
    await act(async () => {
      await Promise.resolve();
    });

    const root = rootOf(view);
    expect(root).not.toHaveAttribute("inert");
  });

  it("is_reachable_with_no_modal", () => {
    const view = render(<Behind open={false} />);

    const root = rootOf(view);
    expect(root).not.toHaveAttribute("inert");
  });
});
