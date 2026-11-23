import type {
  HostProfile,
  JsonValue,
  SchemaAt,
  SemanticModel,
} from "interpreter/front-end";
import {
  holderDescriptionOf,
  type HostReads,
  membersOf,
  type SchemasAt,
} from "../places/index.js";
import { amountsOf, isDurationAt } from "./durations.js";
import {
  resultChoicesOf,
  type ResultReading,
  resultReadingOf,
  variantOf,
  writtenResultOf,
} from "../variants/index.js";
import { stepEssentialsOf, workflowEssentialsOf } from "./essentials.js";
import { titleOf } from "./titles.js";
import { childPointerOf, isJsonObject, valueAt } from "../pointers/index.js";
import {
  modelOf,
  problemsOf,
  type Snapshot,
  sourceOf,
} from "../snapshot/index.js";
import {
  failureOf,
  listNamesOf,
  protectedStepOf,
  type StepNode,
  type StepTree,
  stepTreeOf,
  stepWithId,
} from "../steps/index.js";
import { catchPolicyOf, type RetryPlan } from "../structure/index.js";
import type {
  FieldSources,
  FormField,
  FormRefusal,
  FormInput,
  FormSection,
  MemberField,
  PlacedMember,
  StepFormReading,
  WorkflowFormReading,
  WorkflowMember,
} from "./interfaces.js";

const memberSections: ReadonlyMap<string, FormSection> = new Map([
  ["if", "settings"],
  ["input", "data"],
  ["output", "data"],
  ["export", "data"],
  ["timeout", "failure"],
  ["then", "settings"],
  ["metadata", "note"],
]);

const ownMemberSections: ReadonlyMap<string, FormSection> = new Map([
  ["catch", "failure"],
]);

const workflowMembers: readonly WorkflowMember[] = [
  {
    holder: "/document",
    name: "title",
    section: "note",
    requires: null,
    fields: "members",
  },
  {
    holder: "/document",
    name: "summary",
    section: "note",
    requires: null,
    fields: "members",
  },
  {
    holder: "/document",
    name: "version",
    section: "settings",
    requires: null,
    fields: "members",
  },
  {
    holder: "",
    name: "schedule",
    section: "settings",
    requires: null,
    fields: "triggers",
  },
  {
    holder: "/schedule",
    name: "read",
    section: "settings",
    requires: "/schedule/on",
    fields: "members",
  },
  {
    holder: "",
    name: "input",
    section: "data",
    requires: null,
    fields: "members",
  },
];

const unread: FormRefusal = {
  kind: "refused",
  reason: "The text does not read; edit it in the text.",
};

const unanalysed: FormRefusal = {
  kind: "refused",
  reason: "The document has never analysed; edit it in the text.",
};

export function formOf(
  snapshot: Snapshot,
  step: string,
  schemasAt: SchemasAt,
): StepFormReading {
  const source = sourceOf(snapshot.analysis);
  const model = modelOf(snapshot);

  if (source === null) {
    return unread;
  }

  if (model === null) {
    return unanalysed;
  }

  const tree = stepTreeOf(model.workflow);
  const document = source.document;
  const node = standingStepOf(tree, step, document);

  if (node === null) {
    return { kind: "refused", reason: `No step has the id '${step}'.` };
  }

  const suggestions = suggestionsOf(node, tree);
  const diagnostics = problemsOf(snapshot);
  const essentials = stepEssentialsOf(node, document);
  const sources = { document, schemasAt, diagnostics, suggestions, essentials };
  const fields = stepFieldsOf(node.pointer, sources);
  const failure = failureOf(node);
  const retry = protectingRetryOf(node, model);
  const result = stepResultOf(node, document);

  return { kind: "form", failure, retry, result, fields };
}

function protectingRetryOf(
  node: StepNode,
  model: SemanticModel,
): RetryPlan | null {
  const inner = protectedStepOf(node);

  if (inner === null) {
    return null;
  }

  const policy = catchPolicyOf(node.task, model);
  return policy?.retry ?? null;
}

function standingStepOf(
  tree: StepTree,
  step: string,
  document: JsonValue,
): StepNode | null {
  const node = stepWithId(tree, step);

  if (node === null) {
    return null;
  }

  const written = valueAt(document, node.pointer);
  const isStanding = isJsonObject(written);

  return isStanding ? node : null;
}

function stepResultOf(
  node: StepNode,
  document: JsonValue,
): ResultReading | null {
  const variant = variantOf(node.task);
  const choices = resultChoicesOf(variant);
  const written = writtenResultOf(node, document);

  return resultReadingOf(choices, written);
}

