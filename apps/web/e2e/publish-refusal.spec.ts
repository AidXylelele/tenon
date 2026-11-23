import { expect, test } from "@playwright/test";

const REFUSED_SCHEDULE =
  "/iframe.html?id=spaces-workflows-modules-workflow-editor-publish-refusal--refused-schedule&viewMode=story";

const NEVER_FIRES = /The schedule 0 18 30 2 \* never fires/;

test.describe("the publish refusal playground", () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test("a_refused_publish_lists_its_problem_and_marks_its_place", async ({
    page,
  }) => {
    await page.goto(REFUSED_SCHEDULE);
    const header = page.getByRole("banner");
    const before = await header.boundingBox();

    await page.getByRole("button", { name: "Publish", exact: true }).click();
    await page.getByRole("button", { name: /^Publish 1\.0\.0/ }).click();

    const told = page.getByText("Publishing refused — see Problems");
    const listed = page.getByRole("list", { name: "Problems" });
    const problem = listed.getByRole("button", { name: NEVER_FIRES });
    const point = page.locator(".cm-lintPoint-error");
    const marker = page.locator(".cm-lint-marker-error");
    await expect(told).toBeVisible();
    await expect(problem).toContainText("Line 7");
    await expect(point).toHaveCount(1);
    await expect(marker).toHaveCount(1);
    const after = await header.boundingBox();
    expect(after?.height).toBe(before?.height);
  });
});
