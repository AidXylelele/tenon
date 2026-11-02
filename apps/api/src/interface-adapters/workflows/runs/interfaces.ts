import type { JsonObject } from '../../../domain/automation/language/interfaces.js';
import type { RoundProgressKind } from './enums.js';

export interface InstanceRunInput {
  readonly instanceId: string;
}

export interface InstanceRun {
  readonly id: string;
  readonly input: InstanceRunInput;
}

export interface RoundProgress {
  readonly kind: RoundProgressKind;
  readonly wakeAt: number | null;
  readonly subWorkflows: readonly string[];
}

export interface EngineTime {
  now(): number;
}

export abstract class RunClient {
  abstract start(run: InstanceRun): Promise<void>;
}

export abstract class PlatformRuntime {
  abstract readonly descriptor: JsonObject;
}
