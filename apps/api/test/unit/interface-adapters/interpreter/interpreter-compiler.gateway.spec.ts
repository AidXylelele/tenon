import type { Diagnostic, JsonObject } from "interpreter";
import { ImportRefusal } from "../../../../src/application/automation/imports/enums.js";
import type { ImportResult } from "../../../../src/application/automation/imports/interfaces.js";
import { ImportFetcher } from "../../../../src/application/automation/imports/ports.js";
import type { ImportTexts } from "../../../../src/domain/automation/workflows/interfaces.js";
import { InterpreterCompilerGateway } from "../../../../src/interface-adapters/interpreter/interpreter-compiler.gateway.js";
import type {
  CompilationData,
  InterpreterClient,
} from "../../../../src/interface-adapters/interpreter/interfaces.js";
import { DefinitionMapper } from "../../../../src/interface-adapters/interpreter/mappers/definition.mapper.js";
import { ProtocolMapper } from "../../../../src/interface-adapters/interpreter/mappers/protocol.mapper.js";

const LIBRARY = "https://imports.test/library.yaml";
const LIBRARY_TEXT = "document: { dsl: 1.0.0 }";
const REFUSED = "The address is not allowed";

class ScriptedCompilations {
  readonly imports: ImportTexts[] = [];

  constructor(
    private readonly answer: (imports: ImportTexts) => CompilationData,
  ) {}

  compile(
    _source: JsonObject | string,
    _secrets: readonly string[],
    imports: ImportTexts,
  ): Promise<CompilationData> {
    this.imports.push(imports);
    const compilation = this.answer(imports);
    return Promise.resolve(compilation);
  }
}

class ScriptedImports extends ImportFetcher {
  readonly fetched: string[] = [];

  constructor(private readonly reachable: boolean) {
    super();
  }

  fetch(uri: string): Promise<ImportResult> {
    this.fetched.push(uri);

    if (this.reachable)
      return Promise.resolve({ ok: true, value: { text: LIBRARY_TEXT } });

    return Promise.resolve({
      ok: false,
      failure: { refusal: ImportRefusal.Misconfigured, detail: REFUSED },
    });
  }
}

function compiled(document: JsonObject): CompilationData {
  return {
    kind: "compiled",
    manifest: {
      identity: {
        namespace: "acme",
        name: "orders",
        version: "1.0.0",
        dsl: "1.0.0",
      },
      effects: [],
      secrets: [],
      schedules: [],
    },
    fingerprint: "program-1",
    digest: "digest-1",
    document,
  };
}

function unresolved(reference: string): Diagnostic {
  return {
    code: "unresolved-import",
    message: `The import ${reference} is not resolved.`,
    pointer: `/use/functions/${reference}`,
    range: null,
    subject: null,
    import: { reference, uri: `https://imports.test/${reference}.yaml` },
  };
}

function gatewayOf(
  compilations: ScriptedCompilations,
  imports: ScriptedImports,
): InterpreterCompilerGateway {
  return new InterpreterCompilerGateway(
    compilations as unknown as InterpreterClient,
    imports,
    new ProtocolMapper(),
    new DefinitionMapper(),
  );
}

describe("the compilation of a definition by the interpreter", () => {
  it("an_unresolved_import_is_fetched_and_compiled_with_the_document", async () => {
    const document = { document: { name: "orders" } };
    const compilations = new ScriptedCompilations((imports) =>
      Object.hasOwn(imports, "library")
        ? compiled(document)
        : { kind: "refused", diagnostics: [unresolved("library")] },
    );
    const imports = new ScriptedImports(true);
    const gateway = gatewayOf(compilations, imports);

    const result = await gateway.compile(document, []);
    const resolved = result.ok ? result.value.imports : null;

    expect(imports.fetched).toEqual([LIBRARY]);
    expect(resolved).toEqual({ library: LIBRARY_TEXT });
  });

  it("an_import_that_cannot_be_fetched_is_refused_with_its_reason", async () => {
    const document = { document: { name: "orders" } };
    const compilations = new ScriptedCompilations(() => ({
      kind: "refused",
      diagnostics: [unresolved("library")],
    }));
    const imports = new ScriptedImports(false);
    const gateway = gatewayOf(compilations, imports);

    const result = await gateway.compile(document, []);

    expect(imports.fetched).toEqual([LIBRARY]);
    expect(compilations.imports).toHaveLength(2);
    expect(result).toEqual({
      ok: false,
      failure: [
        expect.objectContaining({
          code: "unresolved-import",
          detail: `Import 'library' could not be fetched: ${REFUSED}`,
        }),
      ],
    });
  });

  it("a_document_that_needs_more_than_64_imports_fetches_none", async () => {
    const document = { document: { name: "orders" } };
    const references = Array.from(
      { length: 65 },
      (_, at) => `lib-${String(at)}`,
    );
    const diagnostics = references.map((reference) => unresolved(reference));
    const compilations = new ScriptedCompilations(() => ({
      kind: "refused",
      diagnostics,
    }));
    const imports = new ScriptedImports(true);
    const gateway = gatewayOf(compilations, imports);

    const result = await gateway.compile(document, []);

    expect(imports.fetched).toEqual([]);
    expect(result.ok).toBe(false);
  });
});
