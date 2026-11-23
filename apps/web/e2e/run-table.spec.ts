import { expect, test } from "@playwright/test";

const PAGED = "/iframe.html?id=features-run-table--paged&viewMode=story";
const PAST =
  "/iframe.html?id=features-run-table--past-the-count&viewMode=story";

test.describe("the run table playground", () => {
  test("rows_open_their_runs_and_the_pager_says_the_range", async ({
    page,
  }) => {
    await page.goto(PAGED);

    const run = page.getByRole("link", {
      name: /open the Failed run of route-lead/,
    });
    await expect(run).toHaveAttribute(
      "href",
      "/runs/4f2a9c10-0000-4000-8000-000000000001",
    );
    await expect(page.getByText("101–150 of 1,234")).toBeVisible();
    const current = page.getByRole("link", { name: "Page 3" });
    await expect(current).toHaveAttribute("aria-current", "page");
  });

  test("a_total_past_the_count_reads_more_than", async ({ page }) => {
    await page.goto(PAST);

    await expect(page.getByText("101–150 of more than 10,000")).toBeVisible();
  });
});
