import { act, fireEvent, render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/libs/ui/components/dialog";
import { SidebarTrigger, useSidebar } from "@/libs/ui/components/sidebar";
import { fakeViewport } from "@/libs/ui/hooks/viewport.test-support";
import { ConsoleRoot } from "./console-root";
import type { Viewport } from "./viewport";

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
    <ConsoleRoot defaultOpen={defaultOpen} lastViewport={null}>
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
    <ConsoleRoot defaultOpen={null} lastViewport={null}>
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

describe("the sidebar drawn by the server before the page runs", () => {
  beforeEach(() => {
    address.pathname = "/workflows";
    document.cookie = "viewport=; max-age=0; path=/";
  });

  function consoleWith(
    defaultOpen: boolean | null,
    lastViewport: Viewport | null,
  ) {
    return (
      <ConsoleRoot defaultOpen={defaultOpen} lastViewport={lastViewport}>
        <Sidebar />
      </ConsoleRoot>
    );
  }

  function hydrateAt(width: number, root: React.ReactElement) {
    const viewport = fakeViewport(width);
    vi.stubGlobal("matchMedia", viewport.matchMedia);
    const html = renderToString(root);
    const container = document.createElement("div");
    container.innerHTML = html;
    document.body.append(container);
    const drawn = container.querySelector("p")?.textContent;
    render(root, { container, hydrate: true });
    return { drawn, viewport };
  }

  it.each<[Viewport | null, string]>([
    ["narrow", "collapsed"],
    ["wide", "expanded"],
    [null, "expanded"],
  ])("a_last_viewport_of_%s_draws_it_%s", (lastViewport, state) => {
    const root = consoleWith(null, lastViewport);

    const html = renderToString(root);

    expect(html).toContain(state);
  });

  it("a_saved_choice_wins_over_the_last_viewport", () => {
    const root = consoleWith(true, "narrow");

    const html = renderToString(root);

    expect(html).toContain("expanded");
  });

  it("a_reload_at_1100_px_after_a_first_visit_keeps_the_icons_without_a_shift", () => {
    const root = consoleWith(null, "narrow");

    const { drawn } = hydrateAt(1100, root);

    const shown = screen.getByText("collapsed");
    expect(drawn).toBe("collapsed");
    expect(shown).toBeInTheDocument();
  });

  it("a_first_visit_at_1100_px_is_drawn_wide_and_then_collapses", () => {
    const root = consoleWith(null, null);

    const { drawn } = hydrateAt(1100, root);

    const shown = screen.getByText("collapsed");
    expect(drawn).toBe("expanded");
    expect(shown).toBeInTheDocument();
  });

  it("the_viewport_is_told_to_the_server_and_again_across_1200_px", () => {
    const root = consoleWith(null, null);
    const { viewport } = hydrateAt(1100, root);
    const told = document.cookie;

    act(() => {
      viewport.resize(1300);
    });

    expect(told).toContain("viewport=narrow");
    expect(document.cookie).toContain("viewport=wide");
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
        <ConsoleRoot defaultOpen={null} lastViewport={null}>
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
