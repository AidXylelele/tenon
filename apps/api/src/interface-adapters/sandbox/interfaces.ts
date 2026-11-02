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

export interface SandboxRefused {
  readonly kind: SandboxOutcomeKind.Refused;
}

export type SandboxOutcome =
  | SandboxRan
  | SandboxRejected
  | SandboxTimedOut
  | SandboxUnreachable
  | SandboxRefused;

export abstract class SandboxClient {
  abstract run(command: GoJudgeCommand): Promise<SandboxOutcome>;
}
