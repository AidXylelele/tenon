import type {
  Analysis,
  PointerAt,
  Position,
  Range,
  SourceDocument,
} from "interpreter/front-end";
import type { HostReads } from "../places/index.js";

export interface CompletionCandidate {
  readonly label: string;
  readonly insert: string;
  readonly kind: "member" | "value" | "directive" | "name" | "variable";
  readonly description: string | null;
}

export interface Completions {
  readonly range: Range;
  readonly items: readonly CompletionCandidate[];
}

export interface CompletionReads extends HostReads {
  readonly speculate: (text: string) => Analysis;
}

export interface SpeculativeCopies {
  readonly asKey: string;
  readonly asValue: string;
}

export interface Speculation {
  readonly text: string;
  readonly position: Position;
  readonly analysis: Analysis;
  readonly source: SourceDocument;
  readonly place: PointerAt;
}
