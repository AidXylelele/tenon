import { z } from 'zod';
import type { Item } from '../../../application/interfaces.js';
import { CORE_SETTINGS } from '../core-settings.js';
import { ItemPath } from '../item-path.js';
import type { NodeResult, NodeRun, NodeType } from '../node-type.js';

const parameters = z.strictObject({
  mode: z
    .enum(['fields', 'allData'])
    .default('fields')
    .meta({ title: 'Aggregate' }),
  fields: z
    .array(
      z.strictObject({
        field: z.string().min(1).meta({ title: 'Field' }),
        rename: z.string().min(1).optional().meta({ title: 'Output name' }),
      }),
    )
    .default([])
    .meta({ title: 'Fields to aggregate' }),
  destination: z
    .string()
    .min(1)
    .default('data')
    .meta({ title: 'Output field' }),
  keepMissing: z
    .boolean()
    .default(false)
    .meta({ title: 'Keep missing values' }),
});

type AggregateParameters = z.infer<typeof parameters>;

type AggregatedField = AggregateParameters['fields'][number];

export class AggregateNode implements NodeType<AggregateParameters> {
  readonly id = 'aggregate';
  readonly version = 1;
  readonly kind = 'transform';
  readonly trigger = null;
  readonly category = 'Transform';
  readonly displayName = 'Aggregate';
  readonly description =
    'Combines fields or whole items of all items into a single item';
  readonly parameters = parameters;
  readonly inputs = ['main'];
  readonly outputsParameter = null;
  readonly credentialTypes = [];
  readonly defaultSettings = CORE_SETTINGS;
  readonly fixedParameters = [];

  outputsFor(): readonly string[] {
    return ['main'];
  }

  execute(run: NodeRun<AggregateParameters>): NodeResult {
    if (run.items.length === 0) return { main: [] };

    const settings = run.parameters();
    const aggregated =
      settings.mode === 'allData'
        ? { [settings.destination]: [...run.items] }
        : this.aggregatedFields(run.items, settings);

    return { main: [aggregated] };
  }

  private aggregatedFields(
    items: readonly Item[],
    settings: AggregateParameters,
  ): Item {
    const entries = settings.fields.map((aggregated): [string, unknown[]] => [
      this.nameOf(aggregated),
      this.valuesOf(items, aggregated.field, settings.keepMissing),
    ]);
    return Object.fromEntries(entries);
  }

  private nameOf(aggregated: AggregatedField): string {
    if (aggregated.rename !== undefined) return aggregated.rename;

    const nameStart = aggregated.field.lastIndexOf('.') + 1;
    return aggregated.field.slice(nameStart);
  }

  private valuesOf(
    items: readonly Item[],
    field: string,
    keepMissing: boolean,
  ): unknown[] {
    const path = new ItemPath(field, true);
    const values: unknown[] = [];

    for (const item of items) {
      const value = path.read(item);

      if (value === undefined && !keepMissing) continue;

      const kept = value ?? null;
      values.push(kept);
    }

    return values;
  }
}
