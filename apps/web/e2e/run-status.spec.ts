import { expect, test } from "@playwright/test";

const STORY =
  "/iframe.html?id=features-run-status--every-status&viewMode=story";
const DARK_STORY = `${STORY}&globals=theme:dark`;

test.describe("the run status playground", () => {
  test("every_run_status_reads_its_word", async ({ page }) => {
    await page.goto(STORY);

    const runs = page.getByRole("list", { name: "Runs" });
    await expect(runs.getByRole("listitem")).toHaveText([
      "Queued",
      "Running",
      "Waiting",
      "Paused",
      "Succeeded",
      "Failed",
      "Cancelled",
    ]);
  });

  test("the_story_renders_in_the_dark_theme_when_chosen", async ({ page }) => {
    await page.goto(DARK_STORY);

    const root = page.locator("html");
    await expect(root).toHaveAttribute("data-theme", "dark");
  });
});
