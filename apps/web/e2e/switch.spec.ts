import { expect, test } from "@playwright/test";

const STORY =
  "/iframe.html?id=design-system-components-selection--states&viewMode=story";

test.describe("a switch with a problem", () => {
  test("an_invalid_switch_shows_its_danger_outline", async ({ page }) => {
    await page.goto(STORY);

    const invalid = page.getByRole("switch", { name: "Accept the terms" });

    await expect(invalid).toHaveCSS("outline-style", "solid");
  });
});
