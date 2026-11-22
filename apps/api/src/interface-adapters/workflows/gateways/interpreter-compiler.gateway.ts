import { Injectable } from "@nestjs/common";
import type { Diagnostic, JsonObject as ProtocolObject } from "interpreter";
import { ImportFetcher } from "../../../application/automation/imports/ports.js";
import { DefinitionRefusal } from "../../../application/automation/workflows/enums.js";
import type {
  DefinitionFailure,
  DefinitionSource,
} from "../../../application/automation/workflows/interfaces.js";
import type { DefinitionCompiler } from "../../../application/automation/workflows/ports.js";
import type { Secret } from "../../../domain/automation/secrets/secret.js";
import type { CheckedDefinition } from "../../../domain/automation/workflows/checked-definition.js";
import type { ImportTexts } from "../../../domain/automation/workflows/interfaces.js";
import type { Result } from "../../../domain/interfaces.js";
import {
  type FetchedImportText,
  InterpreterClient,
  type NeededImport,
  type ResolvedCompilation,
} from "../interfaces.js";
import { DefinitionMapper } from "../mappers/definition.mapper.js";
import { ProtocolMapper } from "../mappers/protocol.mapper.js";

@Injectable()
export class InterpreterCompilerGateway implements DefinitionCompiler {
  private static readonly UNRESOLVED_IMPORT = "unresolved-import";
  private static readonly MOST_IMPORTS = 64;
  private static readonly NO_IMPORTS: ImportTexts = {};
  private static readonly NO_FAILURES: ReadonlyMap<string, string> = new Map();

  constructor(
    private readonly client: InterpreterClient,
    private readonly fetcher: ImportFetcher,
    private readonly protocol: ProtocolMapper,
    private readonly definitions: DefinitionMapper,
  ) {}

  async compile(
    authored: DefinitionSource,
    secrets: readonly Secret[],
  ): Promise<Result<CheckedDefinition, DefinitionFailure>> {
    const source = this.#compiledSourceOf(authored);
    const names = secrets.map((secret) => secret.name);
    const resolved = await this.#resolved(
      source,
      names,
      InterpreterCompilerGateway.NO_IMPORTS,
      InterpreterCompilerGateway.NO_FAILURES,
    );
    const compilation = resolved.compilation;

    if (compilation.kind === "expired")
      return { ok: false, failure: DefinitionRefusal.Expired };

    if (compilation.kind === "refused") {
      const problems = this.definitions.toProblems(
        compilation.diagnostics,
        resolved.failures,
      );
      return { ok: false, failure: problems };
    }

    return this.definitions.toDefinition(compilation, resolved.imports);
  }

  async #resolved(
    source: ProtocolObject | string,
    names: readonly string[],
    imports: ImportTexts,
    failures: ReadonlyMap<string, string>,
  ): Promise<ResolvedCompilation> {
    const compilation = await this.client.compile(source, names, imports);
    const settled = { compilation, imports, failures };

    if (compilation.kind !== "refused") return settled;

    const needed = this.#neededOf(compilation.diagnostics, imports, failures);
    const count = Object.keys(imports).length + needed.length;

    if (needed.length === 0 || count > InterpreterCompilerGateway.MOST_IMPORTS)
      return settled;

    const fetched = await Promise.all(
      needed.map((wanted) => this.#fetchedOf(wanted)),
    );
    const texts = fetched.flatMap((each) =>
      each.text === null ? [] : [[each.reference, each.text] as const],
    );
    const refused = fetched.flatMap((each) =>
      each.reason === null ? [] : [[each.reference, each.reason] as const],
    );
    const more = { ...imports, ...Object.fromEntries(texts) };
    const failed = new Map([...failures, ...refused]);
    return this.#resolved(source, names, more, failed);
  }

  #neededOf(
    diagnostics: readonly Diagnostic[],
    imports: ImportTexts,
    failures: ReadonlyMap<string, string>,
  ): readonly NeededImport[] {
    const needed = new Map<string, string>();

    for (const diagnostic of diagnostics) {
      const wanted = diagnostic.import;
      const unresolved =
        diagnostic.code === InterpreterCompilerGateway.UNRESOLVED_IMPORT;

      if (!unresolved || wanted === null || wanted.uri === null) continue;

      const reference = wanted.reference;
      const known =
        Object.hasOwn(imports, reference) || failures.has(reference);

      if (!known) needed.set(reference, wanted.uri);
    }

    return Array.from(needed, ([reference, uri]) => ({ reference, uri }));
  }

  async #fetchedOf(wanted: NeededImport): Promise<FetchedImportText> {
    const fetched = await this.fetcher.fetch(wanted.uri);
    const reference = wanted.reference;

    if (fetched.ok)
      return { reference, text: fetched.value.text, reason: null };

    return { reference, text: null, reason: fetched.failure.detail };
  }

  #compiledSourceOf(authored: DefinitionSource): ProtocolObject | string {
    if (typeof authored === "string") return authored;

    return this.protocol.toObject(authored);
  }
}
