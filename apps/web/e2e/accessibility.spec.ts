import { readFileSync } from "node:fs";
import path from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { z } from "zod";

interface Reviewed {
  readonly rule: string;
  readonly stories: readonly string[] | "every story";
  readonly target: string;
  readonly reason: string;
}

interface Summary {
  readonly id: string;
  readonly targets: readonly string[];
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
  "spaces-workflows-workflow--run-dialog",
];

const REVIEWED_INCOMPLETE: readonly Reviewed[] = [
  {
    rule: "bypass",
    stories: "every story",
    target: "html",
    reason:
      "A story renders one component, not a page with blocks repeated across pages; the console's pages carry the skip link.",
  },
  {
    rule: "color-contrast",
    stories: ["libs-codemirror--workflow"],
    target: 'span[title="Fold line"]',
    reason:
      "CodeMirror's fold markers are glyphs, not text; the gutter's colours meet 3:1 in the token table.",
  },
  {
    rule: "aria-hidden-focus",
    stories: MODAL_STORIES,
    target: "data-radix-focus-guard",
    reason:
      "Radix's focus guards are hidden spans that send focus back into the open modal, which traps it.",
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

function wasReviewed(story: string, rule: string, target: string): boolean {
  return REVIEWED_INCOMPLETE.some((reviewed) => {
    const covered =
      reviewed.stories === "every story" || reviewed.stories.includes(story);
    const matched = reviewed.rule === rule && target.includes(reviewed.target);
    return covered && matched;
  });
}

function unreviewedOf(story: string, findings: readonly Summary[]): Summary[] {
  return findings
    .map(({ id, targets }) => {
      const open = targets.filter((target) => !wasReviewed(story, id, target));
      return { id, targets: open };
    })
    .filter(({ targets }) => targets.length > 0);
}

function summaryOf(findings: readonly Finding[]): Summary[] {
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
      const incomplete = summaryOf(results.incomplete);
      const unreviewed = unreviewedOf(story.id, incomplete);
      expect({ violations, unreviewed }).toEqual({
        violations: [],
        unreviewed: [],
      });
    });
  }
}
