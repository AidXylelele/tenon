import type { Definition } from '../../../domain/automation/language/definition.js';
import type { Expression } from '../../../domain/automation/language/expression.js';

export abstract class DefinitionReader {
  abstract read(text: string): Definition;
}

export abstract class ExpressionEvaluator {
  abstract check(expressions: readonly Expression[]): Promise<void>;
}
