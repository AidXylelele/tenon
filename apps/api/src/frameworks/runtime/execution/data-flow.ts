import type { Specification } from '@openworkflowspec/sdk';
import type { JsonObject, JsonValue } from '../../../domain/automation/json.js';
import type { JsonPointer } from '../document/json-pointer.js';
import { JsonSchemaOutcomeKind } from '../enums.js';
import type { JsonSchemaClient } from '../interfaces.js';
import type { Evaluator } from './evaluator.js';
import { ErrorKind, TaskFault } from './faults.js';

// The standard's data flow (DSL 1.0.3, "Data Flow"): the raw input is validated and transformed
// by `input.from`, the raw output transformed by `output.as` and validated, and `export.as`
// turns the output into the workflow's new context.
export class DataFlow {
  constructor(
    private readonly evaluator: Evaluator,
    private readonly schemas: JsonSchemaClient,
  ) {}

  async input(
    input: Specification.Input | undefined,
    raw: JsonValue,
    args: JsonObject,
    at: JsonPointer,
  ): Promise<JsonValue> {
    if (input === undefined) return raw;

    await this.#validated(input.schema, raw, at, 'input');

    if (input.from === undefined) return raw;

    return this.#transformed(input.from as JsonValue, raw, args, at);
  }

  async output(
    output: Specification.Output | undefined,
    raw: JsonValue,
    args: JsonObject,
    at: JsonPointer,
  ): Promise<JsonValue> {
    if (output === undefined) return raw;

    const transformed =
      output.as === undefined
        ? raw
        : await this.#transformed(output.as as JsonValue, raw, args, at);
    await this.#validated(output.schema, transformed, at, 'output');
    return transformed;
  }

  // The new context, or null when the task exports nothing.
  async export(
    exported: Specification.Export | undefined,
    output: JsonValue,
    args: JsonObject,
    at: JsonPointer,
  ): Promise<JsonObject | null> {
    if (exported?.as === undefined) return null;

    const context = await this.#transformed(
      exported.as as JsonValue,
      output,
      args,
      at,
    );
    const object =
      typeof context === 'object' &&
      context !== null &&
      !Array.isArray(context);

    if (!object)
      throw TaskFault.of(
        ErrorKind.Validation,
        at,
        'The context must be an object',
      );

    await this.#validated(exported.schema, context, at, 'context');
    return context;
  }

  #transformed(
    transformation: JsonValue,
    data: JsonValue,
    args: JsonObject,
    at: JsonPointer,
  ): Promise<JsonValue> {
    if (typeof transformation === 'string')
      return this.evaluator.expression(transformation, data, args, at);

    return this.evaluator.template(transformation, data, args, at);
  }

  async #validated(
    schema: Specification.Schema | undefined,
    value: JsonValue,
    at: JsonPointer,
    subject: string,
  ): Promise<void> {
    const document = (schema as JsonObject | undefined)?.document as
      JsonObject | undefined;

    if (document === undefined) return;

    const verdict = await this.schemas.validate(document, value);

    if (verdict.kind === JsonSchemaOutcomeKind.Valid) return;

    const reason =
      verdict.kind === JsonSchemaOutcomeKind.TimedOut
        ? 'the schema did not finish within its limits'
        : verdict.reason;
    throw TaskFault.of(
      ErrorKind.Validation,
      at,
      `The ${subject} does not match its schema: ${reason}`,
    );
  }
}
