import { readFileSync } from "node:fs";
import path from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

interface StoryIndex {
  readonly entries: Readonly<Record<string, { readonly type: string }>>;
}

const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

const indexFile = path.join(__dirname, "../storybook-static/index.json");
const index: StoryIndex = JSON.parse(readFileSync(indexFile, "utf8"));
const stories = Object.entries(index.entries)
  .filter(([, entry]) => entry.type === "story")
  .map(([id]) => id);

for (const theme of ["light", "dark"]) {
  for (const story of stories) {
    test(`the_${story}_story_meets_wcag_aa_in_the_${theme}_theme`, async ({
      page,
    }) => {
      await page.goto(
        `/iframe.html?id=${story}&viewMode=story&globals=theme:${theme}`,
      );
      const root = page.locator("html");
      await expect(root).toHaveAttribute("data-theme", theme);

      const results = await new AxeBuilder({ page }).withTags(WCAG).analyze();

      const violations = results.violations.map(({ id, nodes }) => {
        const targets = nodes.map(({ target }) => target.join(" "));
        return { id, targets };
      });
      expect(violations).toEqual([]);
    });
  }
}
