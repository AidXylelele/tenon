import { expect, type Page, test } from "@playwright/test";

const WIDE = { width: 1440, height: 900 };
const COMPACT = { width: 1100, height: 900 };
const NARROW = { width: 800, height: 900 };
const ROOT = "[data-slot=sidebar-wrapper]";
const COLUMN = "[data-slot=sidebar][data-state]";

const MOST_STOPS = 30;

function storyOf(name: string): string {
  return `/iframe.html?id=spaces-shell-console-frame--${name}&viewMode=story`;
}

async function open(page: Page, name: string): Promise<void> {
  const story = storyOf(name);
  await page.goto(story);
  await page.getByRole("button", { name: "Run" }).waitFor();
}

function placeOfFocus(page: Page): Promise<string> {
  return page.evaluate(() => {
    const focused = document.activeElement;
    const main = focused?.closest("main");
    const nav = focused?.closest("nav[aria-label]");
    const bar = focused?.closest("header");

    if (main) return "content";

    if (nav) return nav.getAttribute("aria-label") ?? "";

    if (bar) return "top bar";

    return focused?.textContent ?? "";
  });
}

async function tabStopsToContent(page: Page): Promise<string[]> {
  const places: string[] = [];

  for (
    let stop = 0;
    stop < MOST_STOPS && places.at(-1) !== "content";
    stop += 1
  ) {
    await page.keyboard.press("Tab");
    const place = await placeOfFocus(page);
    if (place !== places.at(-1)) places.push(place);
  }

  return places;
}

test.describe("the keyboard through the console frame", () => {
  test("wide_the_tab_order_is_skip_link_navigation_breadcrumb_search_content", async ({
    page,
  }) => {
    await page.setViewportSize(WIDE);
    await open(page, "expanded");

    const stops = await tabStopsToContent(page);

    expect(stops).toEqual([
      "Skip to content",
      "Main",
      "top bar",
      "Breadcrumb",
      "top bar",
      "content",
    ]);
  });

  test("narrow_the_tab_order_is_skip_link_navigation_breadcrumb_search_content", async ({
    page,
  }) => {
    await page.setViewportSize(NARROW);
    await open(page, "narrow");

    const stops = await tabStopsToContent(page);

    expect(stops).toEqual([
      "Skip to content",
      "top bar",
      "Breadcrumb",
      "top bar",
      "content",
    ]);
  });

  test("the_skip_link_moves_focus_to_the_content", async ({ page }) => {
    await page.setViewportSize(WIDE);
    await open(page, "expanded");

    await page.keyboard.press("Tab");
    await page.keyboard.press("Enter");

    const content = page.getByRole("main");
    await expect(content).toBeFocused();
  });

  test("command_k_opens_the_search_on_its_field_and_escape_returns_focus", async ({
    page,
  }) => {
    await page.setViewportSize(WIDE);
    await open(page, "expanded");
    const run = page.getByRole("button", { name: "Run" });
    await run.focus();

    await page.keyboard.press("ControlOrMeta+K");
    const field = page.getByRole("combobox");
    await expect(field).toBeFocused();
    await page.keyboard.press("Escape");

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeHidden();
    await expect(run).toBeFocused();
  });
});

test.describe("the console behind a modal", () => {
  test("is_inert_while_the_search_is_open_and_tab_stays_in_the_search", async ({
    page,
  }) => {
    await page.setViewportSize(WIDE);
    await open(page, "expanded");

    await page.keyboard.press("ControlOrMeta+K");
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");

    const root = page.locator(ROOT);
    const inDialog = await page.evaluate(
      () => document.activeElement?.closest("[role=dialog]") !== null,
    );
    await expect(root).toHaveAttribute("inert");
    expect(inDialog).toBe(true);
  });

  test("is_reachable_again_once_the_search_closes", async ({ page }) => {
    await page.setViewportSize(WIDE);
    await open(page, "expanded");
    await page.keyboard.press("ControlOrMeta+K");

    await page.keyboard.press("Escape");

    const root = page.locator(ROOT);
    await expect(root).not.toHaveAttribute("inert");
  });
});

test.describe("the sidebar's width", () => {
  test("starts_expanded_from_1200_px", async ({ page }) => {
    await page.setViewportSize(WIDE);

    await open(page, "expanded");

    const column = page.locator(COLUMN);
    await expect(column).toHaveAttribute("data-state", "expanded");
  });

  test("starts_collapsed_to_icons_from_1024_to_1199_px", async ({ page }) => {
    await page.setViewportSize(COMPACT);

    await open(page, "expanded");

    const column = page.locator(COLUMN);
    await expect(column).toHaveAttribute("data-state", "collapsed");
  });

  test("keeps_the_person's_saved_choice_from_1024_to_1199_px", async ({
    page,
  }) => {
    await page.setViewportSize(COMPACT);

    await open(page, "chosen-expanded");

    const column = page.locator(COLUMN);
    await expect(column).toHaveAttribute("data-state", "expanded");
  });

  test("shows_the_name_of_an_icon_on_focus_when_collapsed", async ({
    page,
  }) => {
    await page.setViewportSize(COMPACT);
    await open(page, "expanded");

    await page.getByRole("link", { name: "Runs" }).focus();

    const name = page.getByRole("tooltip", { name: "Runs" });
    await expect(name).toBeVisible();
  });
});

test.describe("the navigation drawer below 1024 px", () => {
  test("is_closed_until_asked_for", async ({ page }) => {
    await page.setViewportSize(NARROW);

    await open(page, "narrow");

    const trigger = page.getByRole("button", { name: "Navigation" });
    const drawer = page.getByRole("dialog", { name: "Navigation" });
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
    await expect(drawer).toBeHidden();
  });

  test("opens_modal_with_the_console_behind_it_inert", async ({ page }) => {
    await page.setViewportSize(NARROW);
    await open(page, "narrow");

    await page.getByRole("button", { name: "Navigation" }).click();

    const drawer = page.getByRole("dialog", { name: "Navigation" });
    const root = page.locator(ROOT);
    await expect(drawer).toBeVisible();
    await expect(root).toHaveAttribute("inert");
  });

  test.fail(
    "opening_it_focuses_the_first_link_fails_until_libs_ui_sets_the_sheet's_open_focus",
    async ({ page }) => {
      await page.setViewportSize(NARROW);
      await open(page, "narrow");

      await page.getByRole("button", { name: "Navigation" }).click();

      const brand = page.getByRole("link", { name: "Tenon" });
      await expect(brand).toBeFocused({ timeout: 1_000 });
    },
  );

  test("escape_closes_it_and_returns_focus_to_its_button", async ({ page }) => {
    await page.setViewportSize(NARROW);
    await open(page, "narrow");
    const trigger = page.getByRole("button", { name: "Navigation" });
    await trigger.click();

    await page.keyboard.press("Escape");

    const drawer = page.getByRole("dialog", { name: "Navigation" });
    await expect(drawer).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test("choosing_a_place_closes_it_and_moves_focus_to_the_content", async ({
    page,
  }) => {
    await page.setViewportSize(NARROW);
    await open(page, "narrow");
    await page.getByRole("button", { name: "Navigation" }).click();

    await page.getByRole("link", { name: "Runs" }).click();

    const drawer = page.getByRole("dialog", { name: "Navigation" });
    const content = page.getByRole("main");
    await expect(drawer).toBeHidden();
    await expect(content).toBeFocused();
  });
});
