import { act, fireEvent, render, screen } from "@testing-library/react";
import Link from "next/link";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fakeViewport } from "../hooks/viewport.test-support";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  SidebarProvider,
  SidebarRail,
  SidebarSeparator,
  SidebarTrigger,
  useSidebar,
} from "./sidebar";
import { TooltipProvider } from "./tooltip";

function Navigation() {
  return (
    <TooltipProvider delayDuration={0}>
      <SidebarProvider>
        <Sidebar collapsible="icon">
          <SidebarContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild tooltip="Home">
                  <Link href="/">Home</Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive tooltip="Workflows">
                  <Link href="/workflows">Workflows</Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarContent>
          <SidebarFooter>
            <button type="button">Administrator</button>
          </SidebarFooter>
        </Sidebar>
        <SidebarInset>
          <SidebarTrigger />
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}

afterEach(() => {
  vi.useRealTimers();
});

function openedAt(width: number) {
  const viewport = fakeViewport(width);
  vi.stubGlobal("matchMedia", viewport.matchMedia);
  render(<Navigation />);
  const trigger = screen.getByRole("button", { name: "Navigation" });
  act(() => {
    fireEvent.click(trigger);
  });
  return trigger;
}

describe("the console's navigation below 1024 px", () => {
  it("the_menu_button_opens_a_modal_sheet_named_navigation_that_it_controls", () => {
    const trigger = openedAt(800);

    const sheet = screen.getByRole("dialog", { name: "Navigation" });
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(trigger).toHaveAttribute("aria-controls", sheet.id);
  });

  it("while_the_sheet_is_open_its_menu_button_leaves_the_tab_order", () => {
    const trigger = openedAt(800);

    expect(trigger).toHaveAttribute("tabindex", "-1");
  });

  it("the_open_sheet_starts_on_its_first_place_not_on_the_account_menu", () => {
    openedAt(800);

    const home = screen.getByRole("link", { name: "Home" });
    expect(home).toHaveFocus();
  });

  it("the_sheet_has_its_close_button", () => {
    openedAt(800);

    const close = screen.getByRole("button", { name: "Close" });
    expect(close).toBeInTheDocument();
  });

  it("one_escape_closes_the_sheet_and_gives_focus_back_to_the_menu_button", async () => {
    const trigger = openedAt(800);
    const focused = document.activeElement ?? document.body;

    act(() => {
      fireEvent.keyDown(focused, { key: "Escape", code: "Escape" });
    });

    const sheet = screen.queryByRole("dialog");
    expect(sheet).not.toBeInTheDocument();
    await vi.waitFor(() => {
      expect(trigger).toHaveFocus();
    });
  });
});

describe("the console's navigation from 1024 px", () => {
  it("the_current_place_is_announced_as_the_current_page", () => {
    const viewport = fakeViewport(1440);
    vi.stubGlobal("matchMedia", viewport.matchMedia);

    render(<Navigation />);

    const current = screen.getByRole("link", { name: "Workflows" });
    expect(current).toHaveAttribute("aria-current", "page");
  });

  it("collapsing_the_column_with_ctrl_b_keeps_focus_on_the_focused_item", () => {
    const viewport = fakeViewport(1440);
    vi.stubGlobal("matchMedia", viewport.matchMedia);
    render(<Navigation />);
    const home = screen.getByRole("link", { name: "Home" });
    act(() => {
      home.focus();
    });

    act(() => {
      fireEvent.keyDown(window, { key: "b", ctrlKey: true });
    });

    expect(home).toHaveFocus();
  });

  it("an_item_hovered_and_left_while_expanded_shows_no_tooltip_after_collapsing", () => {
    vi.useFakeTimers();
    const viewport = fakeViewport(1440);
    vi.stubGlobal("matchMedia", viewport.matchMedia);
    render(<Navigation />);
    const home = screen.getByRole("link", { name: "Home" });
    act(() => {
      fireEvent.pointerMove(home, { pointerType: "mouse" });
      vi.runAllTimers();
    });
    act(() => {
      fireEvent.pointerLeave(home, { pointerType: "mouse" });
      vi.runAllTimers();
    });

    act(() => {
      fireEvent.keyDown(window, { key: "b", ctrlKey: true });
      vi.runAllTimers();
    });

    const tooltip = screen.queryByRole("tooltip");
    expect(tooltip).not.toBeInTheDocument();
  });

  it("in_the_icon_column_a_hovered_item_shows_its_name", () => {
    vi.useFakeTimers();
    const viewport = fakeViewport(1440);
    vi.stubGlobal("matchMedia", viewport.matchMedia);
    render(<Navigation />);
    act(() => {
      fireEvent.keyDown(window, { key: "b", ctrlKey: true });
    });
    const home = screen.getByRole("link", { name: "Home" });

    act(() => {
      fireEvent.pointerMove(home, { pointerType: "mouse" });
      vi.runAllTimers();
    });

    const tooltip = screen.getByRole("tooltip");
    expect(tooltip).toHaveTextContent("Home");
  });

  it("a_focused_item_of_the_expanded_column_is_not_described_by_a_tooltip", () => {
    const viewport = fakeViewport(1440);
    vi.stubGlobal("matchMedia", viewport.matchMedia);
    render(<Navigation />);
    const home = screen.getByRole("link", { name: "Home" });

    act(() => {
      home.focus();
    });

    expect(home).not.toHaveAttribute("aria-describedby");
  });

  it("the_menu_button_says_whether_the_column_is_expanded", () => {
    const viewport = fakeViewport(1440);
    vi.stubGlobal("matchMedia", viewport.matchMedia);
    render(<Navigation />);
    const trigger = screen.getByRole("button", { name: "Navigation" });

    act(() => {
      fireEvent.click(trigger);
    });

    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });
});

function Column({
  onOpenChange,
}: {
  readonly onOpenChange: (open: boolean) => void;
}) {
  return (
    <SidebarProvider open onOpenChange={onOpenChange}>
      <Sidebar collapsible="icon">
        <SidebarHeader>Tenon</SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel id="activity">Activity</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu aria-labelledby="activity">
                <SidebarMenuItem>
                  <SidebarMenuButton>Runs</SidebarMenuButton>
                  <SidebarMenuBadge>10</SidebarMenuBadge>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuSkeleton showIcon />
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
          <SidebarSeparator />
        </SidebarContent>
        <SidebarFooter>Settings</SidebarFooter>
        <SidebarRail />
      </Sidebar>
    </SidebarProvider>
  );
}

function Stray() {
  useSidebar();
  return null;
}

describe("the console's navigation as a column", () => {
  it("a_column_held_by_its_owner_asks_its_owner_to_close", () => {
    const viewport = fakeViewport(1440);
    vi.stubGlobal("matchMedia", viewport.matchMedia);
    const onOpenChange = vi.fn();
    render(<Column onOpenChange={onOpenChange} />);
    const rail = screen.getByRole("button", { name: "Toggle Sidebar" });

    act(() => {
      fireEvent.click(rail);
    });

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("a_group_of_places_is_named_by_its_label", () => {
    const viewport = fakeViewport(1440);
    vi.stubGlobal("matchMedia", viewport.matchMedia);

    render(<Column onOpenChange={vi.fn()} />);

    const group = screen.getByRole("list", { name: "Activity" });
    expect(group).toBeInTheDocument();
  });

  it("a_place_shows_its_count_after_its_name", () => {
    const viewport = fakeViewport(1440);
    vi.stubGlobal("matchMedia", viewport.matchMedia);
    render(<Column onOpenChange={vi.fn()} />);

    const runs = screen.getByRole("button", { name: "Runs" });

    const place = runs.closest("li");
    expect(place).toHaveTextContent("Runs10");
  });

  it("asking_for_the_sidebar_outside_its_provider_is_refused", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const rendering = () => render(<Stray />);

    expect(rendering).toThrow(
      new Error("useSidebar must be used within a SidebarProvider."),
    );
  });
});
