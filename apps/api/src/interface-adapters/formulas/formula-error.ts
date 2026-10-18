export type FormulaErrorCode = 'syntax' | 'scope' | 'evaluation' | 'limit';

export class FormulaError extends Error {
  readonly code: FormulaErrorCode;

  constructor(code: FormulaErrorCode, message: string) {
    super(message);
    this.name = 'FormulaError';
    this.code = code;
  }
}