export function workflowFormOf(
  snapshot: Snapshot,
  reads: HostReads,
): WorkflowFormReading {
  const source = sourceOf(snapshot.analysis);

  if (source === null) {
    return unread;
  }

  const { schemasAt, profile } = reads;
  const document = source.document;
  const diagnostics = problemsOf(snapshot);
  const suggestions = new Map<string, readonly JsonValue[]>();
  const essentials = workflowEssentialsOf();
  const sources = { document, schemasAt, diagnostics, suggestions, essentials };
  const fields = workflowMembers.flatMap((place) =>
    workflowFieldsOf(place, sources, profile),
  );

  return { kind: "form", fields };
}

function workflowFieldsOf(
  place: WorkflowMember,
  sources: FieldSources,
  profile: HostProfile,
): readonly FormField[] {
  const entries = sources.schemasAt(sources.document, place.holder);
  const members = membersOf(entries);
  const member = members.find((candidate) => candidate.name === place.name);
  const required = place.requires;
  const isOffered =
    required === null || valueAt(sources.document, required) !== undefined;

  if (member === undefined || !isOffered) {
    return [];
  }

  const placed = { member, holder: place.holder, section: place.section };

  switch (place.fields) {
    case "members": {
      const field = sectionedFieldOf(placed, sources);
      return [field];
    }
    case "triggers": {
      const field = triggersFieldOf(placed, sources, profile);
      return [field];
    }
  }
}

function triggersFieldOf(
  placed: PlacedMember,
  sources: FieldSources,
  profile: HostProfile,
): FormField {
  const field = memberFieldOf(placed, sources);
  const entries = sources.schemasAt(sources.document, field.pointer);
  const members = membersOf(entries);
  const section = placed.section;
  const runnable: readonly string[] = profile.schedules;
  const triggers = members.filter((candidate) =>
    runnable.includes(candidate.name),
  );
  const fields = triggers.map((trigger) => {
    const placedTrigger = { member: trigger, holder: field.pointer, section };
    return sectionedFieldOf(placedTrigger, sources);
  });
  const input = triggersInputOf(profile);

  return { ...field, input, section, fields };
}

function triggersInputOf(profile: HostProfile): FormInput {
  const isOne = profile.triggers === "one";

  if (isOne) {
    return "oneOf";
  }

  return "group";
}

function suggestionsOf(
  node: StepNode,
  tree: StepTree,
): ReadonlyMap<string, readonly JsonValue[]> {
  const names = listNamesOf(tree, node);
  const then = node.task.then.pointer;

  return new Map([[then, names]]);
}

function stepFieldsOf(
  pointer: string,
  sources: FieldSources,
): readonly FormField[] {
  const entries = sources.schemasAt(sources.document, pointer);
  const members = membersOf(entries);

  return members.map((member) => {
    const section = sectionOf(member.name);
    const placed = { member, holder: pointer, section };
    return sectionedFieldOf(placed, sources);
  });
}

function sectionedFieldOf(
  placed: PlacedMember,
  sources: FieldSources,
): FormField {
  const section = placed.section;
  const field = memberFieldOf(placed, sources);
  const fields = fieldsBelowOf(field, section, sources);

  return { ...field, section, fields };
}

function fieldsBelowOf(
  field: MemberField,
  section: FormSection,
  sources: FieldSources,
): readonly FormField[] {
  switch (field.input) {
    case "group":
      return groupFieldsOf(field.pointer, section, sources);
    case "duration":
      return unitFieldsOf(field.pointer, section, sources);
    case "text":
    case "number":
    case "boolean":
    case "choice":
    case "oneOf":
    case "structured":
      return [];
  }
}

function groupFieldsOf(
  pointer: string,
  section: FormSection,
  sources: FieldSources,
): readonly FormField[] {
  const entries = sources.schemasAt(sources.document, pointer);
  const members = membersOf(entries);

  return members.map((member) => {
    const placed = { member, holder: pointer, section };
    const field = memberFieldOf(placed, sources);
    const isGroup = field.input === "group";
    const isOpened = holdsEssentialOf(field.pointer, sources);
    const isFlattened = isGroup && !isOpened;
    const input = isFlattened ? "structured" : field.input;
    const flat = { ...field, input };
    const fields = fieldsBelowOf(flat, section, sources);

    return { ...flat, section, fields };
  });
}

