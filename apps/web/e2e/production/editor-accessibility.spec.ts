import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";

const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

const SESSION = { name: "console_session", value: "stub", path: "/" };

const SCHEMES = ["light", "dark"] as const;

async function violationsOf(page: Page): Promise<string[]> {
  const results = await new AxeBuilder({ page }).withTags(WCAG).analyze();
  return results.violations.map(
    (violation) =>
      `${violation.id}: ${violation.nodes.map((node) => node.target.join(" ")).join(", ")}`,
  );
}

async function opened(page: Page, name: string) {
  const flow = page.getByRole("region", { name: "The workflow's flow" });
  const card = flow.getByRole("group", { name: new RegExp(name) });
  await card.getByRole("button").first().click();
  await expect(page.getByRole("heading", { name, level: 2 })).toBeVisible();
}

for (const scheme of SCHEMES) {
  test.describe(`the editor page in ${scheme}`, () => {
    test.use({ colorScheme: scheme });

    test.beforeEach(async ({ page, baseURL }) => {
      const domain = new URL(baseURL ?? "http://localhost").hostname;
      await page.context().addCookies([{ ...SESSION, domain }]);
      await page.goto("/workflows/sales/digest/edit");
      await expect(
        page.getByRole("region", { name: "The workflow's flow" }),
      ).toBeVisible();
    });

    test("the_flow_and_the_workflow_summary_pass_axe", async ({ page }) => {
      await expect(page.getByRole("heading", { name: "Steps" })).toBeVisible();

      const violations = await violationsOf(page);

      expect(violations).toEqual([]);
    });

    test("a_step's_form_with_data_and_a_condition_passes_axe", async ({
      page,
    }) => {
      await opened(page, "Has items");
      const condition = await violationsOf(page);
      await opened(page, "Post the items");
      const data = await violationsOf(page);

      expect(condition).toEqual([]);
      expect(data).toEqual([]);
    });

    test("the_catalog_and_the_test_run_pass_axe", async ({ page }) => {
      const flow = page.getByRole("region", { name: "The workflow's flow" });
      await flow
        .getByRole("button", { name: /^Add a step/ })
        .first()
        .click();
      await expect(
        page.getByRole("heading", { name: "Add a step" }),
      ).toBeVisible();
      const catalog = await violationsOf(page);
      await page.getByRole("button", { name: "Test run" }).first().click();
      await expect(
        page.getByRole("heading", { name: "Test run of the draft" }),
      ).toBeVisible();
      const testRun = await violationsOf(page);

      expect(catalog).toEqual([]);
      expect(testRun).toEqual([]);
    });

    test("the_code_view_passes_axe", async ({ page }) => {
      await page.getByRole("radio", { name: "Code" }).click();
      await expect(
        page.getByRole("textbox", { name: /^Code view/ }),
      ).toBeVisible();

      const violations = await violationsOf(page);

      expect(violations).toEqual([]);
    });
  });
}
