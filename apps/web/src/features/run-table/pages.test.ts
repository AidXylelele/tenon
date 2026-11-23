import { describe, expect, it } from "vitest";
import { pageCountOf, pageNumbersOf, rangeText } from "./pages";

describe("the pages of a run list", () => {
  it.each([
    [0, 50, 1],
    [50, 50, 1],
    [51, 50, 2],
    [10_000, 100, 100],
  ])("%i_runs_by_%i_are_%i_pages", (total, size, count) => {
    const pages = pageCountOf(total, size);

    expect(pages).toBe(count);
  });

  it("a_few_pages_are_all_numbered", () => {
    const numbers = pageNumbersOf(2, 4);

    const pages = numbers.map((each) => each.kind === "page" && each.page);
    expect(pages).toEqual([1, 2, 3, 4]);
  });

  it("many_pages_number_the_first_the_last_and_two_either_side_with_gaps_between", () => {
    const numbers = pageNumbersOf(10, 40);

    expect(numbers).toEqual([
      { kind: "page", page: 1 },
      { kind: "gap", key: "after-1" },
      { kind: "page", page: 8 },
      { kind: "page", page: 9 },
      { kind: "page", page: 10 },
      { kind: "page", page: 11 },
      { kind: "page", page: 12 },
      { kind: "gap", key: "after-12" },
      { kind: "page", page: 40 },
    ]);
  });

  it("the_range_says_which_runs_the_page_shows_of_how_many", () => {
    const first = rangeText(1, 50, 1234, true);
    const last = rangeText(25, 50, 1234, true);

    expect(first).toBe("1–50 of 1,234");
    expect(last).toBe("1,201–1,234 of 1,234");
  });

  it("a_total_the_platform_stopped_counting_reads_more_than", () => {
    const range = rangeText(2, 50, 10_000, false);

    expect(range).toBe("51–100 of more than 10,000");
  });
});
