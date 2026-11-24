import type { HostProfile } from "interpreter/front-end";
import type { TextDocuments } from "vscode-languageserver/browser";
import type { TextDocument } from "vscode-languageserver-textdocument";
import type { FetchedImports } from "../ide/imports/index.js";
import type { SchemasAt } from "../ide/places/index.js";
import type { Snapshot } from "../ide/snapshot/index.js";
import type { EditAction } from "../protocol/index.js";
import type { AnalysisHost } from "./analysis-host.js";

export type Phase =
  "starting" | "initializing" | "running" | "failed" | "shutDown";

export type ActionKind = EditAction["kind"];

export interface DocumentState {
  readonly snapshot: Snapshot | null;
  readonly analysed: FetchedImports | null;
  readonly fetched: FetchedImports;
  readonly asked: ReadonlySet<string>;
}

export interface HeldDocuments {
  readonly documents: TextDocuments<TextDocument>;
  readonly host: AnalysisHost;
  readonly schemasAt: SchemasAt;
  readonly profile: HostProfile;
}
