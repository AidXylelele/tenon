import { readdirSync, readFileSync } from "node:fs";
import { expect, test } from "vitest";
import { parse } from "yaml";
import type { DiagnosticCode, Imports, Position } from "../../src/api/index.js";
import type { Diagnostic, HostProfile, JsonValue } from "../../src/index.js";
import { fullProfile, interpreter } from "../support/interpreter.js";

interface ExpectedDiagnostic {
  readonly code: DiagnosticCode;
  readonly pointer: string;
  readonly subject?: string | null;
  readonly message?: string;
  readonly range?: { readonly start: Position };
  readonly import?: Diagnostic["import"];
}

interface DiagnosticCase {
  readonly source?: string;
  readonly value?: JsonValue;
  readonly profile?: Partial<HostProfile>;
  readonly imports?: Imports;
  readonly diagnostics?: readonly ExpectedDiagnostic[];
}

const folder = import.meta.dirname;

const names = readdirSync(folder, { recursive: true, encoding: "utf8" })
  .filter((file) => file.endsWith(".yaml"))
  .map((file) => file.slice(0, -".yaml".length))
  .toSorted((left, right) => left.localeCompare(right));

function caseOf(name: string): DiagnosticCase {
  const text = readFileSync(`${folder}/${name}.yaml`, "utf8");

  return parse(text) as DiagnosticCase;
}

function diagnosticsOf(content: DiagnosticCase): readonly Diagnostic[] {
  const source = content.source ?? content.value ?? null;
  const profile = { ...fullProfile, ...content.profile };
  const imports = content.imports ?? {};
  const compilation = interpreter.compile(source, { profile, imports });

  if (compilation.kind === "compiled") {
    return [];
  }

  return compilation.diagnostics;
}

test.each(names)("%s", (name) => {
  const content = caseOf(name);
  const diagnostics = diagnosticsOf(content);
  const expected = content.diagnostics ?? [];

  expect(diagnostics).toMatchObject(expected);
});
