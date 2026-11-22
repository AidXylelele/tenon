import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { User } from "@/libs/data-access/types";
import { SidebarProvider } from "@/libs/ui/components/sidebar";
import { TooltipProvider } from "@/libs/ui/components/tooltip";
import { fakeViewport } from "@/libs/ui/hooks/viewport.test-support";
import { AccountMenu } from "./account-menu";

const signOut = vi.fn<() => Promise<void>>();
const keepTheme = vi.fn<(chosen: string) => Promise<void>>();

const ADA: User = {
  id: "user-1",
  email: "ada@example.com",
  name: "Ada Lovelace",
  role: "editor",
};

function renderMenu() {
  return render(
    <TooltipProvider>
      <SidebarProvider>
        <AccountMenu user={ADA} signOut={signOut} keepTheme={keepTheme} />
      </SidebarProvider>
    </TooltipProvider>,
  );
}

function openMenu() {
  const button = screen.getByRole("button", { name: /Ada Lovelace/ });
  fireEvent.keyDown(button, { key: "Enter" });
}

function openThemes() {
  const theme = screen.getByRole("menuitem", { name: "Theme" });
  fireEvent.keyDown(theme, { key: "ArrowRight" });
}

describe("the account menu", () => {
  beforeEach(() => {
    signOut.mockReset();
    signOut.mockResolvedValue(undefined);
    keepTheme.mockReset();
    keepTheme.mockResolvedValue(undefined);
    delete document.documentElement.dataset.theme;
    const viewport = fakeViewport(1440);
    vi.stubGlobal("matchMedia", viewport.matchMedia);
  });

  it("names_the_person_with_initials_and_their_role", () => {
    renderMenu();

    const button = screen.getByRole("button", { name: /Ada Lovelace/ });

    expect(button).toHaveTextContent("ALAda LovelaceEditor");
  });

  it.each([
    ["Ada", "A"],
    ["  ada   byron lovelace ", "AB"],
    ["   ", "?"],
  ])("%s_is_shown_as_%s", (name, initials) => {
    const user = { ...ADA, name };
    render(
      <TooltipProvider>
        <SidebarProvider>
          <AccountMenu user={user} signOut={signOut} keepTheme={keepTheme} />
        </SidebarProvider>
      </TooltipProvider>,
    );

    const avatar = screen.getByText(initials);
    expect(avatar).toHaveAttribute("aria-hidden", "true");
  });

  it("shows_the_email_once_opened", () => {
    renderMenu();

    openMenu();

    const email = screen.getByText("ada@example.com");
    expect(email).toBeVisible();
  });

  it("offers_the_themes_in_order_with_the_present_one_checked", () => {
    document.documentElement.dataset.theme = "dark";
    renderMenu();
    openMenu();

    openThemes();

    const themes = screen.getAllByRole("menuitemradio");
    const names = themes.map((theme) => theme.textContent);
    const checked = screen.getByRole("menuitemradio", { checked: true });
    expect(names).toEqual(["System", "Light", "Dark"]);
    expect(checked).toHaveTextContent("Dark");
  });

  it("a_theme_chosen_shows_at_once_and_is_kept", () => {
    renderMenu();
    openMenu();
    openThemes();

    const light = screen.getByRole("menuitemradio", { name: "Light" });
    fireEvent.click(light);

    expect(document.documentElement.dataset.theme).toBe("light");
    expect(keepTheme).toHaveBeenCalledWith("light");
  });

  it("the_system_theme_leaves_the_page_to_the_device", () => {
    document.documentElement.dataset.theme = "dark";
    renderMenu();
    openMenu();
    openThemes();

    const system = screen.getByRole("menuitemradio", { name: "System" });
    fireEvent.click(system);

    expect(document.documentElement).not.toHaveAttribute("data-theme");
    expect(keepTheme).toHaveBeenCalledWith("system");
  });

  it("signing_out_ends_the_session", () => {
    renderMenu();
    openMenu();

    const signOutItem = screen.getByRole("menuitem", { name: "Sign out" });
    fireEvent.click(signOutItem);

    expect(signOut).toHaveBeenCalledTimes(1);
  });
});
