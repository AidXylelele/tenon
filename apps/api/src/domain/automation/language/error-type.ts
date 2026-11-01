import type { JsonPointer } from './json-pointer.js';
import { WorkflowError } from './workflow-error.js';

export class ErrorType {
  static readonly #BASE = 'https://serverlessworkflow.io/spec/1.0.0/errors/';

  static readonly Configuration = new ErrorType(
    'configuration',
    400,
    'Configuration Error',
  );
  static readonly Validation = new ErrorType(
    'validation',
    400,
    'Validation Error',
  );
  static readonly Expression = new ErrorType(
    'expression',
    400,
    'Expression Error',
  );
  static readonly Authentication = new ErrorType(
    'authentication',
    401,
    'Authentication Error',
  );
  static readonly Authorization = new ErrorType(
    'authorization',
    403,
    'Authorization Error',
  );
  static readonly Timeout = new ErrorType('timeout', 408, 'Timeout Error');
  static readonly Communication = new ErrorType(
    'communication',
    500,
    'Communication Error',
  );
  static readonly Runtime = new ErrorType('runtime', 500, 'Runtime Error');

  readonly #uri: string;
  readonly #status: number;
  readonly #title: string;

  private constructor(name: string, status: number, title: string) {
    this.#uri = `${ErrorType.#BASE}${name}`;
    this.#status = status;
    this.#title = title;
  }

  errorAt(at: JsonPointer, detail: string | null): WorkflowError {
    return this.errorWithStatus(this.#status, at, detail);
  }

  errorWithStatus(
    status: number,
    at: JsonPointer,
    detail: string | null,
  ): WorkflowError {
    const instance = at.toString();
    return new WorkflowError({
      type: this.#uri,
      status,
      instance,
      title: this.#title,
      detail,
    });
  }
}
