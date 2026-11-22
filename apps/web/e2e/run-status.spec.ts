import { expect, test } from "@playwright/test";

const STORY = "/iframe.html?id=features-run-status--last-day&viewMode=story";
const DARK_STORY = `${STORY}&globals=theme:dark`;

test.describe("the run status playground", () => {
  test("each_phase_with_runs_is_a_link_with_its_count", async ({ page }) => {
    await page.goto(STORY);

    const counts = page.getByRole("region", { name: "Last 24 hours" });
    const links = counts.getByRole("link");
    await expect(links).toHaveText(["Running2", "Completed12", "Faulted1"]);
    const running = links.first();
    await expect(running).toHaveAttribute("href", "/runs?phase=running");
  });

  test("the_story_renders_in_the_dark_theme_when_chosen", async ({ page }) => {
    await page.goto(DARK_STORY);

    const root = page.locator("html");
    await expect(root).toHaveAttribute("data-theme", "dark");
  });
});
