import type {
  CleanupPolicy,
  ProcessKind,
  PullPolicy,
  ScriptLanguage,
} from "../../standard/index.js";
import type { Duration, TextTemplate, ValueTemplate } from "./data.js";
import type { ExternalResource } from "./endpoints.js";

export interface ContainerProcess {
  readonly kind: "container";
  readonly pointer: string;
  readonly image: TextTemplate;
  readonly name: TextTemplate | null;
  readonly command: TextTemplate | null;
  readonly ports: ValueTemplate | null;
  readonly volumes: ValueTemplate | null;
  readonly environment: ValueTemplate | null;
  readonly stdin: TextTemplate | null;
  readonly arguments: ValueTemplate | null;
  readonly lifetime: ContainerLifetime;
  readonly pullPolicy: PullPolicy;
}

interface AlwaysCleanup {
  readonly kind: "always";
  readonly pointer: string;
}

interface NeverCleanup {
  readonly kind: "never";
  readonly pointer: string;
}

export interface EventualCleanup {
  readonly kind: "eventually";
  readonly pointer: string;
  readonly after: Duration;
}

interface ContainerLifetimes {
  readonly always: AlwaysCleanup;
  readonly never: NeverCleanup;
  readonly eventually: EventualCleanup;
}

export type ContainerLifetime = ContainerLifetimes[CleanupPolicy];

export interface ScriptProcess {
  readonly kind: "script";
  readonly pointer: string;
  readonly language: ScriptLanguage;
  readonly source: InlineCode | ExternalResource;
  readonly stdin: TextTemplate | null;
  readonly arguments: ValueTemplate | null;
  readonly environment: ValueTemplate | null;
}

export interface InlineCode {
  readonly kind: "inline";
  readonly pointer: string;
  readonly code: string;
}

export interface ShellProcess {
  readonly kind: "shell";
  readonly pointer: string;
  readonly command: TextTemplate;
  readonly stdin: TextTemplate | null;
  readonly arguments: ValueTemplate | null;
  readonly directory: TextTemplate | null;
  readonly environment: ValueTemplate | null;
}

export interface WorkflowProcess {
  readonly kind: "workflow";
  readonly pointer: string;
  readonly namespace: string;
  readonly name: string;
  readonly version: string;
  readonly input: ValueTemplate | null;
}

interface Processes {
  readonly container: ContainerProcess;
  readonly script: ScriptProcess;
  readonly shell: ShellProcess;
  readonly workflow: WorkflowProcess;
}

export type Process = Processes[ProcessKind];
