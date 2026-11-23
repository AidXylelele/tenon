import type { FormField, Step } from "language-server/protocol";
import type {
  CallKind,
  FormKind,
  FormLayout,
  RunKind,
  WordsKind,
} from "./interfaces";
import { isObject } from "./json";
import { timeLimitOf } from "./time-limit";
import { hasWords, wordsOf } from "./words";

const SUMMARY_LIMIT = 3;

const TIME_LIMIT = "timeout";

const TIME_LIMIT_WORDS = "Time limit";

const COMMON_KEYS: ReadonlySet<string> = new Set(["if", "then"]);

const CALL_KINDS: readonly CallKind[] = [
  "http",
  "openapi",
  "grpc",
  "asyncapi",
  "mcp",
  "a2a",
];

const RUN_KINDS: readonly RunKind[] = [
  "script",
  "shell",
  "container",
  "workflow",
];

export function formKindOf(
  kind: Step["kind"],
  fields: readonly FormField[],
): FormKind {
  if (kind === "call") return callKindOf(fields);

  if (kind === "run") return runKindOf(fields);

  return kind;
}

function callKindOf(fields: readonly FormField[]): CallKind {
  const call = fields.find((field) => field.key === "call");
  const known = CALL_KINDS.find((kind) => kind === call?.value);

  return known ?? "function";
}

function runKindOf(fields: readonly FormField[]): RunKind {
  const run = fields.find((field) => field.key === "run");
  const members = run?.fields ?? [];
  const written = members.filter((member) => member.written);
  const kind = RUN_KINDS.find((each) =>
    written.some((member) => member.key === each),
  );

  return kind ?? "script";
}

export function pathOf(field: FormField, base: string): string {
  const start = base.length + 1;
  return field.pointer.slice(start);
}

export function layoutOf(fields: readonly FormField[], step: Step): FormLayout {
  const kind = formKindOf(step.kind, fields);
  const place = { kind, step };
  const essentials = essentialsOf(fields);
  const settings = fields.filter((field) => field.section === "settings");
  const own = settings.filter((field) => !COMMON_KEYS.has(field.key));
  const common = settings.filter((field) => COMMON_KEYS.has(field.key));
  const notes = fields.filter((field) => field.section === "note");
  const inData = fields.filter((field) => field.section === "data");
  const inFailure = fields.filter((field) => field.section === "failure");
  const limits = inFailure.filter((field) => field.key === TIME_LIMIT);
  const failing = inFailure.filter((field) => field.key !== TIME_LIMIT);
  const ownRest = restsOf(own, place);
  const limitRest = restsOf(limits, place);
  const commonRest = restsOf(common, place);
  const notesRest = restsOf(notes, place);
  const more = ownRest.concat(limitRest, commonRest, notesRest);
  const data = restsOf(inData, place);
  const failure = restsOf(failing, place);

  return { essentials, more, data, failure };
}

interface Place {
  readonly kind: FormKind;
  readonly step: Step;
}

function essentialsOf(fields: readonly FormField[]): FormField[] {
  const ranked = fields.flatMap(rankedOf);
  return ranked.toSorted(byRank);
}

function byRank(one: FormField, other: FormField): number {
  const first = one.essentialRank ?? 0;
  const second = other.essentialRank ?? 0;
  return first - second;
}

function rankedOf(field: FormField): FormField[] {
  if (field.essentialRank !== null) return [field];

  return field.fields.flatMap(rankedOf);
}

function holdsEssentials(field: FormField): boolean {
  return field.fields.some(
    (inner) => inner.essentialRank !== null || holdsEssentials(inner),
  );
}

function restsOf(fields: readonly FormField[], place: Place): FormField[] {
  return fields.flatMap((field) => restOf(field, place));
}

function restOf(field: FormField, place: Place): FormField[] {
  const path = pathOf(field, place.step.pointer);
  const words = wordsOf(place.kind, path, field);

  if (field.essentialRank !== null) return [];

  if (words.control === "hidden") return [];

  if (isFixedChoice(field)) return [];

  if (!holdsEssentials(field)) return [field];

  const offered = field.fields.filter((inner) => isOffered(inner, place));

  return restsOf(offered, place);
}

function isOffered(field: FormField, place: Place): boolean {
  const path = pathOf(field, place.step.pointer);
  const isUnwrittenObject = field.input === "structured" && !field.written;

  return !isUnwrittenObject || hasWords(place.kind, path);
}

function isFixedChoice(field: FormField): boolean {
  const [only] = field.choices;
  const isSingle = field.input === "choice" && field.choices.length === 1;
  return isSingle && field.written && only === field.value;
}

export function summaryOf(
  fields: readonly FormField[],
  kind: WordsKind,
  base: string,
  unwritten: string,
): string {
  const said = fields.flatMap((field) => statementOf(field, kind, base));
  const shown = said.slice(0, SUMMARY_LIMIT);
  const hidden = said.length - shown.length;
  const more = hidden > 0 ? [`${String(hidden)} more`] : [];
  const parts = shown.concat(more);

  return parts.length > 0 ? parts.join(" · ") : unwritten;
}

function statementOf(
  field: FormField,
  kind: WordsKind,
  base: string,
): string[] {
  const path = pathOf(field, base);
  const words = wordsOf(kind, path, field);

  switch (words.control) {
    case "hidden":
      return [];
    case "values":
      return [countedOf(field, words.title)];
    case "seconds":
      return field.written ? [limitText(field)] : [];
    case "value":
    case "data":
    case "condition":
    case "flow":
    case "code":
    case "language":
    case "httpMethod":
    case "cases":
      return field.written ? [words.title] : [];
  }
}

function countedOf(field: FormField, title: string): string {
  const count = isObject(field.value) ? Object.keys(field.value).length : 0;

  if (count === 0) return `No ${title.toLowerCase()}`;

  return `${title}: ${String(count)}`;
}

function limitText(field: FormField): string {
  const seconds = timeLimitOf(field.value);

  if (seconds === null) return TIME_LIMIT_WORDS;

  return `${TIME_LIMIT_WORDS} ${String(seconds)} s`;
}
