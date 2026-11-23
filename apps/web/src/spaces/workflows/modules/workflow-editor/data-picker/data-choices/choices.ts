import type {
  DataAtResult,
  DataEntry,
  DataMember,
  DataShape,
  DataWarning,
} from "language-server/protocol";
import type {
  ChoiceGroup,
  ChoiceKind,
  DataChoice,
  DataChoices,
  Json,
} from "./interfaces";

const SEPARATOR = " › ";

const WHOLE_ANSWER = "the whole answer";

const WORKFLOW_INPUT = "The workflow's input";

const TIME_WORDS: ReadonlyMap<string, string> = new Map([
  ["now", "Now"],
  ["today", "Today"],
  ["yesterday", "Yesterday"],
]);

const SHAPE_WORDS: Readonly<Record<DataShape, string>> = {
  object: "fields",
  list: "list",
  text: "text",
  number: "number",
  boolean: "yes or no",
  unknown: "any",
};

const NO_STEP_BEFORE: ChoiceGroup = {
  id: "steps",
  title: "From earlier steps",
  choices: [],
  note: "No step runs before this one; the first step gets the workflow's input.",
};

const UNSEEN =
  "Run a test to see the fields of the answer, or type a field name.";

const TYPED_NOTE = "The test run shows whether the answer has it.";

const TYPED_SHAPE = "a field of the answer";

export function choicesOf(
  data: DataAtResult,
  query: string,
  onlyPaths: boolean,
): DataChoices {
  const all = groupsOf(data);
  const typed = typedGroupOf(data, all, query);
  const offered = typed === null ? all : all.concat([typed]);
  const shown = offered
    .map((group) => shownGroupOf(group, query, onlyPaths))
    .filter((group) => group.choices.length > 0 || group.note !== null);
  const count = shown.reduce((sum, group) => sum + group.choices.length, 0);
  const notes = data.warnings.flatMap(warningText);

  return { groups: shown, count, notes };
}

export function choiceOfValue(
  value: Json,
  data: DataAtResult,
): DataChoice | null {
  if (typeof value !== "string") return null;

  const groups = groupsOf(data);
  const choices = groups.flatMap((group) => group.choices);

  return choices.find((choice) => choice.value === value.trim()) ?? null;
}

export function choiceOfExpression(
  expression: string,
  data: DataAtResult,
): DataChoice | null {
  const groups = groupsOf(data);
  const choices = groups.flatMap((group) => group.choices);

  return choices.find((choice) => choice.expression === expression) ?? null;
}

function groupsOf(data: DataAtResult): ChoiceGroup[] {
  const steps = data.entries.filter((entry) => entry.source === "step");
  const stepGroups = steps.map((entry) => stepGroupOf(entry, data.warnings));
  const before = stepGroups.length > 0 ? stepGroups : [NO_STEP_BEFORE];
  const inputs = entriesOf(data, "workflowInput").flatMap((entry) =>
    choicesOfEntry(entry, WORKFLOW_INPUT, "data", null),
  );
  const variables = entriesOf(data, "variable").flatMap((entry) =>
    choicesOfEntry(entry, entry.name, "data", null),
  );
  const times = entriesOf(data, "time").map((entry) => {
    const label = TIME_WORDS.get(entry.name) ?? entry.name;
    return choiceOf(entry, label, "time", null);
  });
  const secrets = entriesOf(data, "secret").map((entry) =>
    choiceOf(entry, entry.name, "secret", null),
  );
  const others = [
    groupOf("input", "Workflow input", inputs),
    groupOf("variables", "Variables", variables),
    groupOf("times", "Dates and times", times),
    groupOf("secrets", "Secrets · kept out of run records", secrets),
  ];

  return before.concat(others.filter((group) => group.choices.length > 0));
}

function entriesOf(data: DataAtResult, source: DataEntry["source"]) {
  return data.entries.filter((entry) => entry.source === source);
}

function groupOf(
  id: string,
  title: string,
  choices: readonly DataChoice[],
): ChoiceGroup {
  return { id, title, choices, note: null };
}

