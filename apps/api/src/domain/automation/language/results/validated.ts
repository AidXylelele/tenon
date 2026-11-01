import type { WorkflowError } from '../workflow-error.js';
import { ValidationResult } from './validation-result.js';

export class Validated extends ValidationResult {
  failure(): WorkflowError | null {
    return null;
  }
}
