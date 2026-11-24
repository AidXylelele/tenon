import { HTTP_ENTRY } from "./catalog";
import type {
  CatalogEntry,
  CatalogGroup,
  GroupId,
  NoMatch,
  ShownEntry,
  ShownGroup,
} from "./interfaces";

const OPEN_AT_FIRST: GroupId = "common";

const MESSAGING_WORDS: readonly string[] = [
  "slack",
  "teams",
  "discord",
  "mail",
  "chat",
];

const MESSAGING_HINT = `Tenon has no Slack or email step: post to their incoming-webhook address with “${HTTP_ENTRY.title}”.`;

const SEARCH_HINT = "Try “http”, “if”, “loop”, “wait” or “script”.";

export function shownGroupsOf(
  catalog: readonly CatalogGroup[],
  query: string,
  opened: ReadonlySet<GroupId>,
): readonly ShownGroup[] {
  const words = wordsOf(query);

  const groups = catalog.map((group) => shownGroupOf(group, words, opened));
  return groups.filter((group) => group.entries.length > 0);
}

export function keyboardOrderOf(
  groups: readonly ShownGroup[],
): readonly ShownEntry[] {
  const open = groups.filter((group) => group.open);
  return open.flatMap((group) => group.entries);
}

export function noMatchOf(query: string): NoMatch {
  const typed = query.trim();
  const searched = typed.toLowerCase();
  const messaging = MESSAGING_WORDS.some((word) => searched.includes(word));

  const message = `No kind of step matches “${typed}”.`;
  const hint = messaging ? MESSAGING_HINT : SEARCH_HINT;
  return { message, hint };
}

export function foundText(count: number): string {
  if (count === 0) return "No kind of step matches";
  if (count === 1) return "1 kind of step";
  return `${String(count)} kinds of step`;
}

function shownGroupOf(
  group: CatalogGroup,
  words: readonly string[],
  opened: ReadonlySet<GroupId>,
): ShownGroup {
  const searching = words.length > 0;
  const open = searching || group.id === OPEN_AT_FIRST || opened.has(group.id);

  const matching = group.entries.filter((entry) => matches(entry, words));
  const entries = matching.map((entry) => shownEntryOf(entry, words));
  return { id: group.id, title: group.title, open, entries };
}

function matches(entry: CatalogEntry, words: readonly string[]): boolean {
  const synonyms = entry.synonyms.join(" ");
  const searched = `${entry.title} ${entry.languageTerm} ${synonyms}`;
  return holdsEvery(searched, words);
}

function shownEntryOf(
  entry: CatalogEntry,
  words: readonly string[],
): ShownEntry {
  const searching = words.length > 0;
  const inTerm = holdsEvery(entry.languageTerm, words);

  const termMatched = searching && inTerm;
  return { entry, termMatched };
}

function holdsEvery(text: string, words: readonly string[]): boolean {
  const lowered = text.toLowerCase();
  return words.every((word) => lowered.includes(word));
}

function wordsOf(query: string): readonly string[] {
  const lowered = query.trim().toLowerCase();
  const split = lowered.split(/\s+/);
  return split.filter((word) => word !== "");
}
