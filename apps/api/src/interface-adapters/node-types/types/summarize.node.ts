import { z } from 'zod';
import type { Item } from '../../../application/interfaces.js';
import { CanonicalJson } from '../canonical-json.js';
import { CORE_SETTINGS } from '../core-settings.js';
import { ItemPath } from '../item-path.js';
import type { NodeResult, NodeRun, NodeType } from '../node-type.js';

const parameters = z.strictObject({
  groupBy: z
    .array(z.string().min(1))
    .default([])
    .meta({ title: 'Group by fields' }),
  aggregations: z
    .array(
      z.strictObject({
        operation: z
          .enum([
            'count',
            'countUnique',
            'sum',
            'average',
            'min',
            'max',
            'append',
            'concatenate',
          ])
          .meta({ title: 'Operation' }),
        field: z.string().min(1).meta({ title: 'Field' }),
        separator: z.string().default(', ').meta({ title: 'Separator' }),
      }),
    )
    .min(1)
    .meta({ title: 'Aggregations' }),
});

type SummarizeParameters = z.infer<typeof parameters>;

type Aggregation = SummarizeParameters['aggregations'][number];

export class SummarizeNode implements NodeType<SummarizeParameters> {
  readonly id = 'summarize';
  readonly version = 1;
  readonly kind = 'transform';
  readonly trigger = null;
  readonly category = 'Transform';
  readonly displayName = 'Summarize';
  readonly description =
    'Groups items and counts, sums, averages or collects their values';
  readonly parameters = parameters;
  readonly inputs = ['main'];
  readonly outputsParameter = null;
  readonly credentialTypes = [];
  readonly defaultSettings = CORE_SETTINGS;
  readonly fixedParameters = [];

  outputsFor(): readonly string[] {
    return ['main'];
  }

  execute(run: NodeRun<SummarizeParameters>): NodeResult {
    const settings = run.parameters();
    const groups = this.groupsOf(run.items, settings.groupBy);
    const summaries = [...groups.values()].map((group) =>
      this.summaryOf(group, settings),
    );

    return { main: summaries };
  }

  private groupsOf(
    items: readonly Item[],
    groupBy: readonly string[],
  ): Map<string, Item[]> {
    const paths = groupBy.map((field) => new ItemPath(field, true));
    const groups = new Map<string, Item[]>();

    for (const item of items) {
      const values = paths.map((path) => path.read(item));
      const key = CanonicalJson.of(values);
      const known = groups.has(key);

      if (!known) groups.set(key, []);

      groups.get(key)!.push(item);
    }

    return groups;
  }

  private summaryOf(
    group: readonly Item[],
    settings: SummarizeParameters,
  ): Item {
    const first = group[0]!;
    let summary: Item = {};

    for (const field of settings.groupBy) {
      const path = new ItemPath(field, true);
      const value = path.read(first) ?? null;
      summary = path.write(summary, value);
    }

    for (const aggregation of settings.aggregations) {
      const values = this.presentValuesOf(group, aggregation.field);
      const outputField = this.nameOf(aggregation);
      const name = new ItemPath(outputField, false);
      const aggregated = this.aggregated(values, aggregation);
      summary = name.write(summary, aggregated);
    }

    return summary;
  }

  private nameOf(aggregation: Aggregation): string {
    return `${aggregation.operation}_${aggregation.field.replaceAll('.', '_')}`;
  }

  private presentValuesOf(group: readonly Item[], field: string): unknown[] {
    const path = new ItemPath(field, true);
    const values: unknown[] = [];

    for (const item of group) {
      const value = path.read(item);

      if (value !== undefined && value !== null) values.push(value);
    }

    return values;
  }

  private aggregated(values: unknown[], aggregation: Aggregation): unknown {
    switch (aggregation.operation) {
      case 'count':
        return values.length;
      case 'countUnique':
        return this.distinctCountOf(values);
      case 'sum': {
        const numbers = this.numbersOf(values);
        return this.sumOf(numbers);
      }
      case 'average': {
        const numbers = this.numbersOf(values);
        return this.averageOf(numbers);
      }
      case 'min': {
        const numbers = this.numbersOf(values);
        return this.smallestOf(numbers);
      }
      case 'max': {
        const numbers = this.numbersOf(values);
        return this.largestOf(numbers);
      }
      case 'append':
        return values;
      case 'concatenate':
        return values
          .map((value) => this.textOf(value))
          .join(aggregation.separator);
    }
  }

  private distinctCountOf(values: readonly unknown[]): number {
    const distinct = new Set<string>();

    for (const value of values) {
      const canonical = CanonicalJson.of(value);
      distinct.add(canonical);
    }

    return distinct.size;
  }

  private sumOf(numbers: readonly number[]): number {
    let sum = 0;

    for (const number of numbers) {
      sum += number;
    }

    return sum;
  }

  private averageOf(numbers: readonly number[]): number | null {
    if (numbers.length === 0) return null;

    return this.sumOf(numbers) / numbers.length;
  }

  private smallestOf(numbers: readonly number[]): number | null {
    let smallest: number | null = null;

    for (const number of numbers) {
      if (smallest === null || number < smallest) smallest = number;
    }

    return smallest;
  }

  private largestOf(numbers: readonly number[]): number | null {
    let largest: number | null = null;

    for (const number of numbers) {
      if (largest === null || number > largest) largest = number;
    }

    return largest;
  }

  private numbersOf(values: readonly unknown[]): number[] {
    const numbers: number[] = [];

    for (const value of values) {
      const number = this.numberOf(value);

      if (number !== null) numbers.push(number);
    }

    return numbers;
  }

  private numberOf(value: unknown): number | null {
    if (typeof value === 'number') {
      const finite = Number.isFinite(value);
      return finite ? value : null;
    }

    if (typeof value !== 'string') return null;

    const trimmed = value.trim();

    if (trimmed === '') return null;

    const number = Number(value);
    const finite = Number.isFinite(number);
    return finite ? number : null;
  }

  private textOf(value: unknown): string {
    if (typeof value === 'string') return value;

    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }

    return JSON.stringify(value);
  }
}
