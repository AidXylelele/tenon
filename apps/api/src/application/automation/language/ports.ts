import type { Definition } from '../../../domain/automation/language/definition.js';
import type { Expression } from '../../../domain/automation/language/expression.js';
import type { Validation } from '../../../domain/automation/language/interfaces.js';
import type { ValidationResult } from '../../../domain/automation/language/results/validation-result.js';

export abstract class DefinitionReader {
  abstract read(text: string): Definition;
}

export abstract class ExpressionEvaluator {
  abstract check(expressions: readonly Expression[]): Promise<void>;
}

export abstract class SchemaValidator {
  abstract validateAll(
    validations: readonly Validation[],
  ): Promise<readonly ValidationResult[]>;
}
