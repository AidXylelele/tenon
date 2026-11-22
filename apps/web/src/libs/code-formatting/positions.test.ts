import { describe, expect, it } from "vitest";
import { keptCursor, lineWithin } from "./positions";

describe("positions kept across a formatter's rewrite", () => {
  it("the_cursor_keeps_its_line_and_column", () => {
    const cursor = keptCursor("a=1\nb=2", "a = 1\nb = 2\n", 6);

    expect(cursor).toBe(8);
  });

  it("a_column_past_its_new_line_stops_at_the_lines_end", () => {
    const cursor = keptCursor("x  =  1 # tail", "x = 1  # tail\n", 14);

    expect(cursor).toBe(13);
  });

  it("a_line_past_the_new_text_stops_at_its_last_line", () => {
    const cursor = keptCursor("a\n\n\n\nb", "a\nb\n", 7);

    expect(cursor).toBe(4);
  });

  it("a_line_within_the_text_is_kept", () => {
    const line = lineWithin("a\nb\nc", 2);

    expect(line).toBe(2);
  });

  it("a_line_past_the_text_is_its_last_line", () => {
    const line = lineWithin("a\nb", 4);

    expect(line).toBe(2);
  });
});
