import { z } from 'zod';
import type { Item } from '../../../application/interfaces.js';
import { CORE_SETTINGS } from '../core-settings.js';
import { ItemMatch } from '../item-match.js';
import type { NodeResult, NodeRun, NodeType } from '../node-type.js';
import { NodeLimitError } from '../node-limit-error.js';
import { NodeUserError } from '../node-user-error.js';

const parameters = z.strictObject({
  mode: z
    .enum([
      'append',
      'combineByFields',
      'combineByPosition',
      'allCombinations',
      'chooseInput',
    ])
    .default('append')
    .meta({ title: 'Mode' }),
  fields: z
    .array(
      z.strictObject({
        field1: z.string().min(1).meta({ title: 'Input 1 field' }),
        field2: z.string().min(1).meta({ title: 'Input 2 field' }),
      }),
    )
    .default([])
    .meta({ title: 'Fields to match' }),
  join: z
    .enum([
      'keepMatches',
      'keepNonMatches',
      'keepEverything',
      'enrichInput1',
      'enrichInput2',
    ])
    .default('keepMatches')
    .meta({ title: 'Output type' }),
  clash: z
    .enum(['preferInput1', 'preferInput2', 'addSuffix'])
    .default('preferInput2')
    .meta({ title: 'When field names clash' }),
  includeUnpaired: z
    .boolean()
    .default(false)
    .meta({ title: 'Include unpaired items' }),
  chosenInput: z
    .enum(['input1', 'input2'])
    .default('input1')
    .meta({ title: 'Input to output' }),
});

type MergeParameters = z.infer<typeof parameters>;

type Clash = MergeParameters['clash'];

export class MergeNode implements NodeType<MergeParameters> {
  readonly id = 'merge';
  readonly version = 1;
  readonly kind = 'transform';
  readonly trigger = null;
  readonly category = 'Flow';
  readonly displayName = 'Merge';
  readonly description =
    'Combines the items of several inputs by appending them, matching fields, position or every combination';
  readonly parameters = parameters;
  readonly inputs = ['input1', 'input2', 'input3', 'input4'];
  readonly outputsParameter = null;
  readonly credentialTypes = [];
  readonly defaultSettings = CORE_SETTINGS;
  readonly fixedParameters = [
    'mode',
    'fields',
    'join',
    'clash',
    'includeUnpaired',
    'chosenInput',
  ];

  outputsFor(): readonly string[] {
    return ['main'];
  }

  execute(run: NodeRun<MergeParameters>): NodeResult {
    const settings = run.parameters();
    return { main: this.merged(run, settings) };
  }

  private merged(
    run: NodeRun<MergeParameters>,
    settings: MergeParameters,
  ): readonly Item[] {
    const first = run.input('input1');
    const second = run.input('input2');

    switch (settings.mode) {
      case 'append':
        return this.appended(run);
      case 'combineByFields':
        return this.combinedByFields(first, second, settings, run.limits.items);
      case 'combineByPosition':
        return this.combinedByPosition(first, second, settings);
      case 'allCombinations': {
        const combinations = first.length * second.length;
        MergeNode.assertWithin(combinations, run.limits.items);
        return this.allCombinations(first, second, settings.clash);
      }
      default:
        return run.input(settings.chosenInput);
    }
  }

  private appended(run: NodeRun<MergeParameters>): Item[] {
    const appended: Item[] = [];

    for (const port of this.inputs) {
      for (const item of run.input(port)) {
        appended.push(item);
      }
    }

    return appended;
  }

  private combinedByFields(
    first: readonly Item[],
    second: readonly Item[],
    settings: MergeParameters,
    limit: number,
  ): Item[] {
    if (settings.fields.length === 0) {
      throw new NodeUserError(
        'Choose at least one pair of fields to match',
        'fields',
      );
    }

    const pairs = settings.fields.map((pair) => ({
      left: pair.field1,
      right: pair.field2,
    }));
    const match = new ItemMatch(pairs, first, second);

    if (settings.join === 'keepMatches' || settings.join === 'keepEverything') {
      const matchedPairs = MergeNode.pairsOf(first, match);
      MergeNode.assertWithin(matchedPairs, limit);
    }

    const { clash } = settings;

    switch (settings.join) {
      case 'keepMatches':
        return this.matched(first, second, match, clash);
      case 'keepNonMatches':
        return this.unmatched(first, second, match);
      case 'keepEverything': {
        const matched = this.matched(first, second, match, clash);
        const unmatched = this.unmatched(first, second, match);
        return matched.concat(unmatched);
      }
      case 'enrichInput1':
        return this.enrichedFirst(first, second, match, clash);
      default:
        return this.enrichedSecond(first, second, match, clash);
    }
  }

