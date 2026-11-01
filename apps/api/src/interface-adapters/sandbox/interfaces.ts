import { Dispatcher } from 'undici';

export abstract class SandboxPool extends Dispatcher {}

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
