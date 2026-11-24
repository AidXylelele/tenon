import { Injectable } from "@nestjs/common";
import type { FetchImportCommand, ImportResult } from "./interfaces.js";
import { ImportFetcher } from "./ports.js";

@Injectable()
export class FetchImport {
  constructor(private readonly imports: ImportFetcher) {}

  execute(command: FetchImportCommand): Promise<ImportResult> {
    return this.imports.fetch(command.uri);
  }
}
