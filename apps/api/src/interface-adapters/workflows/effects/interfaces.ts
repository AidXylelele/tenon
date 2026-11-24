import type { JsonValue, ProcessOutcome } from "interpreter";
import type { StepCall } from "../interfaces.js";

export interface CallContext extends StepCall {
  readonly remaining: number | null;
}

export interface SandboxLimitsProps {
  readonly time: Temporal.Duration;
  readonly memoryBytes: number;
  readonly processes: number;
  readonly outputBytes: number;
}

export interface ScriptLanguage {
  readonly interpreter: string;
  declares(name: string): boolean;
  declarationOf(name: string, value: JsonValue): string;
}

export interface SandboxFile {
  readonly content?: string;
  readonly name?: string;
  readonly max?: number;
}

export interface SandboxCommand {
  readonly args: readonly string[];
  readonly env: readonly string[];
  readonly files: readonly SandboxFile[];
  readonly cpuLimit: number;
  readonly clockLimit: number;
  readonly memoryLimit: number;
  readonly procLimit: number;
  readonly copyIn: Readonly<Record<string, SandboxFile>>;
}

export type BuiltCommand =
  | { readonly kind: "command"; readonly command: SandboxCommand }
  | ProcessOutcome;
