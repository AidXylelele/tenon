import { expect, type Page, test } from "@playwright/test";

const STORIES = "/iframe.html?viewMode=story&id=features-workflow-flow--";

function open(page: Page, story: string, theme = "light") {
  const address = `${STORIES}${story}&globals=theme:${theme}`;

  return page.goto(address);
}

test.describe("the flow view playground", () => {
  test("a_block_holds_its_steps_in_the_accessibility_tree", async ({
    page,
  }) => {
    await open(page, "blocks");

    const block = page.getByRole("group", {
      name: "Group steps: Prepare the batch",
    });
    const inside = block.getByRole("button", { name: /^Fetch the invoices/ });
    await expect(inside).toBeVisible();
  });

  test("tab_enters_the_flow_at_the_selected_step_and_arrows_move_through_it", async ({
    page,
  }) => {
    await open(page, "edit-with-problems");
    const post = page.getByRole("button", { name: /^Post the items/ });
    const menu = page.getByRole("button", { name: "Step actions" });
    const plus = page.getByRole("button", {
      name: "Add a step after Post the items",
    });
    const zoomIn = page.getByRole("button", { name: "Zoom in" });
    await expect(post).toBeVisible();

    await page.keyboard.press("Tab");
    await expect(post).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await expect(menu).toBeFocused();
    await page.keyboard.press("ArrowRight");
    await expect(plus).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(zoomIn).toBeFocused();
  });

  test("selecting_a_step_marks_it_current_and_keeps_focus_on_it", async ({
    page,
  }) => {
    await open(page, "blocks");
    const send = page.getByRole("button", { name: /^Send the invoice/ });

    await send.click();

    await expect(send).toHaveAttribute("aria-current", "true");
    await expect(send).toBeFocused();
  });

  test("the_wide_fork_opens_fitted_to_the_canvas_width", async ({ page }) => {
    await open(page, "wide-fork-at-1024");
    const canvas = page.getByRole("region", { name: "The workflow's flow" });
    const fork = page.getByRole("group", {
      name: "Run branches at once: Check every region",
    });

    const view = await canvas.boundingBox();
    const drawn = await fork.boundingBox();

    expect(drawn?.width).toBeLessThan(view?.width ?? 0);
  });

  test("zoom_in_draws_the_steps_a_quarter_larger", async ({ page }) => {
    await open(page, "edit-with-problems");
    const fetch = page.getByRole("group", {
      name: "Call a service: Fetch the digest",
    });
    const zoomIn = page.getByRole("button", { name: "Zoom in" });
    const before = await fetch.boundingBox();

    await zoomIn.click();

    const after = await fetch.boundingBox();
    expect(before?.width).toBeCloseTo(280, 0);
    expect(after?.width).toBeCloseTo(350, 0);
  });

  test("each_jump_is_drawn_from_its_branch_to_its_target", async ({ page }) => {
    await open(page, "branches-and-jumps");

    const lines = page.locator("[data-jump-line]");

    await expect(lines).toHaveCount(4);
  });

  test("a_run_says_what_it_did_not_reach", async ({ page }) => {
    await open(page, "run-failed", "dark");

    const root = page.locator("html");
    const end = page.getByText("Not reached");
    await expect(root).toHaveAttribute("data-theme", "dark");
    await expect(end).toBeVisible();
  });
});
