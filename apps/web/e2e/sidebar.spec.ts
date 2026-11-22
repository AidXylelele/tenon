import { expect, test, type Page } from "@playwright/test";

const STORIES =
  "/iframe.html?viewMode=story&id=design-system-components-sidebar";

async function colourOf(page: Page, token: string): Promise<string> {
  return page.evaluate((name) => {
    const probe = document.createElement("span");
    probe.style.color = `var(${name})`;
    document.body.append(probe);
    const colour = getComputedStyle(probe).color;
    probe.remove();
    return colour;
  }, token);
}

test.describe("the console's navigation", () => {
  test("expanded_it_shows_its_group_label_and_the_runs_count", async ({
    page,
  }) => {
    await page.goto(`${STORIES}--expanded`);

    const label = page.getByText("Connect", { exact: true });
    const count = page.getByText("10", { exact: true });
    await expect(label).toHaveCSS("opacity", "1");
    await expect(count).toBeVisible();
  });

  test("collapsed_to_icons_it_hides_its_group_label_and_the_runs_count", async ({
    page,
  }) => {
    await page.goto(`${STORIES}--collapsed-to-icons`);

    const label = page.getByText("Connect", { exact: true });
    const count = page.getByText("10", { exact: true });
    await expect(label).toHaveCSS("opacity", "0");
    await expect(count).toBeHidden();
  });

  test("a_hovered_place_keeps_its_count_readable_on_the_hover_fill", async ({
    page,
  }) => {
    await page.goto(`${STORIES}--expanded`);
    const runs = page.getByRole("link", { name: /^Runs/ });
    const count = page.getByText("10", { exact: true });

    await runs.hover();

    const strong = await colourOf(page, "--info-strong");
    await expect(count).toHaveCSS("color", strong);
  });

  test("the_mobile_sheet_opens_on_its_first_place", async ({ page }) => {
    await page.setViewportSize({ width: 800, height: 900 });

    await page.goto(`${STORIES}--mobile-sheet-open`);

    const home = page.getByRole("link", { name: "Home" });
    await expect(home).toBeFocused();
  });
});
