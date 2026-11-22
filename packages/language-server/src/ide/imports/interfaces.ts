import type { Imports } from "interpreter/front-end";

export interface NeededImport {
  readonly reference: string;
  readonly uri: string;
}

export type ImportFailures = Readonly<Record<string, string>>;

export interface FetchedImports {
  readonly texts: Imports;
  readonly failures: ImportFailures;
}
