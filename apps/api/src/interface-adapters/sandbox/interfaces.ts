import type { SandboxOutcomeKind } from './enums.js';

export abstract class SandboxLimits {
  abstract readonly seconds: number;
  abstract readonly memoryBytes: number;
  abstract readonly processes: number;
  abstract readonly outputBytes: number;
}

export interface GoJudgeFile {
  readonly content?: string;
  readonly name?: string;
  readonly max?: number;
}

export interface GoJudgeCommand {
  readonly args: readonly string[];
  readonly env: readonly string[];
  readonly files: readonly GoJudgeFile[];
  readonly cpuLimit: number;
  readonly clockLimit: number;
  readonly memoryLimit: number;
  readonly procLimit: number;
  readonly copyIn: Readonly<Record<string, GoJudgeFile>>;
}

export interface GoJudgeResult {
  readonly status: string;
  readonly exitStatus?: number;
  readonly error?: string;
  readonly files?: Readonly<Record<string, string>>;
}

export interface SandboxRan {
  readonly kind: SandboxOutcomeKind.Ran;
  readonly result: GoJudgeResult;
}

export interface SandboxRejected {
  readonly kind: SandboxOutcomeKind.Rejected;
}

export interface SandboxTimedOut {
  readonly kind: SandboxOutcomeKind.TimedOut;
}

export interface SandboxUnreachable {
  readonly kind: SandboxOutcomeKind.Unreachable;
}

// An answer that is not the sandbox's (a proxy's page, a gateway status): an outage.
export interface SandboxUnrecognized {
  readonly kind: SandboxOutcomeKind.Unrecognized;
}

// An answer larger than its bound, which repeating the run would only repeat.
export interface SandboxOversized {
  readonly kind: SandboxOutcomeKind.Oversized;
}

// go-judge's own refusal of this command (400, 404 or 500 with its message).
export interface SandboxFailure {
  readonly kind: SandboxOutcomeKind.Failed;
}

export type SandboxOutcome =
  | SandboxRan
  | SandboxRejected
  | SandboxTimedOut
  | SandboxUnreachable
  | SandboxUnrecognized
  | SandboxOversized
  | SandboxFailure;

export abstract class SandboxClient {
  abstract run(command: GoJudgeCommand): Promise<SandboxOutcome>;
}
