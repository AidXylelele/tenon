import { z } from 'zod';
import type { Item } from '../../../application/interfaces.js';
import { CORE_SETTINGS } from '../core-settings.js';
import { ItemPath } from '../item-path.js';
import type { NodeResult, NodeRun, NodeType } from '../node-type.js';
import { NodeUserError } from '../node-user-error.js';

const parameters = z.strictObject({
  mode: z.enum(['fields', 'random']).default('fields').meta({ title: 'Mode' }),
  fields: z
    .array(
      z.strictObject({
        field: z.string().min(1).meta({ title: 'Field' }),
        order: z
          .enum(['ascending', 'descending'])
          .default('ascending')
          .meta({ title: 'Order' }),
      }),
    )
    .default([])
    .meta({ title: 'Fields to sort by' }),
});

type SortParameters = z.infer<typeof parameters>;

interface SortKey {
  readonly path: ItemPath;
  readonly direction: number;
}

export class SortNode implements NodeType<SortParameters> {
  readonly id = 'sort';
  readonly version = 1;
  readonly kind = 'transform';
  readonly trigger = null;
  readonly category = 'Transform';
  readonly displayName = 'Sort';
  readonly description = 'Orders items by fields or shuffles them';
  readonly parameters = parameters;
  readonly inputs = ['main'];
  readonly outputsParameter = null;
  readonly credentialTypes = [];
  readonly defaultSettings = CORE_SETTINGS;
  readonly fixedParameters = [];

  outputsFor(): readonly string[] {
    return ['main'];
  }

  execute(run: NodeRun<SortParameters>): NodeResult {
    const settings = run.parameters();

    if (settings.mode === 'random') return { main: this.shuffled(run.items) };

    if (settings.fields.length === 0) {
      throw new NodeUserError('Choose at least one field to sort by', 'fields');
    }

    return { main: this.sorted(run.items, settings.fields) };
  }

  private sorted(
    items: readonly Item[],
    fields: SortParameters['fields'],
  ): Item[] {
    const keys = fields.map((sortField) => ({
      path: new ItemPath(sortField.field, true),
      direction: sortField.order === 'descending' ? -1 : 1,
    }));
    return items.toSorted((left, right) => this.compared(left, right, keys));
  }

  private compared(left: Item, right: Item, keys: readonly SortKey[]): number {
    for (const key of keys) {
      const comparison = this.comparedBy(key, left, right);

      if (comparison !== 0) return comparison;
    }

    return 0;
  }

  private comparedBy(key: SortKey, left: Item, right: Item): number {
    const leftValue = key.path.read(left) ?? null;
    const rightValue = key.path.read(right) ?? null;

    if (leftValue === null && rightValue === null) return 0;

    if (leftValue === null) return 1;

    if (rightValue === null) return -1;

    return key.direction * this.comparedValues(leftValue, rightValue);
  }

  private comparedValues(left: unknown, right: unknown): number {
    const rank = this.rankOf(left) - this.rankOf(right);

    if (rank !== 0) return rank;

    if (typeof left === 'number' && typeof right === 'number') {
      return left - right;
    }

    if (typeof left === 'string' && typeof right === 'string') {
      return left.localeCompare(right);
    }

    if (typeof left === 'boolean' && typeof right === 'boolean') {
      return Number(left) - Number(right);
    }

    return 0;
  }

  private rankOf(value: unknown): number {
    if (typeof value === 'number') return 0;

    if (typeof value === 'string') return 1;

    if (typeof value === 'boolean') return 2;

    return 3;
  }

  private shuffled(items: readonly Item[]): Item[] {
    const shuffled = [...items];

    for (let index = shuffled.length - 1; index > 0; index--) {
      const draw = Math.random() * (index + 1);
      const other = Math.floor(draw);
      const item = shuffled[index]!;
      shuffled[index] = shuffled[other]!;
      shuffled[other] = item;
    }

    return shuffled;
  }
}
