import type {
  JsonObject,
  JsonValue,
} from '../../../domain/automation/language/interfaces.js';
import type { JqOutcomeKind } from './enums.js';

export interface JqCompiled {
  readonly kind: JqOutcomeKind.Compiled;
}

export interface JqEvaluated {
  readonly kind: JqOutcomeKind.Evaluated;
  readonly values: readonly JsonValue[];
}

export interface JqFailure {
  readonly kind: JqOutcomeKind.Failure;
  readonly failure: string;
}

// The program outlasted its time limit.
export interface JqTimedOut {
  readonly kind: JqOutcomeKind.TimedOut;
}

// jq exhausted the memory it may use.
export interface JqAborted {
  readonly kind: JqOutcomeKind.Aborted;
}

export type JqCompilation = JqCompiled | JqFailure | JqTimedOut | JqAborted;

export type JqEvaluation = JqEvaluated | JqFailure | JqTimedOut | JqAborted;

export abstract class JqClient {
  abstract compile(program: string): Promise<JqCompilation>;
  abstract evaluate(
    program: string,
    data: JsonValue,
    variables: JsonObject,
  ): Promise<JqEvaluation>;
}
