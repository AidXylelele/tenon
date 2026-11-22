import type { Failure, StepVariant } from "language-server/protocol";

export type GroupId = "common" | "decide" | "code" | "events" | "developers";

export type EntryId = StepVariant | "retry" | "start";

export type EntryIcon =
  | "globe"
  | "split"
  | "repeat"
  | "braces"
  | "timer"
  | "file-code"
  | "rotate-cw"
  | "calendar-clock"
  | "git-fork"
  | "square-stack"
  | "shield"
  | "terminal"
  | "container"
  | "workflow"
  | "inbox"
  | "send"
  | "octagon-x"
  | "book-open"
  | "wrench"
  | "plug"
  | "radio-tower"
  | "bot";

export type EntryAction =
  | { readonly kind: "insertStep"; readonly variant: StepVariant }
  | { readonly kind: "setFailure"; readonly failure: Failure }
  | { readonly kind: "changeStart" };

export interface EntryWords {
  readonly title: string;
  readonly description: string;
}

export interface CatalogEntry extends EntryWords {
  readonly id: EntryId;
  readonly example: string;
  readonly synonyms: readonly string[];
  readonly languageTerm: string;
  readonly icon: EntryIcon;
  readonly action: EntryAction;
}

export interface CatalogGroup {
  readonly id: GroupId;
  readonly title: string;
  readonly entries: readonly CatalogEntry[];
}

export interface ShownEntry {
  readonly entry: CatalogEntry;
  readonly termMatched: boolean;
}

export interface ShownGroup {
  readonly id: GroupId;
  readonly title: string;
  readonly open: boolean;
  readonly entries: readonly ShownEntry[];
}

export interface NoMatch {
  readonly message: string;
  readonly hint: string;
}
