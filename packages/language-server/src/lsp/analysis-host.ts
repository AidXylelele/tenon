import type { Analysis, Analyzer, HostProfile } from "interpreter/front-end";
import type { TextDocument } from "vscode-languageserver-textdocument";
import {
  type FetchedImports,
  fetchedImportsOf,
  type NeededImport,
  withFetchFailures,
} from "../ide/imports/index.js";
import type { Basis, DraftAddress, Snapshot } from "../ide/snapshot/index.js";
import type { DocumentState } from "./interfaces.js";

const nothingFetched: FetchedImports = { texts: {}, failures: {} };

const nothingHeld: DocumentState = {
  snapshot: null,
  analysed: null,
  fetched: nothingFetched,
  asked: new Set(),
};

export class AnalysisHost {
  readonly #analyzer: Analyzer;
  readonly #profile: HostProfile;
  readonly #draft: DraftAddress | null;
  readonly #states = new Map<string, DocumentState>();

  constructor(
    analyzer: Analyzer,
    profile: HostProfile,
    draft: DraftAddress | null,
  ) {
    this.#analyzer = analyzer;
    this.#profile = profile;
    this.#draft = draft;
  }

  snapshotOf(document: TextDocument): Snapshot {
    const uri = document.uri;
    const state = this.#stateOf(uri);
    const held = state.snapshot;
    const fetched = state.fetched;
    const isCurrent =
      held?.version === document.version && state.analysed === fetched;

    if (isCurrent) {
      return held;
    }

    const text = document.getText();
    const options = { profile: this.#profile, imports: fetched.texts };
    const read = this.#analyzer.analyze(text, options);
    const analysis = withFetchFailures(read, fetched.failures);
    const basis = this.#basisOf(document, analysis, held);
    const version = document.version;
    const draft = this.#draft;
    const snapshot = { version, text, analysis, basis, draft };
    const analysed = { ...state, snapshot, analysed: fetched };
    this.#states.set(uri, analysed);

    return snapshot;
  }

  speculate(document: TextDocument, text: string): Analysis {
    const imports = this.#stateOf(document.uri).fetched.texts;
    const options = { profile: this.#profile, imports };

    return this.#analyzer.analyze(text, options);
  }

  analyzeAlone(text: string): Analysis {
    const options = { profile: this.#profile, imports: {} };

    return this.#analyzer.analyze(text, options);
  }

  receive(uri: string, arriving: FetchedImports): void {
    const state = this.#stateOf(uri);
    const fetched = fetchedImportsOf(state.fetched, arriving);
    const received = { ...state, fetched };

    this.#states.set(uri, received);
  }

  unasked(
    uri: string,
    imports: readonly NeededImport[],
  ): readonly NeededImport[] {
    const asked = this.#stateOf(uri).asked;

    return imports.filter((needed) => !asked.has(needed.reference));
  }

  asked(uri: string, imports: readonly NeededImport[]): void {
    const state = this.#stateOf(uri);
    const references = imports.map((needed) => needed.reference);
    const asked = new Set([...state.asked, ...references]);
    const recorded = { ...state, asked };

    this.#states.set(uri, recorded);
  }

  forget(uri: string): void {
    this.#states.delete(uri);
  }

  #stateOf(uri: string): DocumentState {
    return this.#states.get(uri) ?? nothingHeld;
  }

  #basisOf(
    document: TextDocument,
    analysis: Analysis,
    held: Snapshot | null,
  ): Basis | null {
    switch (analysis.kind) {
      case "analyzed":
        return { version: document.version, model: analysis.model };
      case "refused":
        return held?.basis ?? null;
    }
  }
}
