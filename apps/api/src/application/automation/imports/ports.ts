import type { ImportResult } from "./interfaces.js";

export abstract class ImportFetcher {
  abstract fetch(uri: string): Promise<ImportResult>;
}
