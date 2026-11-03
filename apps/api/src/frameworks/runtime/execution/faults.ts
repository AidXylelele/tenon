import type { JsonObject } from '../../../domain/automation/json.js';
import type { JsonPointer } from '../document/json-pointer.js';

// The standard's error types (DSL 1.0.3, "Standard Error Types") with their default status.
export enum ErrorKind {
  Configuration = 'configuration',
  Validation = 'validation',
  Expression = 'expression',
  Authentication = 'authentication',
  Authorization = 'authorization',
  Timeout = 'timeout',
  Communication = 'communication',
  Runtime = 'runtime',
}

// A DSL error raised while a task runs: the instance faults with it unless a `try` catches it.
export class TaskFault extends Error {
  static readonly #BASE = 'https://serverlessworkflow.io/spec/1.0.0/errors/';
  static readonly #STATUS = new Map<ErrorKind, number>([
    [ErrorKind.Configuration, 400],
    [ErrorKind.Validation, 400],
    [ErrorKind.Expression, 400],
    [ErrorKind.Authentication, 401],
    [ErrorKind.Authorization, 403],
    [ErrorKind.Timeout, 408],
    [ErrorKind.Communication, 500],
    [ErrorKind.Runtime, 500],
  ]);
  static readonly #TITLE = new Map<ErrorKind, string>([
    [ErrorKind.Configuration, 'Configuration Error'],
    [ErrorKind.Validation, 'Validation Error'],
    [ErrorKind.Expression, 'Expression Error'],
    [ErrorKind.Authentication, 'Authentication Error'],
    [ErrorKind.Authorization, 'Authorization Error'],
    [ErrorKind.Timeout, 'Timeout Error'],
    [ErrorKind.Communication, 'Communication Error'],
    [ErrorKind.Runtime, 'Runtime Error'],
  ]);

  readonly error: JsonObject;

  constructor(error: JsonObject) {
    const title = error.title ?? error.type;
    super(typeof title === 'string' ? title : 'Workflow error');
    this.error = error;
  }

  static of(
    kind: ErrorKind,
    at: JsonPointer,
    detail: string,
    status: number | null = null,
  ): TaskFault {
    const type = `${TaskFault.#BASE}${kind}`;
    const title = TaskFault.#TITLE.get(kind) ?? kind;
    const fallback = TaskFault.#STATUS.get(kind) ?? 500;
    const instance = at.toString();
    return new TaskFault({
      type,
      status: status ?? fallback,
      title,
      detail,
      instance,
    });
  }
}

// A fault a retry policy accepted: the engine repeats the step. It keeps only an error's name
// and message, so the message carries the fault.
export class RetryableFault extends Error {
  readonly error: JsonObject;

  constructor(error: JsonObject) {
    super(JSON.stringify(error));
    this.name = 'RetryableFault';
    this.error = error;
  }
}

// No capacity is free for the work now (a bulkhead is full): the engine repeats the step later.
export class CapacityExhaustedError extends Error {
  constructor() {
    super('No capacity is free for the work now');
    this.name = 'CapacityExhaustedError';
  }
}
