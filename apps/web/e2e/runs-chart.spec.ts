import { expect, test } from "@playwright/test";

const WEEK = "/iframe.html?id=features-runs-chart--week-in-kyiv&viewMode=story";
const DARK_WEEK = `${WEEK}&globals=theme:dark`;

test.describe("the runs chart playground", () => {
  test("the_figures_open_their_runs_and_the_chart_has_its_table", async ({
    page,
  }) => {
    await page.goto(WEEK);

    const failed = page.getByRole("link", { name: /^Failed/ });
    await expect(failed).toHaveAttribute("href", "/runs?status=failed");
    await expect(failed).toContainText("↓ from 20 the previous 7 days");
    await page.getByRole("button", { name: "Show as table" }).click();
    const table = page.getByRole("region", { name: "Runs per day as a table" });
    await expect(table.getByRole("row")).toHaveCount(8);
  });

  test("the_chart_renders_its_bars_in_the_dark_theme", async ({ page }) => {
    await page.goto(DARK_WEEK);

    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await expect(page.locator(".recharts-bar-rectangle").first()).toBeVisible();
  });
});
