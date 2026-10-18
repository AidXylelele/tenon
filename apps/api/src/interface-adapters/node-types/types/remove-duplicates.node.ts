import { z } from 'zod';
import type { Item } from '../../../application/interfaces.js';
import { CanonicalJson } from '../canonical-json.js';
import { CORE_SETTINGS } from '../core-settings.js';
import { ItemPath } from '../item-path.js';
import type { NodeResult, NodeRun, NodeType } from '../node-type.js';
import { NodeUserError } from '../node-user-error.js';

const parameters = z.strictObject({
  compare: z
    .enum(['allFields', 'selectedFields', 'allFieldsExcept'])
    .default('allFields')
    .meta({ title: 'Compare' }),
  fields: z.array(z.string().min(1)).default([]).meta({ title: 'Fields' }),
});

type RemoveDuplicatesParameters = z.infer<typeof parameters>;

export class RemoveDuplicatesNode implements NodeType<RemoveDuplicatesParameters> {
  readonly id = 'removeDuplicates';
  readonly version = 1;
  readonly kind = 'transform';
  readonly trigger = null;
  readonly category = 'Transform';
  readonly displayName = 'Remove Duplicates';
  readonly description =
    'Drops items equal to an earlier item in all or some fields';
  readonly parameters = parameters;
  readonly inputs = ['main'];
  readonly outputsParameter = null;
  readonly credentialTypes = [];
  readonly defaultSettings = CORE_SETTINGS;
  readonly fixedParameters = [];

  outputsFor(): readonly string[] {
    return ['main'];
  }

  execute(run: NodeRun<RemoveDuplicatesParameters>): NodeResult {
    const settings = run.parameters();

    if (settings.compare === 'selectedFields' && settings.fields.length === 0) {
      throw new NodeUserError('Choose at least one field to compare', 'fields');
    }

    const seen = new Set<string>();
    const unique: Item[] = [];

    for (const item of run.items) {
      const key = this.keyOf(item, settings);
      const duplicate = seen.has(key);

      if (duplicate) continue;

      seen.add(key);
      unique.push(item);
    }

    return { main: unique };
  }

  private keyOf(item: Item, settings: RemoveDuplicatesParameters): string {
    if (settings.compare === 'selectedFields') {
      const values = this.selectedValuesOf(item, settings.fields);
      return CanonicalJson.of(values);
    }

    if (settings.compare === 'allFieldsExcept') {
      const remaining = this.withoutFields(item, settings.fields);
      return CanonicalJson.of(remaining);
    }

    return CanonicalJson.of(item);
  }

  private selectedValuesOf(item: Item, fields: readonly string[]): unknown[] {
    return fields.map((field) => new ItemPath(field, true).read(item));
  }

  private withoutFields(item: Item, fields: readonly string[]): Item {
    let remaining = item;

    for (const field of fields) {
      remaining = new ItemPath(field, true).remove(remaining);
    }

    return remaining;
  }
}
