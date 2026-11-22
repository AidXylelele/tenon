import type { Result } from "../../../domain/interfaces.js";
import type { ImportRefusal } from "./enums.js";

export interface FetchImportCommand {
  readonly uri: string;
}

export interface FetchedImport {
  readonly text: string;
}

export interface ImportFailure {
  readonly refusal: ImportRefusal;
  readonly detail: string;
}

export type ImportResult = Result<FetchedImport, ImportFailure>;
