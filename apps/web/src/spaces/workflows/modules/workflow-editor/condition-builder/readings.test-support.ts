import type {
  ConditionReading,
  DataAtResult,
  WrittenMember,
} from "language-server/protocol";
import { AFTER_FETCH } from "../data-picker/data-choices/data.test-support";

function writtenOf(
  expression: string,
  label: readonly string[],
): WrittenMember {
  return {
    name: label.at(-1) ?? "",
    expression,
    value: `\${ ${expression} }`,
    isPath: true,
    shape: "unknown",
    size: null,
    members: [],
    label,
  };
}

export const WRITTEN_BEFORE_A_TEST: DataAtResult = {
  ...AFTER_FETCH,
  written: [
    writtenOf(".slideshow.slides", ["Fetch the digest", "slideshow", "slides"]),
    writtenOf(".slideshow.title", ["Fetch the digest", "slideshow", "title"]),
    writtenOf(".due", ["Fetch the digest", "due"]),
    writtenOf(".owner", ["Fetch the digest", "owner"]),
  ],
};

export const TWO_ROWS_ALL: ConditionReading = {
  kind: "condition",
  condition: {
    join: "all",
    rows: [
      {
        left: ".slideshow.slides",
        comparison: "isNotEmpty",
        right: null,
      },
      {
        left: ".slideshow.title",
        comparison: "is",
        right: { kind: "value", value: "Sample Slide Show" },
      },
    ],
  },
};

export const TWO_ROWS_ANY: ConditionReading = {
  kind: "condition",
  condition: { ...TWO_ROWS_ALL.condition, join: "any" },
};

export const NO_ROWS: ConditionReading = {
  kind: "condition",
  condition: { join: "all", rows: [] },
};

export const TWO_ROWS_TEXT =
  '${ (.slideshow.slides | . != null and . != "" and . != [] and . != {}) and (.slideshow.title == "Sample Slide Show") }';

export const NON_CANONICAL_TEXT = "${ (.slideshow.slides | length) > 3 }";

export const AN_EXPRESSION = {
  kind: "expression",
  text: NON_CANONICAL_TEXT,
} as const;

export const BEFORE_TODAY: ConditionReading = {
  kind: "condition",
  condition: {
    join: "all",
    rows: [
      {
        left: ".due",
        comparison: "isLessThan",
        right: { kind: "time", time: "today" },
      },
      {
        left: ".owner",
        comparison: "is",
        right: { kind: "data", path: "$workflow.input" },
      },
    ],
  },
};
