import type { JqOutcomeKind } from './enums.js';

export interface JqCompiled {
  readonly kind: JqOutcomeKind.Compiled;
}

export interface JqFailure {
  readonly kind: JqOutcomeKind.Failure;
  readonly failure: string;
}

export type JqCompilation = JqCompiled | JqFailure;

export abstract class JqClient {
  abstract compile(program: string): Promise<JqCompilation>;
}
