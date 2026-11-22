import { act, fireEvent, render, screen } from "@testing-library/react";
import Link from "next/link";
import { describe, expect, it, vi } from "vitest";
import { fakeViewport } from "../hooks/viewport.test-support";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
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
    <TooltipProvider>
      <SidebarProvider>
        <Sidebar collapsible="icon">
          <SidebarContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton tooltip="Home">Home</SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive tooltip="Workflows">
                  <Link href="/workflows">Workflows</Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarContent>
        </Sidebar>
        <SidebarInset>
          <SidebarTrigger />
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}

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
    const home = screen.getByRole("button", { name: "Home" });
    act(() => {
      home.focus();
    });

    act(() => {
      fireEvent.keyDown(window, { key: "b", ctrlKey: true });
    });

    expect(home).toHaveFocus();
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
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton>Runs</SidebarMenuButton>
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

  it("its_parts_render_their_places_and_loading_rows", () => {
    const viewport = fakeViewport(1440);
    vi.stubGlobal("matchMedia", viewport.matchMedia);

    const { container } = render(<Column onOpenChange={vi.fn()} />);

    const runs = screen.getByRole("button", { name: "Runs" });
    const loading = container.querySelectorAll('[data-slot="skeleton"]');
    expect(runs).toBeInTheDocument();
    expect(loading).toHaveLength(2);
  });

  it("a_column_that_cannot_collapse_is_a_plain_panel", () => {
    const viewport = fakeViewport(1440);
    vi.stubGlobal("matchMedia", viewport.matchMedia);

    render(
      <SidebarProvider>
        <Sidebar collapsible="none">Places</Sidebar>
      </SidebarProvider>,
    );

    const panel = screen.getByText("Places");
    expect(panel).toHaveAttribute("data-slot", "sidebar");
  });

  it("asking_for_the_sidebar_outside_its_provider_is_refused", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const rendering = () => render(<Stray />);

    expect(rendering).toThrow(
      new Error("useSidebar must be used within a SidebarProvider."),
    );
  });
});
