import {
  type Binding,
  flowDirectives,
  type JsonValue,
  type Position,
  type Range,
  type SchemaAt,
  type SchemaMember,
  type SemanticModel,
} from "interpreter/front-end";
import { bindingNounOf, variableAt } from "../expressions/index.js";
import { membersOf, referenceTableAt } from "../places/index.js";
import {
  isJsonObject,
  parentPointerOf,
  valueAt,
  withValueAt,
} from "../pointers/index.js";
import { sourceOf } from "../snapshot/index.js";
import {
  directiveAt,
  listNamesOf,
  stepHolding,
  type StepTree,
  stepTreeOf,
} from "../steps/index.js";
import { lineTextAt, offsetOf } from "../text/index.js";
import { inlineYamlOf } from "../yaml-text/index.js";
import type {
  CompletionCandidate,
  CompletionReads,
  Completions,
  SpeculativeCopies,
  Speculation,
} from "./interfaces.js";

const completionMarker = "workflowCompletionMarker";

const wordStop = /[\s:,[\]{}"']/g;

const keyLead = /^ *(- +)?$/;

const booleans: readonly JsonValue[] = [true, false];

const none: readonly CompletionCandidate[] = [];

export function completionsAt(
  text: string,
  position: Position,
  reads: CompletionReads,
): Completions {
  const range = wordRangeOf(text, position);
  const isKeyFirst = startsAKey(text, range);
  const { asKey, asValue } = speculativeCopiesOf(text, position);
  const copies = isKeyFirst ? [asKey, asValue] : [asValue, asKey];
  const speculation = firstReadOf(copies, position, reads);

  if (speculation === null) {
    return { range, items: none };
  }

  const items = candidatesOf(speculation, reads);
  return { range, items };
}

function wordRangeOf(text: string, position: Position): Range {
  const line = lineTextAt(text, position);
  const end = position.column - 1;
  const before = line.slice(0, end);
  const stops = [...before.matchAll(wordStop)];
  const lastStop = stops.at(-1);
  const start = lastStop === undefined ? 0 : lastStop.index + 1;
  const wordStart = { line: position.line, column: start + 1 };

  return { start: wordStart, end: position };
}

function startsAKey(text: string, word: Range): boolean {
  const line = lineTextAt(text, word.start);
  const lead = line.slice(0, word.start.column - 1);

  return keyLead.test(lead);
}

function speculativeCopiesOf(
  text: string,
  position: Position,
): SpeculativeCopies {
  const offset = offsetOf(text, position);
  const before = text.slice(0, offset);
  const after = text.slice(offset);
  const asValue = `${before}${completionMarker}${after}`;
  const asKey = `${before}${completionMarker}:${after}`;

  return { asKey, asValue };
}

function firstReadOf(
  copies: readonly string[],
  position: Position,
  reads: CompletionReads,
): Speculation | null {
  for (const copy of copies) {
    const speculation = speculationOf(copy, position, reads);

    if (speculation !== null) {
      return speculation;
    }
  }

  return null;
}

function speculationOf(
  text: string,
  position: Position,
  reads: CompletionReads,
): Speculation | null {
  const analysis = reads.speculate(text);
  const source = sourceOf(analysis);
  const place = source?.positions?.pointerAt(position) ?? null;

  if (source === null || place === null) {
    return null;
  }

  return { text, position, analysis, source, place };
}

function candidatesOf(
  speculation: Speculation,
  reads: CompletionReads,
): readonly CompletionCandidate[] {
  const { place, source } = speculation;

  switch (place.part) {
    case "key":
      return memberCandidatesOf(source.document, place.pointer, reads);
    case "value":
      return valueCandidatesOf(speculation, reads);
  }
}

function memberCandidatesOf(
  document: JsonValue,
  pointer: string,
  reads: CompletionReads,
): readonly CompletionCandidate[] {
  const object = parentPointerOf(pointer);
  const entries = reads.schemasAt(document, object);
  const members = membersOf(entries);
  const holder = valueAt(document, object);
  const written = writtenNamesOf(holder);
  const open = members.filter((member) => !written.has(member.name));

  return open.map(memberCandidateOf);
}

function writtenNamesOf(holder: JsonValue | undefined): ReadonlySet<string> {
  const isObject = isJsonObject(holder);

  if (!isObject) {
    return new Set();
  }

  const names = Object.keys(holder);
  return new Set(names);
}

function memberCandidateOf(member: SchemaMember): CompletionCandidate {
  return {
    label: member.name,
    insert: `${member.name}: `,
    kind: "member",
    description: member.description,
  };
}

function valueCandidatesOf(
  speculation: Speculation,
  reads: CompletionReads,
): readonly CompletionCandidate[] {
  const { analysis, source, place } = speculation;
  const named =
    analysis.kind === "analyzed"
      ? namedCandidatesOf(speculation, analysis.model, reads)
      : null;

  if (named !== null) {
    return named;
  }

  const entries = reads.schemasAt(source.document, place.pointer);
  const values = valuesOf(entries);

  return values.map(valueCandidateOf);
}

function namedCandidatesOf(
  speculation: Speculation,
  model: SemanticModel,
  reads: CompletionReads,
): readonly CompletionCandidate[] | null {
  const { text, source, place, position } = speculation;
  const pointer = place.pointer;
  const tree = stepTreeOf(model.workflow);
  const reading = { text, source, semantics: { model, tree } };
  const variable = variableAt(reading, pointer, position);

  if (variable !== null) {
    const scope = [...variable.resolution.scope];
    return scope.map(([name, binding]) => variableCandidateOf(name, binding));
  }

  const directive = directiveAt(tree, pointer);

  if (directive !== null) {
    const names = listNamesAt(tree, pointer);
    return directiveCandidatesOf(names);
  }

  const table = referenceTableAt(model, pointer);

  if (table === null) {
    return null;
  }

  const declared = [...model.symbols.components[table].keys()];
  const names = declared.map(nameCandidateOf);
  const isCall = table === "functions";

  if (!isCall) {
    return names;
  }

  const kinds = callKindCandidatesOf(speculation, reads);
  return [...kinds, ...names];
}

function callKindCandidatesOf(
  speculation: Speculation,
  reads: CompletionReads,
): readonly CompletionCandidate[] {
  const { source, place } = speculation;
  const task = parentPointerOf(place.pointer);

  return reads.profile.effects.flatMap((effect) => {
    const called = withValueAt(source.document, place.pointer, effect);
    const calls = reads.schemasAt(called, place.pointer);
    const isCallKind = calls.some((entry) => entry.values.includes(effect));

    if (!isCallKind) {
      return [];
    }

    const tasks = reads.schemasAt(called, task);
    const described = tasks.find((entry) => entry.description !== null);
    const description = described?.description ?? null;
    const candidate: CompletionCandidate = {
      label: effect,
      insert: effect,
      kind: "value",
      description,
    };
    return [candidate];
  });
}

function listNamesAt(tree: StepTree, pointer: string): readonly string[] {
  const owner = stepHolding(tree, pointer);

  if (owner === null) {
    return [];
  }

  return listNamesOf(tree, owner);
}

function directiveCandidatesOf(
  names: readonly string[],
): readonly CompletionCandidate[] {
  const directives = flowDirectives.map((directive): CompletionCandidate => ({
    label: directive,
    insert: directive,
    kind: "directive",
    description: null,
  }));
  const steps = names.map(nameCandidateOf);

  return [...directives, ...steps];
}

function nameCandidateOf(name: string): CompletionCandidate {
  const insert = inlineYamlOf(name);

  return { label: name, insert, kind: "name", description: null };
}

function valuesOf(entries: readonly SchemaAt[]): readonly JsonValue[] {
  const listed = entries.flatMap((entry) => entry.values);
  const types = new Set(entries.flatMap((entry) => entry.types));
  const isBoolean = types.size === 1 && types.has("boolean");
  const values = isBoolean ? [...listed, ...booleans] : listed;
  const byText = values.map((value) => [JSON.stringify(value), value] as const);
  const distinct = new Map(byText);

  return [...distinct.values()];
}

function valueCandidateOf(value: JsonValue): CompletionCandidate {
  const insert = inlineYamlOf(value);

  return { label: insert, insert, kind: "value", description: null };
}

function variableCandidateOf(
  name: string,
  binding: Binding,
): CompletionCandidate {
  const label = "$" + name;
  const description = bindingNounOf(binding);

  return { label, insert: label, kind: "variable", description };
}
