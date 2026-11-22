import type {
  DataAtResult,
  DataEntry,
  DataMember,
} from "language-server/protocol";
import type { Json } from "./interfaces";

type EntryShape = Partial<DataEntry> &
  Pick<DataEntry, "source" | "name" | "expression">;

export function entryOf(shape: EntryShape): DataEntry {
  return {
    step: null,
    value: `\${ ${shape.expression} }`,
    shape: "unknown",
    needsExport: false,
    members: [],
    ...shape,
  };
}

function memberOf(
  name: string,
  expression: string,
  shape: DataMember["shape"],
) {
  return { name, expression, value: `\${ ${expression} }`, shape, members: [] };
}

export const FETCH_ENTRY = entryOf({
  source: "step",
  name: "Fetch the digest",
  step: "/do/Fetch the digest",
  expression: ".",
});

export const GREET_ENTRY = entryOf({
  source: "step",
  name: "Greet",
  step: "/do/Greet",
  expression: "$context.Greet",
  shape: "object",
  needsExport: true,
  members: [memberOf("message", "$context.Greet.message", "text")],
});

export const INPUT_ENTRY = entryOf({
  source: "workflowInput",
  name: "input",
  expression: "$workflow.input",
});

export const ITEM_ENTRY = entryOf({
  source: "variable",
  name: "item",
  expression: "$item",
});

export const TIME_ENTRIES = [
  entryOf({
    source: "time",
    name: "now",
    expression: "now | todate",
    shape: "text",
  }),
  entryOf({
    source: "time",
    name: "today",
    expression: 'now | strftime("%Y-%m-%dT00:00:00Z")',
    shape: "text",
  }),
];

export const SECRET_ENTRY = entryOf({
  source: "secret",
  name: "SLACK_WEBHOOK_URL",
  expression: "$secrets.SLACK_WEBHOOK_URL",
  shape: "text",
});

export function dataOf(
  entries: readonly DataEntry[],
  warnings: DataAtResult["warnings"] = [],
): DataAtResult {
  return { version: 1, entries, warnings };
}

export const AFTER_FETCH = dataOf([
  FETCH_ENTRY,
  GREET_ENTRY,
  INPUT_ENTRY,
  ...TIME_ENTRIES,
]);

export const AT_AN_ADDRESS = dataOf([
  FETCH_ENTRY,
  INPUT_ENTRY,
  ...TIME_ENTRIES,
  SECRET_ENTRY,
]);

export const FIRST_STEP = dataOf([INPUT_ENTRY, ...TIME_ENTRIES]);

export const IN_A_LOOP = dataOf([FETCH_ENTRY, INPUT_ENTRY, ITEM_ENTRY]);

export const DIGEST_SAMPLE: Json = {
  slideshow: {
    title: "Sample Slide Show",
    slides: [{ title: "Wake up" }, { title: "Overview" }],
  },
};

export const SAMPLES: ReadonlyMap<string, Json> = new Map([
  ["/do/Fetch the digest", DIGEST_SAMPLE],
]);
