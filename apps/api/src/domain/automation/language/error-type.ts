const STANDARD_ERRORS = 'https://serverlessworkflow.io/spec/1.0.0/errors';

export class ErrorType {
  static readonly CONFIGURATION = new ErrorType('configuration', 400);
  static readonly VALIDATION = new ErrorType('validation', 400);
  static readonly EXPRESSION = new ErrorType('expression', 400);
  static readonly AUTHENTICATION = new ErrorType('authentication', 401);
  static readonly AUTHORIZATION = new ErrorType('authorization', 403);
  static readonly TIMEOUT = new ErrorType('timeout', 408);
  static readonly COMMUNICATION = new ErrorType('communication', 500);
  static readonly RUNTIME = new ErrorType('runtime', 500);

  readonly #kind: string;
  readonly #status: number;

  private constructor(kind: string, status: number) {
    this.#kind = kind;
    this.#status = status;
  }

  get uri(): string {
    return `${STANDARD_ERRORS}/${this.#kind}`;
  }

  get status(): number {
    return this.#status;
  }
}
