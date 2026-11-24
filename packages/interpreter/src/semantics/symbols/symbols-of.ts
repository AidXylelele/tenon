import type { Imports } from "../../api/index.js";
import type { GrammarCheck, Workflow } from "../../syntax/index.js";
import { workflowOccurrencesOf } from "../occurrences/index.js";
import { catalogFindingsOf } from "./catalogs.js";
import { componentTableOf, referencesOf } from "./component-table.js";
import { FunctionImports } from "./function-imports.js";
import { labelTablesOf } from "./label-tables.js";
import { recursionFindingsOf } from "./recursion.js";
import { schemaImportsOf } from "./schema-imports.js";
import type { SymbolAnalysis, Symbols } from "./types.js";

export function symbolsOf(
  workflow: Workflow,
  imports: Imports,
  grammar: GrammarCheck,
): SymbolAnalysis {
  const written = workflowOccurrencesOf(workflow);
  const functionImports = new FunctionImports(workflow.use, imports, grammar);
  const calls = written.filter((occurrence) => occurrence.kind === "call");
  const linking = functionImports.linkedOf(calls);

  const components = componentTableOf(workflow.use, linking.functions);
  const occurrences = [...written, ...linking.occurrences];
  const lists = occurrences.filter((occurrence) => occurrence.kind === "list");
  const labelling = labelTablesOf(lists, components.functions);
  const resolution = referencesOf(occurrences, components);
  const schemas = schemaImportsOf(occurrences, imports);

  const symbols: Symbols = {
    components,
    labels: labelling.labels,
    jumps: labelling.jumps,
    references: resolution.references,
    schemas: schemas.schemas,
  };
  const catalogs = catalogFindingsOf(workflow.use);
  const passes = [linking, labelling, resolution];
  const found = passes.flatMap((pass) => pass.findings);
  const recursion = recursionFindingsOf(occurrences, symbols);
  const findings = [...catalogs, ...found, ...recursion, ...schemas.findings];

  return { symbols, occurrences, findings };
}