function unitFieldsOf(
  pointer: string,
  section: FormSection,
  sources: FieldSources,
): readonly FormField[] {
  const entries = sources.schemasAt(sources.document, pointer);
  const units = membersOf(entries);
  const written = valueAt(sources.document, pointer);
  const amounts = amountsOf(written);

  return units.map((unit) => {
    const unitPointer = childPointerOf(pointer, unit.name);
    const writtenUnit = valueAt(sources.document, unitPointer);
    const diagnostics = diagnosticsAt(unitPointer, sources);

    return {
      key: unit.name,
      title: titleOf(unit.name),
      pointer: unitPointer,
      section,
      description: unit.description,
      input: "number",
      choices: [],
      required: false,
      written: writtenUnit !== undefined,
      suggested: false,
      value: amounts.get(unit.name) ?? null,
      essentialRank: null,
      fields: [],
      diagnostics,
    };
  });
}

function memberFieldOf(
  placed: PlacedMember,
  sources: FieldSources,
): MemberField {
  const { member, holder, section } = placed;
  const pointer = childPointerOf(holder, member.name);
  const entries = sources.schemasAt(sources.document, pointer);
  const written = valueAt(sources.document, pointer);
  const described = entries.find((entry) => entry.description !== null);
  const own = member.description ?? described?.description ?? null;
  const description =
    own ?? holderDescriptionOf(sources.document, pointer, sources.schemasAt);
  const title = titleOf(member.name);
  const isWritten = written !== undefined;
  const isOpenObject = entries.some(isOpenObjectOf);
  const isTransformation = section === "data";
  const input = inputOf(entries, written);
  const choices = choicesOf(entries, pointer, sources);
  const diagnostics = diagnosticsAt(pointer, sources);
  const essentialRank = sources.essentials.get(pointer) ?? null;

  return {
    key: member.name,
    title,
    pointer,
    description,
    input,
    choices,
    required: member.required,
    written: isWritten,
    suggested: !isWritten && isOpenObject && !isTransformation,
    value: written ?? null,
    essentialRank,
    diagnostics,
  };
}

function isOpenObjectOf(entry: SchemaAt): boolean {
  const isObject = entry.types.includes("object");

  return isObject && entry.members.length === 0;
}

function holdsEssentialOf(pointer: string, sources: FieldSources): boolean {
  const below = `${pointer}/`;
  const essentials = [...sources.essentials.keys()];

  return essentials.some((essential) => essential.startsWith(below));
}

function diagnosticsAt(
  pointer: string,
  sources: FieldSources,
): FieldSources["diagnostics"] {
  const below = `${pointer}/`;

  return sources.diagnostics.filter(
    (diagnostic) =>
      diagnostic.pointer === pointer || diagnostic.pointer.startsWith(below),
  );
}

function inputOf(
  entries: readonly SchemaAt[],
  written: JsonValue | undefined,
): FormInput {
  const isDuration = isDurationAt(entries);

  if (isDuration) {
    return "duration";
  }

  const isClosed = entries.length > 0 && entries.every((entry) => entry.closed);

  if (isClosed) {
    return "choice";
  }

  const admitsAny = entries.some((entry) => entry.types.length === 0);
  const types = new Set(entries.flatMap((entry) => entry.types));
  const isTyped = !admitsAny && types.size > 0;
  const isBoolean = isTyped && types.size === 1 && types.has("boolean");
  const isNumber =
    isTyped &&
    [...types].every((type) => type === "number" || type === "integer");

  if (isBoolean) {
    return "boolean";
  }

  if (isNumber) {
    return "number";
  }

  const admitsString = admitsAny || types.has("string");
  const isTextual = written === undefined || typeof written === "string";

  if (admitsString && isTextual) {
    return "text";
  }

  const [entry] = entries;
  const isGroupable = entries.length === 1 && entry !== undefined;
  const hasMembers = isGroupable && entry.members.length > 0;
  const isObjectWritten = written === undefined || isJsonObject(written);

  if (hasMembers && isObjectWritten) {
    return "group";
  }

  return "structured";
}

function choicesOf(
  entries: readonly SchemaAt[],
  pointer: string,
  sources: FieldSources,
): readonly JsonValue[] {
  const values = entries.flatMap((entry) => entry.values);
  const suggested = sources.suggestions.get(pointer) ?? [];
  const choices = [...values, ...suggested];

  return choices.filter((choice, index) => choices.indexOf(choice) === index);
}

function sectionOf(key: string): FormSection {
  return memberSections.get(key) ?? ownMemberSections.get(key) ?? "settings";
}
