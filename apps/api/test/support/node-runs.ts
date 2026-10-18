import { DateTime } from 'luxon';
import type { Item } from '../../src/application/interfaces.js';
import { NodeExecution } from '../../src/interface-adapters/node-types/node-execution.js';
import type {
  NodeResult,
  NodeType,
} from '../../src/interface-adapters/node-types/node-type.js';
import type { UpstreamItems } from '../../src/interface-adapters/node-types/parameters/resolution-context.js';

export const NOW = DateTime.fromISO('2026-10-16T10:00:00.000Z');

export interface NodeRunInput {
  readonly parameters?: Record<string, unknown>;
  readonly items?: readonly Item[];
  readonly inputs?: Record<string, readonly Item[]>;
  readonly upstream?: readonly UpstreamItems[];
  readonly timezone?: string;
  readonly now?: DateTime;
  readonly limits?: { readonly items: number; readonly bytes: number };
}

export const fixed = (value: unknown) => ({ fixed: value });

export const field = (path: string) => ({ ref: { node: '$item', path } });

export const formula = (source: string) => ({ formula: source });

export const runNode = <P>(
  type: NodeType<P>,
  input: NodeRunInput = {},
): Promise<NodeResult> =>
  Promise.resolve().then(() =>
    type.execute(
      new NodeExecution({
        schema: type.parameters,
        limits: input.limits ?? { items: 10_000, bytes: 16 * 1024 * 1024 },
        parameters: input.parameters ?? {},
        inputs: new Map(
          Object.entries(input.inputs ?? { main: input.items ?? [] }),
        ),
        upstream: input.upstream ?? [],
        firstItemOnly: false,
        now: input.now ?? NOW,
        timezone: input.timezone ?? 'UTC',
        execution: { id: 'run-1', mode: 'test', startedAt: NOW.toISO()! },
        workflow: { id: 'wf-1', name: 'Orders', version: null },
      }),
    ),
  );
