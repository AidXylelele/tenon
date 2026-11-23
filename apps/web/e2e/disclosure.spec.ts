import { expect, test } from "@playwright/test";

const STORY =
  "/iframe.html?id=design-system-components-disclosure--closed&viewMode=story";

test.describe("a disclosure from the keyboard", () => {
  test("enter_opens_it_and_space_closes_it_again", async ({ page }) => {
    await page.goto(STORY);
    const header = page.getByRole("button", { name: "More options" });
    await header.focus();

    await page.keyboard.press("Enter");
    await expect(header).toHaveAttribute("aria-expanded", "true");
    await page.keyboard.press("Space");

    await expect(header).toHaveAttribute("aria-expanded", "false");
  });
});
