import type { JsonObject } from '../../domain/automation/json.js';
import type { VerdictKind } from './enums.js';

// The identity a document declares, and a fingerprint of its content in canonical JSON.
export interface DefinitionIdentity {
  readonly namespace: string;
  readonly name: string;
  readonly version: string;
  readonly dsl: string;
  readonly fingerprint: string;
}

// The first problem of a document: an RFC 6901 pointer to it and what is wrong.
export interface CheckProblem {
  readonly pointer: string;
  readonly detail: string;
}

export interface DocumentValid {
  readonly kind: VerdictKind.Valid;
  readonly identity: DefinitionIdentity;
}

export interface DocumentInvalid {
  readonly kind: VerdictKind.Invalid;
  readonly problem: CheckProblem;
}

export type CheckVerdict = DocumentValid | DocumentInvalid;

// What the runtime refuses to run, decided before a document is published (FR-002).
export abstract class RuntimeChecks {
  abstract check(document: JsonObject): Promise<CheckVerdict>;
}
