import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "./dropdown-menu";

interface ThemeMenuProps {
  readonly onTheme: (theme: string) => void;
}

function ThemeMenu({ onTheme }: ThemeMenuProps) {
  return (
    <>
      <button type="button">Search</button>
      <DropdownMenu defaultOpen>
        <DropdownMenuTrigger>Account</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuLabel>Theme</DropdownMenuLabel>
          <DropdownMenuRadioGroup value="system" onValueChange={onTheme}>
            <DropdownMenuRadioItem value="light">Light</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="dark">Dark</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="system">System</DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
          <DropdownMenuSeparator />
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>Language</DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuItem>English</DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}

describe("a menu of actions", () => {
  it("an_open_menu_leaves_the_rest_of_the_page_readable", () => {
    render(<ThemeMenu onTheme={vi.fn()} />);

    const outside = screen.getByRole("button", { name: "Search" });
    const hidden = outside.closest("[aria-hidden=true]");
    expect(hidden).toBeNull();
  });

  it("choosing_a_radio_item_reports_its_value", () => {
    const onTheme = vi.fn();
    render(<ThemeMenu onTheme={onTheme} />);
    const dark = screen.getByRole("menuitemradio", { name: "Dark" });

    act(() => {
      fireEvent.click(dark);
    });

    expect(onTheme).toHaveBeenCalledWith("dark");
  });

  it("arrow_right_on_a_submenu_item_opens_its_items", () => {
    render(<ThemeMenu onTheme={vi.fn()} />);
    const language = screen.getByRole("menuitem", { name: "Language" });

    act(() => {
      language.focus();
      fireEvent.keyDown(language, { key: "ArrowRight" });
    });

    const english = screen.getByRole("menuitem", { name: "English" });
    expect(english).toBeInTheDocument();
  });
});