  private matched(
    first: readonly Item[],
    second: readonly Item[],
    match: ItemMatch,
    clash: Clash,
  ): Item[] {
    const merged: Item[] = [];

    first.forEach((item, index) => {
      for (const partner of match.rightMatchesOf(index)) {
        const combined = this.combined(item, second[partner]!, clash);
        merged.push(combined);
      }
    });

    return merged;
  }

  private unmatched(
    first: readonly Item[],
    second: readonly Item[],
    match: ItemMatch,
  ): Item[] {
    const lonelyFirst = first.filter(
      (_item, index) => match.rightMatchesOf(index).length === 0,
    );
    const lonelySecond = second.filter(
      (_item, index) => match.leftMatchesOf(index).length === 0,
    );
    return lonelyFirst.concat(lonelySecond);
  }

  private enrichedFirst(
    first: readonly Item[],
    second: readonly Item[],
    match: ItemMatch,
    clash: Clash,
  ): Item[] {
    return first.map((item, index) => {
      const [partner] = match.rightMatchesOf(index);

      if (partner === undefined) return item;

      return this.combined(item, second[partner]!, clash);
    });
  }

  private enrichedSecond(
    first: readonly Item[],
    second: readonly Item[],
    match: ItemMatch,
    clash: Clash,
  ): Item[] {
    return second.map((item, index) => {
      const [partner] = match.leftMatchesOf(index);

      if (partner === undefined) return item;

      return this.combined(first[partner]!, item, clash);
    });
  }

  private combinedByPosition(
    first: readonly Item[],
    second: readonly Item[],
    settings: MergeParameters,
  ): Item[] {
    const paired = Math.min(first.length, second.length);
    const combined: Item[] = [];

    for (let index = 0; index < paired; index++) {
      const merged = this.combined(
        first[index]!,
        second[index]!,
        settings.clash,
      );
      combined.push(merged);
    }

    if (!settings.includeUnpaired) return combined;

    const unpairedFirst = first.slice(paired);
    const unpairedSecond = second.slice(paired);
    return combined.concat(unpairedFirst, unpairedSecond);
  }

  private allCombinations(
    first: readonly Item[],
    second: readonly Item[],
    clash: Clash,
  ): Item[] {
    const combined: Item[] = [];

    for (const left of first) {
      for (const right of second) {
        const merged = this.combined(left, right, clash);
        combined.push(merged);
      }
    }

    return combined;
  }

  private static pairsOf(first: readonly Item[], match: ItemMatch): number {
    let pairs = 0;

    for (let index = 0; index < first.length; index++) {
      pairs += match.rightMatchesOf(index).length;
    }

    return pairs;
  }

  private static assertWithin(count: number, limit: number): void {
    if (count <= limit) return;

    throw new NodeLimitError(
      `Merging would produce ${count} items, more than ${limit}`,
    );
  }

  private combined(first: Item, second: Item, clash: Clash): Item {
    if (clash === 'preferInput1') return { ...second, ...first };

    if (clash === 'preferInput2') return { ...first, ...second };

    return this.suffixed(first, second);
  }

  private suffixed(first: Item, second: Item): Item {
    const fields: [string, unknown][] = [];

    for (const [name, value] of Object.entries(first)) {
      const clashes = Object.hasOwn(second, name);
      const key = clashes ? `${name}_1` : name;
      fields.push([key, value]);
    }

    for (const [name, value] of Object.entries(second)) {
      const clashes = Object.hasOwn(first, name);
      const key = clashes ? `${name}_2` : name;
      fields.push([key, value]);
    }

    return Object.fromEntries(fields);
  }
}
