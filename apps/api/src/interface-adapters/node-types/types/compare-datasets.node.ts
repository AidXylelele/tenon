import { z } from 'zod';
import type { Item } from '../../../application/interfaces.js';
import { CORE_SETTINGS } from '../core-settings.js';
import { ItemMatch } from '../item-match.js';
import { ItemPath } from '../item-path.js';
import type { NodeResult, NodeRun, NodeType } from '../node-type.js';

const parameters = z.strictObject({
  fields: z
    .array(
      z.strictObject({
        fieldA: z.string().min(1).meta({ title: 'Input A field' }),
        fieldB: z.string().min(1).meta({ title: 'Input B field' }),
      }),
    )
    .min(1)
    .meta({ title: 'Fields to match' }),
});

type CompareDatasetsParameters = z.infer<typeof parameters>;

type KeyFields = CompareDatasetsParameters['fields'];

export class CompareDatasetsNode implements NodeType<CompareDatasetsParameters> {
  readonly id = 'compareDatasets';
  readonly version = 1;
  readonly kind = 'transform';
  readonly trigger = null;
  readonly category = 'Transform';
  readonly displayName = 'Compare Datasets';
  readonly description =
    'Matches the items of two inputs by key fields and sorts them into only in A, same, different and only in B';
  readonly parameters = parameters;
  readonly inputs = ['inputA', 'inputB'];
  readonly outputsParameter = null;
  readonly credentialTypes = [];
  readonly defaultSettings = CORE_SETTINGS;
  readonly fixedParameters = ['fields'];

  outputsFor(): readonly string[] {
    return ['inA', 'same', 'different', 'inB'];
  }

  execute(run: NodeRun<CompareDatasetsParameters>): NodeResult {
    const { fields } = run.parameters();
    const inputA = run.input('inputA');
    const inputB = run.input('inputB');
    const pairs = fields.map((pair) => ({
      left: pair.fieldA,
      right: pair.fieldB,
    }));
    const match = new ItemMatch(pairs, inputA, inputB);
    const taken = new Set<number>();
    const inA: Item[] = [];
    const same: Item[] = [];
    const different: Item[] = [];

    inputA.forEach((item, index) => {
      const partner = match
        .rightMatchesOf(index)
        .find((candidate) => !taken.has(candidate));

      if (partner === undefined) {
        inA.push(item);
        return;
      }

      taken.add(partner);
      const other = inputB[partner]!;
      const identical = ItemMatch.sameValue(item, other);

      if (identical) {
        same.push(item);
        return;
      }

      const difference = this.difference(item, other, fields);
      different.push(difference);
    });

    const inB = inputB.filter((_item, index) => !taken.has(index));
    return { inA, same, different, inB };
  }

  private difference(itemA: Item, itemB: Item, fields: KeyFields): Item {
    const equal: [string, unknown][] = [];
    const unequal: [string, unknown][] = [];

    for (const name of this.namesOf(itemA, itemB)) {
      const path = new ItemPath(name, false);
      const valueA = path.read(itemA);
      const valueB = path.read(itemB);
      const identical = ItemMatch.sameValue(valueA, valueB);

      if (identical) {
        equal.push([name, valueA]);
        continue;
      }

      const sides = this.sides(valueA, valueB);
      unequal.push([name, sides]);
    }

    return {
      keys: this.keysOf(itemA, fields),
      same: Object.fromEntries(equal),
      different: Object.fromEntries(unequal),
    };
  }

  private keysOf(itemA: Item, fields: KeyFields): Item {
    const keys: [string, unknown][] = [];

    for (const pair of fields) {
      const path = new ItemPath(pair.fieldA, true);
      const key = path.read(itemA);
      keys.push([pair.fieldA, key]);
    }

    return Object.fromEntries(keys);
  }

  private namesOf(itemA: Item, itemB: Item): Set<string> {
    const namesA = Object.keys(itemA);
    const names = new Set(namesA);

    for (const name of Object.keys(itemB)) {
      names.add(name);
    }

    return names;
  }

  private sides(valueA: unknown, valueB: unknown): Item {
    if (valueA === undefined) return { inputB: valueB };

    if (valueB === undefined) return { inputA: valueA };

    return { inputA: valueA, inputB: valueB };
  }
}
