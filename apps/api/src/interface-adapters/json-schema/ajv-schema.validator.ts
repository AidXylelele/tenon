import { Injectable } from '@nestjs/common';
import type { Ajv, AnySchema, ValidateFunction } from 'ajv';
import type { Ajv2019 } from 'ajv/dist/2019.js';
import type { Ajv2020 } from 'ajv/dist/2020.js';
import { SchemaValidator } from '../../application/automation/language/ports.js';
import type {
  JsonObject,
  Validation,
} from '../../domain/automation/language/interfaces.js';
import { Validated } from '../../domain/automation/language/results/validated.js';
import { ValidationFailed } from '../../domain/automation/language/results/validation-failed.js';
import type { ValidationResult } from '../../domain/automation/language/results/validation-result.js';
import { JsonSchemaCompilers } from './interfaces.js';

@Injectable()
export class AjvSchemaValidator implements SchemaValidator {
  private static readonly DRAFT_2019 =
    'https://json-schema.org/draft/2019-09/schema';
  private static readonly DRAFT_2020 =
    'https://json-schema.org/draft/2020-12/schema';
  private static readonly UNUSABLE = 'The schema is not a valid JSON Schema';

  constructor(private readonly compilers: JsonSchemaCompilers) {}

  validateAll(
    validations: readonly Validation[],
  ): Promise<readonly ValidationResult[]> {
    const results = validations.map((validation) => this.#validate(validation));
    return Promise.resolve(results);
  }

  #validate(validation: Validation): ValidationResult {
    const validate = this.#compiled(validation.schema);

    if (validate === null)
      return new ValidationFailed(validation.id, AjvSchemaValidator.UNUSABLE);

    const valid = validate(validation.data);

    if (valid) return new Validated(validation.id);

    const reason = this.compilers.draft07.errorsText(validate.errors, {
      dataVar: 'value',
    });
    return new ValidationFailed(validation.id, reason);
  }

  #compiled(schema: JsonObject): ValidateFunction | null {
    const document: AnySchema = schema;

    const compiler = this.#compilerFor(schema);

    try {
      return compiler.compile(document);
    } catch {
      return null;
    }
  }

  #compilerFor(schema: JsonObject): Ajv | Ajv2019 | Ajv2020 {
    const dialect = schema.$schema;

    if (
      typeof dialect === 'string' &&
      dialect.startsWith(AjvSchemaValidator.DRAFT_2020)
    )
      return this.compilers.draft2020;

    if (
      typeof dialect === 'string' &&
      dialect.startsWith(AjvSchemaValidator.DRAFT_2019)
    )
      return this.compilers.draft2019;

    return this.compilers.draft07;
  }
}
