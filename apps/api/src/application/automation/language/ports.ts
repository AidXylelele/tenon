import type { Definition } from '../../../domain/automation/language/definition.js';
import type { Expression } from '../../../domain/automation/language/expression.js';
import type {
  Evaluation,
  Validation,
} from '../../../domain/automation/language/interfaces.js';
import type { EvaluationResult } from '../../../domain/automation/language/results/evaluation-result.js';
import type { ValidationResult } from '../../../domain/automation/language/results/validation-result.js';
import type { Schema } from '../../../domain/automation/language/schema.js';
import type { SourceDocument } from '../../../domain/automation/workflows/source-document.js';

export abstract class DefinitionReader {
  abstract read(source: SourceDocument): Promise<Definition>;
}

export abstract class ExpressionEvaluator {
  abstract check(expressions: readonly Expression[]): Promise<void>;
  abstract evaluateAll(
    evaluations: readonly Evaluation[],
  ): Promise<readonly EvaluationResult[]>;
}

export abstract class Clock {
  abstract now(): Date;

  // The milliseconds left until `deadline`; null when there is none.
  remainingUntil(deadline: Date | null): number | null {
    if (deadline === null) return null;

    const now = this.now();
    return deadline.getTime() - now.getTime();
  }
}

export abstract class SchemaValidator {
  abstract check(schemas: readonly Schema[]): Promise<void>;
  abstract validateAll(
    validations: readonly Validation[],
  ): Promise<readonly ValidationResult[]>;
}
