import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Capabilities } from "@/libs/data-access/types";
import { TooltipProvider } from "@/libs/ui/components/tooltip";
import { fakeViewport } from "@/libs/ui/hooks/viewport.test-support";
import { ConsoleRoot } from "./console-root";
import { ConsoleSidebar, SidebarLoading } from "./console-sidebar";
import { Frame } from "./frame";

const address = vi.hoisted(() => ({ pathname: "/workflows" }));

vi.mock("next/navigation", () => ({
  usePathname: () => address.pathname,
  useRouter: () => ({ push: vi.fn(), prefetch: vi.fn() }),
}));

const EDITOR: Capabilities = {
  author: true,
  operator: true,
  administrator: false,
};
const VIEWER: Capabilities = {
  author: false,
  operator: false,
  administrator: false,
};

function FrameAt({ capabilities }: { readonly capabilities: Capabilities }) {
  const inProgress = capabilities.author ? 10 : 0;
  return (
    <TooltipProvider>
      <ConsoleRoot defaultOpen={null} lastViewport={null}>
        <Frame
          sidebar={
            <ConsoleSidebar
              capabilities={capabilities}
              inProgress={inProgress}
              account={<p>Account</p>}
            />
          }
          search={<button type="button">Search</button>}
          notice={null}
        >
          <button type="button">Run</button>
        </Frame>
      </ConsoleRoot>
    </TooltipProvider>
  );
}

function renderFrame(width: number, capabilities: Capabilities) {
  const viewport = fakeViewport(width);
  vi.stubGlobal("matchMedia", viewport.matchMedia);
  return render(<FrameAt capabilities={capabilities} />);
}

function linkNames(region: HTMLElement): string[] {
  return within(region)
    .getAllByRole("link")
    .map((link) => link.textContent);
}

describe("the console frame", () => {
  beforeEach(() => {
    address.pathname = "/workflows/sales/route-lead/versions/1.2.0";
  });

  it("the_skip_link_leads_to_the_content", () => {
    renderFrame(1440, EDITOR);

    const skip = screen.getByRole("link", { name: "Skip to content" });
    const content = screen.getByRole("main");

    expect(skip).toHaveAttribute("href", "#content");
    expect(content).toHaveAttribute("id", "content");
  });

  it("the_top_bar_shows_the_way_back_with_the_page_last", () => {
    renderFrame(1440, EDITOR);

    const trail = screen.getByRole("navigation", { name: "Breadcrumb" });
    const names = linkNames(trail);
    const here = within(trail).getByRole("link", { current: "page" });

    expect(names).toEqual(["Workflows", "route-lead", "Version 1.2.0"]);
    expect(here).toHaveTextContent("Version 1.2.0");
    expect(here).not.toHaveAttribute("href");
  });

  it("an_address_outside_the_places_shows_no_breadcrumb", () => {
    address.pathname = "/connections";

    renderFrame(1440, EDITOR);

    const trail = screen.queryByRole("navigation", { name: "Breadcrumb" });
    expect(trail).not.toBeInTheDocument();
  });

  it("an_editor_sees_seven_places_with_the_current_one_marked", () => {
    renderFrame(1440, EDITOR);

    const main = screen.getByRole("navigation", { name: "Main" });
    const current = within(main).getByRole("link", { current: "page" });
    const names = linkNames(main);

    expect(names).toEqual([
      "Tenon",
      "Home",
      "Workflows",
      "Runs, 10 runs in progress now",
      "Webhooks",
      "Notifications",
      "Secrets",
      "Settings",
    ]);
    expect(current).toHaveTextContent("Workflows");
  });

  it("the_places_to_connect_are_a_group_named_connect", () => {
    renderFrame(1440, EDITOR);

    const connect = screen.getByRole("group", { name: "Connect" });
    const names = linkNames(connect);

    expect(names).toEqual(["Webhooks", "Notifications", "Secrets"]);
  });

  it("runs_say_how_many_are_in_progress_now", () => {
    renderFrame(1440, EDITOR);

    const runs = screen.getByRole("link", { name: /^Runs/ });

    expect(runs).toHaveAccessibleName("Runs, 10 runs in progress now");
  });

  it("runs_say_nothing_more_when_none_is_in_progress", () => {
    renderFrame(1440, VIEWER);

    const runs = screen.getByRole("link", { name: /^Runs/ });

    expect(runs).toHaveAccessibleName("Runs");
  });

  it("a_viewer_sees_no_places_to_connect", () => {
    renderFrame(1440, VIEWER);

    const main = screen.getByRole("navigation", { name: "Main" });
    const names = linkNames(main);

    expect(names).toEqual(["Tenon", "Home", "Workflows", "Runs", "Settings"]);
  });

  it("the_test_event_page_belongs_to_webhooks", () => {
    address.pathname = "/connections/test-event";

    renderFrame(1440, EDITOR);

    const main = screen.getByRole("navigation", { name: "Main" });
    const current = within(main).getByRole("link", { current: "page" });
    expect(current).toHaveTextContent("Webhooks");
  });

  it("while_the_session_is_read_the_sidebar_shows_its_shape", () => {
    const viewport = fakeViewport(1440);
    vi.stubGlobal("matchMedia", viewport.matchMedia);

    render(
      <TooltipProvider>
        <ConsoleRoot defaultOpen={null} lastViewport={null}>
          <SidebarLoading />
        </ConsoleRoot>
      </TooltipProvider>,
    );

    const main = screen.getByRole("navigation", { name: "Main" });
    const names = linkNames(main);
    expect(names).toEqual(["Tenon"]);
  });
});

describe("the navigation drawer below 1024 px", () => {
  beforeEach(() => {
    address.pathname = "/workflows";
  });

  function openDrawer() {
    const trigger = screen.getByRole("button", { name: "Navigation" });
    fireEvent.click(trigger);
    return trigger;
  }

  it("is_closed_and_out_of_the_page_until_asked_for", () => {
    renderFrame(800, EDITOR);

    const trigger = screen.getByRole("button", { name: "Navigation" });
    const drawer = screen.queryByRole("dialog");

    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(drawer).not.toBeInTheDocument();
  });

  it("opens_as_a_dialog_named_navigation", () => {
    renderFrame(800, EDITOR);

    const trigger = openDrawer();

    const drawer = screen.getByRole("dialog", { name: "Navigation" });
    const home = within(drawer).getByRole("link", { name: "Home" });
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(home).toBeVisible();
  });

  it("choosing_a_place_closes_it_and_moves_focus_to_the_content", async () => {
    renderFrame(800, EDITOR);
    openDrawer();

    const runs = screen.getByRole("link", { name: /^Runs/ });
    fireEvent.click(runs);

    const content = screen.getByRole("main");
    await waitFor(() => {
      expect(content).toHaveFocus();
    });
  });

  it("arriving_at_another_address_closes_it", () => {
    const view = renderFrame(800, EDITOR);
    openDrawer();

    address.pathname = "/settings/account";
    view.rerender(<FrameAt capabilities={EDITOR} />);

    const drawer = screen.queryByRole("dialog");
    expect(drawer).not.toBeInTheDocument();
  });
});