function stepGroupOf(
  entry: DataEntry,
  warnings: readonly DataWarning[],
): ChoiceGroup {
  const exported = entry.needsExport ? entry.step : null;
  const whole = `${entry.name}${SEPARATOR}${WHOLE_ANSWER}`;
  const own = choiceOf(entry, whole, "data", exported);
  const inner = entry.members.flatMap((member) =>
    memberChoicesOf(member, entry.name, exported),
  );
  const title = `From ${entry.name}`;
  const note = stepNoteOf(entry, entry.members.length, warnings);
  const choices = inner.concat([own]);

  return { id: entry.step ?? entry.name, title, choices, note };
}

function stepNoteOf(
  entry: DataEntry,
  members: number,
  warnings: readonly DataWarning[],
): string | null {
  const unseen = entry.shape === "unknown" && members === 0;
  const skipped = warnings.some(
    (warning) =>
      warning.kind === "mayHoldNothing" && warning.step === entry.step,
  );

  if (unseen) return UNSEEN;

  if (skipped) return `It holds nothing when “${entry.name}” is skipped.`;

  return null;
}

function choicesOfEntry(
  entry: DataEntry,
  label: string,
  kind: ChoiceKind,
  exported: string | null,
): DataChoice[] {
  const own = choiceOf(entry, label, kind, exported);
  const inner = entry.members.flatMap((member) =>
    memberChoicesOf(member, label, exported),
  );
  return [own].concat(inner);
}

function memberChoicesOf(
  member: DataMember,
  parent: string,
  exported: string | null,
): DataChoice[] {
  const label = `${parent}${SEPARATOR}${member.name}`;
  const own = choiceOf(member, label, "data", exported);
  const inner = member.members.flatMap((each) =>
    memberChoicesOf(each, label, exported),
  );
  return [own].concat(inner);
}

function choiceOf(
  member: DataMember,
  label: string,
  kind: ChoiceKind,
  exported: string | null,
): DataChoice {
  const size = member.size;
  const shapeWord = SHAPE_WORDS[member.shape];
  const shape = size === null ? shapeWord : `list of ${String(size)}`;
  return {
    id: member.expression,
    label,
    value: member.value,
    expression: member.expression,
    export: exported,
    kind,
    shape,
    isPath: member.isPath,
  };
}

function typedGroupOf(
  data: DataAtResult,
  groups: readonly ChoiceGroup[],
  query: string,
): ChoiceGroup | null {
  const typed = query.trim();
  const known = new Set(
    groups.flatMap((group) => group.choices.map((choice) => choice.expression)),
  );
  const choices = data.entries
    .flatMap((entry) => typedChoicesOf(entry, typed))
    .filter((choice) => !known.has(choice.expression));

  if (choices.length === 0) return null;

  return {
    id: "typed",
    title: "Use as a field of the answer",
    choices,
    note: TYPED_NOTE,
  };
}

function typedChoicesOf(entry: DataEntry, typed: string): DataChoice[] {
  const member = entry.typed;

  if (member === null || member.name !== typed) return [];

  const owner = entry.source === "workflowInput" ? WORKFLOW_INPUT : entry.name;
  const names = member.name.split(".");
  const label = [owner].concat(names).join(SEPARATOR);
  const exported = entry.needsExport ? entry.step : null;
  const choice = choiceOf(member, label, "data", exported);

  return [{ ...choice, id: `typed:${member.expression}`, shape: TYPED_SHAPE }];
}

function shownGroupOf(
  group: ChoiceGroup,
  query: string,
  onlyPaths: boolean,
): ChoiceGroup {
  const words = query.trim().toLowerCase();
  const isTyped = group.id === "typed";
  const choices = group.choices.filter((choice) => {
    const fits = !onlyPaths || choice.isPath;
    const label = choice.label.toLowerCase();
    const matches = isTyped || words === "" || label.includes(words);
    return fits && matches;
  });
  const note = words === "" || isTyped ? group.note : null;

  return { ...group, choices, note };
}

function warningText(warning: DataWarning): readonly string[] {
  switch (warning.kind) {
    case "inputNotKnownObject":
      return [
        "The data that comes in is not known to be an object; keeping it beside these values may fail when the run gets here.",
      ];
    case "contextNotKnownObject":
      return [
        "Earlier steps are read through the workflow's input, which is not known to be an object; using them may fail when the run gets here.",
      ];
    case "mayHoldNothing":
      return [];
  }
}
