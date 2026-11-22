import type { FormField, Step } from "language-server/protocol";
import type {
  CallKind,
  FormKind,
  FormLayout,
  RunKind,
  WordsKind,
} from "./interfaces";
import { hasWords, wordsOf } from "./words";

const SUMMARY_LIMIT = 3;

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
  const ownRest = restsOf(own, place);
  const commonRest = restsOf(common, place);
  const notesRest = restsOf(notes, place);
  const more = ownRest.concat(commonRest, notesRest);
  const data = restsOf(inData, place);
  const failure = restsOf(inFailure, place);

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
  if (field.essentialRank !== null) return [];

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
  const written = fields.filter((field) => field.written);
  const titles = written.map((field) => {
    const path = pathOf(field, base);
    const words = wordsOf(kind, path, field);
    return words.title;
  });
  const shown = titles.slice(0, SUMMARY_LIMIT);
  const hidden = titles.length - shown.length;
  const more = hidden > 0 ? [`${String(hidden)} more`] : [];
  const parts = shown.concat(more);

  return parts.length > 0 ? parts.join(" · ") : unwritten;
}
