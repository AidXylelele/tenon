import type { Condition, ConditionReading } from "language-server/protocol";
import { describe, expect, it } from "vitest";
import { AFTER_A_TEST } from "../data-picker/data-choices/data.test-support";
import { conditionWordsOf } from "./condition-words";
import {
  BEFORE_TODAY,
  NO_ROWS,
  TWO_ROWS_ALL,
  TWO_ROWS_ANY,
  WRITTEN_BEFORE_A_TEST,
} from "./readings.test-support";

function rowsOf(reading: ConditionReading): Condition {
  if (reading.kind !== "condition") throw new Error("It reads as no rows.");

  return reading.condition;
}

describe("a condition in words", () => {
  it("reads_each_row_by_its_data's_names_and_the_builder's_words", () => {
    const words = conditionWordsOf(rowsOf(TWO_ROWS_ALL), AFTER_A_TEST);

    expect(words).toBe(
      "Fetch the digest › slideshow › slides is not empty and Fetch the digest › slideshow › title is “Sample Slide Show”",
    );
  });

  it("names_the_data_written_in_the_field_and_joins_any_with_or", () => {
    const words = conditionWordsOf(rowsOf(TWO_ROWS_ANY), WRITTEN_BEFORE_A_TEST);

    expect(words).toBe(
      "Fetch the digest › slideshow › slides is not empty or Fetch the digest › slideshow › title is “Sample Slide Show”",
    );
  });

  it("names_times_and_data_compared_with", () => {
    const words = conditionWordsOf(rowsOf(BEFORE_TODAY), WRITTEN_BEFORE_A_TEST);

    expect(words).toBe(
      "Fetch the digest › due is less than today and Fetch the digest › owner is The workflow's input",
    );
  });

  it("has_no_words_without_a_row", () => {
    const words = conditionWordsOf(rowsOf(NO_ROWS), AFTER_A_TEST);

    expect(words).toBeNull();
  });
});
