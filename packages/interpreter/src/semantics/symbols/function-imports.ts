import type { Import, Imports, JsonValue } from "../../api/index.js";
import { InterpreterError } from "../../runtime/index.js";
import {
  elaborateTask,
  type Finding,
  type FunctionCall,
  type GrammarCheck,
  readSource,
  type Use,
} from "../../syntax/index.js";
import {
  type CallOccurrence,
  functionOccurrencesOf,
} from "../occurrences/index.js";
import { calleeOf } from "./callee.js";
import {
  dynamicCatalogCallOf,
  nameFindingOf,
  unresolvedImportOf,
} from "./findings.js";
import type {
  FunctionLinking,
  ImportedFunction,
  ImportReading,
  Named,
} from "./types.js";

const none: readonly Finding[] = [];
const unfetched: ImportReading = { kind: "unfetched" };
const invalid: ImportReading = { kind: "invalid" };

export class FunctionImports {
  readonly #use: Use;
  readonly #fetched: ReadonlyMap<string, string>;
  readonly #grammar: GrammarCheck;

  constructor(use: Use, imports: Imports, grammar: GrammarCheck) {
    const fetched = Object.entries(imports);

    this.#use = use;
    this.#fetched = new Map(fetched);
    this.#grammar = grammar;
  }

  linkedOf(calls: readonly CallOccurrence[]): FunctionLinking {
    const unread: ReadonlyMap<string, ImportReading> = new Map();
    const readings = this.#readingsOf(calls, unread);
    const all = [...readings.values()];
    const read = all.filter((reading) => reading.kind === "read");

    const functions = read.map(
      (reading) => [reading.function.name, reading.function] as const,
    );
    const occurrences = read.flatMap((reading) => reading.occurrences);
    const imported = occurrences.filter(
      (occurrence) => occurrence.kind === "call",
    );
    const sites = [...calls, ...imported];
    const findings = sites.flatMap((site) => this.#findingsOf(site, readings));

    return { functions: new Map(functions), occurrences, findings };
  }

  #readingsOf(
    calls: readonly CallOccurrence[],
    readings: ReadonlyMap<string, ImportReading>,
  ): ReadonlyMap<string, ImportReading> {
    return calls.reduce(
      (known, call) => this.#readingsAfter(call, known),
      readings,
    );
  }

  #readingsAfter(
    site: CallOccurrence,
    readings: ReadonlyMap<string, ImportReading>,
  ): ReadonlyMap<string, ImportReading> {
    const callee = calleeOf(site.call.function.name, this.#use);

    switch (callee.kind) {
      case "imported":
        return this.#importReadingsAfter(callee.import, site, readings);
      case "declared":
      case "unlinked":
      case "undeclaredFunction":
      case "undeclaredCatalog":
        return readings;
    }
  }

  #importReadingsAfter(
    imported: Import,
    site: CallOccurrence,
    readings: ReadonlyMap<string, ImportReading>,
  ): ReadonlyMap<string, ImportReading> {
    const isRead = readings.has(imported.reference);

    if (isRead) {
      return readings;
    }

    const reading = this.#readingOf(imported, site.task);
    const entry = [imported.reference, reading] as const;
    const readingEntries = [...readings, entry];
    const next = new Map(readingEntries);

    switch (reading.kind) {
      case "unfetched":
      case "invalid":
        return next;
      case "read": {
        const calls = reading.occurrences.filter(
          (occurrence) => occurrence.kind === "call",
        );
        return this.#readingsOf(calls, next);
      }
    }
  }

  #readingOf(imported: Import, site: string): ImportReading {
    const text = this.#fetched.get(imported.reference);

    if (text === undefined) {
      return unfetched;
    }

    const reading = readSource(text);

    switch (reading.kind) {
      case "unreadable":
        return invalid;
      case "read":
        return this.#taskReadingOf(imported, reading.source.document, site);
    }
  }

  #taskReadingOf(
    imported: Import,
    definition: JsonValue,
    site: string,
  ): ImportReading {
    const pointer = `${imported.reference}#`;
    const violations = this.#grammar.taskFindingsOf(definition, pointer);

    if (violations.length > 0) {
      return invalid;
    }

    const task = elaborateTask(imported.reference, definition, pointer);
    const body: ImportedFunction = {
      origin: "imported",
      name: imported.reference,
      task,
      site,
      definition,
    };
    const occurrences = functionOccurrencesOf(task, imported.reference);

    return { kind: "read", function: body, occurrences };
  }

  #findingsOf(
    site: CallOccurrence,
    readings: ReadonlyMap<string, ImportReading>,
  ): readonly Finding[] {
    const call = site.call;
    const callee = calleeOf(call.function.name, this.#use);

    switch (callee.kind) {
      case "declared":
        return none;
      case "unlinked":
        return [dynamicCatalogCallOf(call, callee.catalog)];
      case "undeclaredFunction":
        return [
          nameFindingOf(
            "undeclaredFunction",
            "undeclared-component",
            call.function,
          ),
        ];
      case "undeclaredCatalog": {
        const catalog: Named = { pointer: call.pointer, name: callee.catalog };
        return [
          nameFindingOf("undeclaredCatalog", "undeclared-component", catalog),
        ];
      }
      case "imported":
        return this.#importFindingsOf(call, callee.import, readings);
    }
  }

  #importFindingsOf(
    call: FunctionCall,
    imported: Import,
    readings: ReadonlyMap<string, ImportReading>,
  ): readonly Finding[] {
    const reading = readings.get(imported.reference);
    const named: Named = { pointer: call.pointer, name: imported.reference };

    if (reading === undefined) {
      throw new InterpreterError(
        `The import '${imported.reference}' is checked before it is read.`,
      );
    }

    switch (reading.kind) {
      case "read":
        return none;
      case "unfetched":
        return [unresolvedImportOf(call, imported)];
      case "invalid":
        return [nameFindingOf("importNotTask", "invalid-import", named)];
    }
  }
}
