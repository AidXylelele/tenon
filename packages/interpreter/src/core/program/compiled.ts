import {
  type CompiledExpression,
  type ExpressionLanguage,
  type SchemaCompiler,
  type Validator,
  InterpreterError,
} from "../../runtime/index.js";
import type { Expression, Term } from "../forms/index.js";
import { heldExpressionsOf } from "./expressions/index.js";
import type { Keyed, SchemaDocument } from "./types.js";

export function compiledExpressionsOf(
  terms: readonly Term[],
  language: ExpressionLanguage,
): ReadonlyMap<string, CompiledExpression> {
  const held = terms.flatMap(heldExpressionsOf);
  const conflict = conflictOf(held);

  if (conflict !== undefined) {
    throw new InterpreterError(
      `Two different expressions share the id '${conflict}'.`,
    );
  }

  const entries = held.map(
    (expression) => [expression.id, expression] as const,
  );
  const unique = [...new Map(entries).values()];
  const compiled = unique.map((expression) =>
    compiledExpressionOf(expression, language),
  );

  return new Map(compiled);
}

export function validatorsOf(
  documents: ReadonlyMap<string, SchemaDocument>,
  compiler: SchemaCompiler,
): ReadonlyMap<string, Validator> {
  const schemas = [...documents.values()];
  const origins = schemas.map((schema) => [schema.origin, schema] as const);
  const unique = [...new Map(origins).values()];
  const compiled = unique.map((schema) => validatorOf(schema, compiler));
  const byOrigin = new Map(compiled);
  const entries = [...documents].map((entry) => validatorAt(entry, byOrigin));

  return new Map(entries);
}

function conflictOf(held: readonly Expression[]): string | undefined {
  const signatures = held.map(
    (expression) => [expression.id, signatureOf(expression)] as const,
  );
  const byId = new Map(signatures);
  const differing = held.find(
    (expression) => byId.get(expression.id) !== signatureOf(expression),
  );

  return differing?.id;
}

function signatureOf(expression: Expression): string {
  const names = expression.arguments.map((argument) => argument.name);
  return JSON.stringify([expression.source, names]);
}

function compiledExpressionOf(
  expression: Expression,
  language: ExpressionLanguage,
): Keyed<CompiledExpression> {
  const id = expression.id;
  const names = expression.arguments.map((argument) => argument.name);
  const compilation = language.compile(expression.source, names);

  switch (compilation.kind) {
    case "compiled":
      return [id, compilation.expression];
    case "invalid":
      throw new InterpreterError(
        `The expression '${id}' does not compile: ${compilation.message}`,
      );
    case "unknown-variable":
      throw new InterpreterError(
        `The expression '${id}' does not compile: no argument is named '${compilation.variable}'.`,
      );
  }
}

function validatorOf(
  schema: SchemaDocument,
  compiler: SchemaCompiler,
): Keyed<Validator> {
  const origin = schema.origin;
  const compilation = compiler.compile(schema.document);

  switch (compilation.kind) {
    case "compiled":
      return [origin, compilation.validator];
    case "invalid":
      throw new InterpreterError(
        `The schema of '${origin}' does not compile: ${compilation.message}`,
      );
  }
}

function validatorAt(
  entry: Keyed<SchemaDocument>,
  byOrigin: ReadonlyMap<string, Validator>,
): Keyed<Validator> {
  const [id, schema] = entry;
  const validator = byOrigin.get(schema.origin);

  if (validator === undefined) {
    throw new InterpreterError(`The schema '${id}' has no compiled origin.`);
  }

  return [id, validator];
}
