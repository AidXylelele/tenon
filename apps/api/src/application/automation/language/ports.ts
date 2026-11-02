import type { Definition } from '../../../domain/automation/language/definition.js';
import type { Expression } from '../../../domain/automation/language/expression.js';
import type {
  Evaluation,
  Validation,
} from '../../../domain/automation/language/interfaces.js';
import type { EvaluationResult } from '../../../domain/automation/language/results/evaluation-result.js';
import type { ValidationResult } from '../../../domain/automation/language/results/validation-result.js';
import type { Schema } from '../../../domain/automation/language/schema.js';

export abstract class DefinitionReader {
  abstract read(text: string): Promise<Definition>;
}

export abstract class ExpressionEvaluator {
  abstract check(expressions: readonly Expression[]): Promise<void>;
  abstract evaluateAll(
    evaluations: readonly Evaluation[],
  ): Promise<readonly EvaluationResult[]>;
}

export abstract class Clock {
  abstract now(): Date;
}

export abstract class SchemaValidator {
  abstract check(schemas: readonly Schema[]): Promise<void>;
  abstract validateAll(
    validations: readonly Validation[],
  ): Promise<readonly ValidationResult[]>;
}
