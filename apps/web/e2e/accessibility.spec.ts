import { readFileSync } from "node:fs";
import path from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { z } from "zod";

interface Reviewed {
  readonly rule: string;
  readonly stories: readonly string[] | "every story";
  readonly reason: string;
}

interface Finding {
  readonly id: string;
  readonly nodes: readonly { readonly target: readonly unknown[] }[];
}

const STORY_INDEX = z.object({
  entries: z.record(
    z.string(),
    z.object({
      type: z.string(),
      tags: z.array(z.string()).default([]),
    }),
  ),
});

const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
const WIDE = { width: 1280, height: 900 };
const NARROW = { width: 800, height: 900 };

const MODAL_STORIES = [
  "design-system-components-overlays--dialog-default",
  "design-system-components-overlays--dialog-wide",
  "design-system-components-overlays--alert-dialog-narrow",
  "design-system-components-overlays--side-panel",
  "design-system-components-command--open",
  "design-system-components-fields--select-open",
  "design-system-components-sidebar--mobile-sheet-open",
];

const REVIEWED_INCOMPLETE: readonly Reviewed[] = [
  {
    rule: "bypass",
    stories: "every story",
    reason:
      "A story renders one component, not a page with blocks repeated across pages; the console's pages carry the skip link.",
  },
  {
    rule: "color-contrast",
    stories: ["libs-codemirror--workflow"],
    reason:
      "CodeMirror's fold markers are glyphs, not text; the gutter's colours meet 3:1 in the token table.",
  },
  {
    rule: "aria-hidden-focus",
    stories: MODAL_STORIES,
    reason:
      "Radix's focus guards are hidden spans that send focus back into the open modal, which traps it.",
  },
  {
    rule: "target-size",
    stories: ["features-workflow-flow--wide-fork-at-1024"],
    reason:
      "SC 2.5.8 spacing exception at fitted zoom; Zoom in restores full size.",
  },
];

const indexFile = path.join(__dirname, "../storybook-static/index.json");
const indexText = readFileSync(indexFile, "utf8");
const index = STORY_INDEX.parse(JSON.parse(indexText));
const stories = Object.entries(index.entries)
  .filter(([, entry]) => entry.type === "story")
  .map(([id, entry]) => {
    const narrow = entry.tags.includes("narrow");
    const viewport = narrow ? NARROW : WIDE;
    return { id, viewport };
  });

function wasReviewed(story: string, rule: string): boolean {
  return REVIEWED_INCOMPLETE.some((reviewed) => {
    const covered =
      reviewed.stories === "every story" || reviewed.stories.includes(story);
    return covered && reviewed.rule === rule;
  });
}

function summaryOf(findings: readonly Finding[]) {
  return findings.map(({ id, nodes }) => {
    const targets = nodes.map(({ target }) => target.join(" "));
    return { id, targets };
  });
}

test("the_playground_has_stories_to_check", () => {
  expect(stories.length).toBeGreaterThan(0);
});

for (const theme of ["light", "dark"]) {
  for (const story of stories) {
    test(`the_${story.id}_story_meets_wcag_aa_in_the_${theme}_theme`, async ({
      page,
    }) => {
      await page.setViewportSize(story.viewport);
      await page.goto(
        `/iframe.html?id=${story.id}&viewMode=story&globals=theme:${theme}`,
      );
      const root = page.locator("html");
      await expect(root).toHaveAttribute("data-theme", theme);

      const results = await new AxeBuilder({ page }).withTags(WCAG).analyze();

      const violations = summaryOf(results.violations);
      const unsure = results.incomplete.filter(
        ({ id }) => !wasReviewed(story.id, id),
      );
      const unreviewed = summaryOf(unsure);
      expect({ violations, unreviewed }).toEqual({
        violations: [],
        unreviewed: [],
      });
    });
  }
}
