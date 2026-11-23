import type {
  DataAtResult,
  DataEntry,
  DataMember,
} from "language-server/protocol";

type EntryShape = Partial<DataEntry> &
  Pick<DataEntry, "source" | "name" | "expression">;

export function entryOf(shape: EntryShape): DataEntry {
  return {
    step: null,
    value: `\${ ${shape.expression} }`,
    isPath: true,
    shape: "unknown",
    size: null,
    needsExport: false,
    members: [],
    typed: null,
    ...shape,
  };
}

function memberOf(
  name: string,
  expression: string,
  shape: DataMember["shape"],
  members: readonly DataMember[] = [],
  size: number | null = null,
): DataMember {
  return {
    name,
    expression,
    value: `\${ ${expression} }`,
    isPath: true,
    shape,
    size,
    members,
  };
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
    isPath: false,
    shape: "text",
  }),
  entryOf({
    source: "time",
    name: "today",
    expression: 'now | strftime("%Y-%m-%dT00:00:00Z")',
    isPath: false,
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

export const TESTED_FETCH_ENTRY: DataEntry = {
  ...FETCH_ENTRY,
  shape: "object",
  members: [
    memberOf("slideshow", ".slideshow", "object", [
      memberOf("title", ".slideshow.title", "text"),
      memberOf("slides", ".slideshow.slides", "list", [], 2),
    ]),
  ],
};

export const AFTER_A_TEST = dataOf([
  TESTED_FETCH_ENTRY,
  GREET_ENTRY,
  INPUT_ENTRY,
  ...TIME_ENTRIES,
]);

export const ADDRESS_AFTER_A_TEST = dataOf([
  TESTED_FETCH_ENTRY,
  INPUT_ENTRY,
  ...TIME_ENTRIES,
  SECRET_ENTRY,
]);

export function typedAs(
  data: DataAtResult,
  name: string,
  expressions: Readonly<Record<string, string>>,
): DataAtResult {
  const entries = data.entries.map((entry) => {
    const expression = expressions[entry.name];
    const typed =
      expression === undefined ? null : memberOf(name, expression, "unknown");
    return { ...entry, typed };
  });
  return { ...data, entries };
}
