import { z } from 'zod';
import type { Item } from '../../../application/interfaces.js';
import { CORE_SETTINGS } from '../core-settings.js';
import { ItemPath } from '../item-path.js';
import type { NodeResult, NodeRun, NodeType } from '../node-type.js';

const parameters = z.strictObject({
  field: z.string().min(1).meta({ title: 'Field to split out' }),
  include: z
    .enum(['none', 'allOther', 'selected'])
    .default('none')
    .meta({ title: 'Other fields' }),
  fields: z
    .array(z.string().min(1))
    .default([])
    .meta({ title: 'Selected fields' }),
  destination: z.string().min(1).optional().meta({ title: 'Output field' }),
});

type SplitOutParameters = z.infer<typeof parameters>;

export class SplitOutNode implements NodeType<SplitOutParameters> {
  readonly id = 'splitOut';
  readonly version = 1;
  readonly kind = 'transform';
  readonly trigger = null;
  readonly category = 'Transform';
  readonly displayName = 'Split Out';
  readonly description = 'Turns a list in each item into separate items';
  readonly parameters = parameters;
  readonly inputs = ['main'];
  readonly outputsParameter = null;
  readonly credentialTypes = [];
  readonly defaultSettings = CORE_SETTINGS;
  readonly fixedParameters = [];

  outputsFor(): readonly string[] {
    return ['main'];
  }

  execute(run: NodeRun<SplitOutParameters>): NodeResult {
    const split: Item[] = [];

    run.items.forEach((item, index) => {
      const settings = run.parametersOf(index);
      const added = this.addedFields(item, settings);

      for (const element of this.elementsOf(item, settings.field)) {
        const part = this.itemOf(element, settings);
        split.push({ ...added, ...part });
      }
    });

    return { main: split };
  }

  private elementsOf(item: Item, field: string): readonly unknown[] {
    const value = new ItemPath(field, true).read(item);

    if (value === undefined) return [];

    const isArray = Array.isArray(value);
    return isArray ? value : [value];
  }

  private itemOf(element: unknown, settings: SplitOutParameters): Item {
    const isObject = this.isObject(element);

    if (settings.destination === undefined && isObject) {
      return element;
    }

    const name = settings.destination ?? this.lastSegmentOf(settings.field);
    return { [name]: element };
  }

  private addedFields(item: Item, settings: SplitOutParameters): Item {
    if (settings.include === 'none') return {};

    if (settings.include === 'allOther') {
      return new ItemPath(settings.field, true).remove(item);
    }

    let selected: Item = {};

    for (const name of settings.fields) {
      const path = new ItemPath(name, true);
      const value = path.read(item);

      if (value !== undefined) selected = path.write(selected, value);
    }

    return selected;
  }

  private isObject(value: unknown): value is Item {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
  }

  private lastSegmentOf(field: string): string {
    const nameStart = field.lastIndexOf('.') + 1;
    return field.slice(nameStart);
  }
}
