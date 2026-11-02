import { Injectable } from '@nestjs/common';
import { SchemaValidator } from '../../../application/automation/language/ports.js';
import type { Validation } from '../../../domain/automation/language/interfaces.js';
import { SchemaUnusable } from '../../../domain/automation/language/results/schema-unusable.js';
import { Validated } from '../../../domain/automation/language/results/validated.js';
import { ValidationFailed } from '../../../domain/automation/language/results/validation-failed.js';
import type { ValidationResult } from '../../../domain/automation/language/results/validation-result.js';
import type { Schema } from '../../../domain/automation/language/schema.js';
import { InvalidSchemaError } from '../../../domain/errors.js';
import { JsonSchemaOutcomeKind } from './enums.js';
import { JsonSchemaClient } from './interfaces.js';

@Injectable()
export class JsonSchemaValidator implements SchemaValidator {
  private static readonly NOT_A_SCHEMA =
    'The schema is not a valid JSON Schema';
  private static readonly OUT_OF_TIME =
    'The schema could not be checked in time';

  constructor(private readonly client: JsonSchemaClient) {}

  async check(schemas: readonly Schema[]): Promise<void> {
    for (const schema of schemas) {
      const compilation = await this.client.compile(schema.document);

      if (compilation.kind === JsonSchemaOutcomeKind.Unusable)
        throw new InvalidSchemaError(schema.pointer, compilation.reason);

      if (compilation.kind === JsonSchemaOutcomeKind.TimedOut)
        throw new InvalidSchemaError(
          schema.pointer,
          JsonSchemaValidator.OUT_OF_TIME,
        );
    }
  }

  validateAll(
    validations: readonly Validation[],
  ): Promise<readonly ValidationResult[]> {
    const results = validations.map((validation) => this.#validate(validation));
    return Promise.all(results);
  }

  async #validate(validation: Validation): Promise<ValidationResult> {
    const verdict = await this.client.validate(
      validation.schema,
      validation.data,
    );

    switch (verdict.kind) {
      case JsonSchemaOutcomeKind.Valid:
        return new Validated(validation.id);
      case JsonSchemaOutcomeKind.Invalid:
        return new ValidationFailed(validation.id, verdict.reason);
      case JsonSchemaOutcomeKind.Unusable:
        return new SchemaUnusable(
          validation.id,
          JsonSchemaValidator.NOT_A_SCHEMA,
        );
      case JsonSchemaOutcomeKind.TimedOut:
        return new SchemaUnusable(
          validation.id,
          JsonSchemaValidator.OUT_OF_TIME,
        );
    }
  }
}
