import { z } from 'zod';
import { CORE_SETTINGS } from '../core-settings.js';
import type { NodeResult, NodeRun, NodeType } from '../node-type.js';

const parameters = z.strictObject({
  maxItems: z.number().int().min(1).default(1).meta({ title: 'Max items' }),
  keep: z.enum(['first', 'last']).default('first').meta({ title: 'Keep' }),
});

type LimitParameters = z.infer<typeof parameters>;

export class LimitNode implements NodeType<LimitParameters> {
  readonly id = 'limit';
  readonly version = 1;
  readonly kind = 'transform';
  readonly trigger = null;
  readonly category = 'Transform';
  readonly displayName = 'Limit';
  readonly description = 'Keeps only the first or last items up to a maximum';
  readonly parameters = parameters;
  readonly inputs = ['main'];
  readonly outputsParameter = null;
  readonly credentialTypes = [];
  readonly defaultSettings = CORE_SETTINGS;
  readonly fixedParameters = [];

  outputsFor(): readonly string[] {
    return ['main'];
  }

  execute(run: NodeRun<LimitParameters>): NodeResult {
    const { maxItems, keep } = run.parameters();

    if (keep === 'last') return { main: run.items.slice(-maxItems) };

    return { main: run.items.slice(0, maxItems) };
  }
}
