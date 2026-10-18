import type { DateTime } from 'luxon';
import type { z } from 'zod';
import type {
  Item,
  Recurrence,
  WebhookSettings,
} from '../../application/interfaces.js';
import type { TriggerType } from '../../domain/enums.js';
import type { NodeParameters, NodeSettings } from '../../domain/interfaces.js';

export type NodeKind = 'trigger' | 'action' | 'transform';

export type NodeResult = Readonly<Record<string, readonly Item[]>>;

export interface StepLimits {
  readonly items: number;
  readonly bytes: number;
}

export interface NodeRun<P = Record<string, unknown>> {
  readonly items: readonly Item[];
  readonly limits: StepLimits;
  readonly timezone: string;
  readonly now: DateTime;
  input(port: string): readonly Item[];
  parameters(): P;
  parametersOf(index: number): P;
}

export interface NodeType<P = unknown> {
  readonly id: string;
  readonly version: number;
  readonly kind: NodeKind;
  readonly trigger: TriggerType | null;
  readonly category: string;
  readonly displayName: string;
  readonly description: string;
  readonly parameters: z.ZodType<P>;
  readonly inputs: readonly string[];
  readonly outputsParameter: string | null;
  readonly credentialTypes: readonly string[];
  readonly defaultSettings: NodeSettings;
  readonly fixedParameters: readonly string[];
  outputsFor(parameters: Readonly<Record<string, unknown>>): readonly string[];
  execute(run: NodeRun<P>): NodeResult | Promise<NodeResult>;
  webhookOf?(parameters: NodeParameters): WebhookSettings | null;
  schedulesOf?(parameters: NodeParameters): Recurrence[];
}
