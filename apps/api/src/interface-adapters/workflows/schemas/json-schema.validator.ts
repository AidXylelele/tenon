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
  constructor(private readonly client: JsonSchemaClient) {}

  check(schemas: readonly Schema[]): Promise<void> {
    for (const schema of schemas) {
      const compilation = this.client.compile(schema.document);

      if (compilation.kind === JsonSchemaOutcomeKind.Unusable) {
        const error = new InvalidSchemaError(
          schema.pointer,
          compilation.reason,
        );
        return Promise.reject(error);
      }
    }

    return Promise.resolve();
  }

  validateAll(
    validations: readonly Validation[],
  ): Promise<readonly ValidationResult[]> {
    const results = validations.map((validation) => this.#validate(validation));
    return Promise.resolve(results);
  }

  #validate(validation: Validation): ValidationResult {
    const verdict = this.client.validate(validation.schema, validation.data);

    switch (verdict.kind) {
      case JsonSchemaOutcomeKind.Valid:
        return new Validated(validation.id);
      case JsonSchemaOutcomeKind.Invalid:
        return new ValidationFailed(validation.id, verdict.reason);
      case JsonSchemaOutcomeKind.Unusable:
        return new SchemaUnusable(validation.id);
    }
  }
}
