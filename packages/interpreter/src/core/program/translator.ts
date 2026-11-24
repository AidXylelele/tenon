import type {
  ExpressionLanguage,
  SchemaCompiler,
} from "../../runtime/index.js";
import type { SemanticModel } from "../../semantics/index.js";
import {
  Context,
  proceduresOf,
  schemaOf,
  triggersOf,
  workflowFlowOf,
} from "../desugar/index.js";
import type { Program, SchemaTerm, Term } from "../forms/index.js";
import { compiledExpressionsOf, validatorsOf } from "./compiled.js";
import { fingerprintOf } from "./fingerprint.js";
import { manifestOf } from "./manifest.js";
import { compiledPatternsOf } from "./patterns.js";
import { programSourceOf, schemaDocumentsOf, sourcesOf } from "./sources.js";
import { stateFormatVersion } from "./state-format.js";
import { programTermsOf } from "./term-folds.js";
import type { Sources } from "./types.js";

type Compiled = Pick<Program, "expressions" | "schemas" | "patterns">;

export class Translator {
  readonly #expressions: ExpressionLanguage;
  readonly #schemas: SchemaCompiler;

  constructor(expressions: ExpressionLanguage, schemas: SchemaCompiler) {
    this.#expressions = expressions;
    this.#schemas = schemas;
  }

  translate(model: SemanticModel): Program {
    const context = Context.rootOf(model, this.#expressions);
    const workflow = model.workflow;
    const root = workflowFlowOf(workflow, context);
    const input = this.#inputOf(workflow, context);
    const triggers = triggersOf(workflow.schedules, context);
    const procedures = proceduresOf([root]);
    const bodies = [...procedures.values()].map(({ body }) => body);
    const roots = [root, ...bodies, ...triggers];
    const terms = programTermsOf(roots);
    const sources = sourcesOf(model);
    const compiled = this.#compiledOf(terms, sources);
    const manifest = manifestOf(terms, context, compiled.patterns);
    const printed = { root, procedures, triggers, manifest };
    const source = programSourceOf(terms, sources);
    const fingerprint = fingerprintOf(printed, source, stateFormatVersion);
    const definition = context.definitions.document;

    return {
      root,
      input,
      procedures,
      triggers,
      expressions: compiled.expressions,
      schemas: compiled.schemas,
      patterns: compiled.patterns,
      definition,
      manifest,
      fingerprint,
    };
  }

  #inputOf(
    workflow: SemanticModel["workflow"],
    context: Context,
  ): SchemaTerm | null {
    const schema = workflow.input.schema;

    if (schema === null) {
      return null;
    }

    return schemaOf(schema, context);
  }

  #compiledOf(terms: readonly Term[], sources: Sources): Compiled {
    const expressions = compiledExpressionsOf(terms, this.#expressions);
    const documents = schemaDocumentsOf(terms, sources);
    const schemas = validatorsOf(documents, this.#schemas);
    const patterns = compiledPatternsOf(terms);

    return { expressions, schemas, patterns };
  }
}
