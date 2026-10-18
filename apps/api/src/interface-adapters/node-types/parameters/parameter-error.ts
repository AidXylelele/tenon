export class ParameterError extends Error {
  readonly parameter: string;
  readonly limit: boolean;

  constructor(parameter: string, message: string, limit: boolean) {
    super(message);
    this.name = 'ParameterError';
    this.parameter = parameter;
    this.limit = limit;
  }
}
