import { z } from 'zod';
import type { Item } from '../../../application/interfaces.js';
import { CORE_SETTINGS } from '../core-settings.js';
import { ItemPath } from '../item-path.js';
import type { NodeResult, NodeRun, NodeType } from '../node-type.js';
import { NodeUserError } from '../node-user-error.js';

const parameters = z.strictObject({
  mode: z.enum(['manual', 'json']).default('manual').meta({ title: 'Mode' }),
  assignments: z
    .array(
      z.strictObject({
        name: z.string().min(1).meta({ title: 'Field' }),
        value: z.unknown().meta({ title: 'Value' }),
      }),
    )
    .default([])
    .meta({ title: 'Fields to set' }),
  json: z.unknown().optional().meta({ title: 'JSON template' }),
  include: z
    .enum(['all', 'none', 'selected', 'except'])
    .default('all')
    .meta({ title: 'Other fields' }),
  fields: z
    .array(z.string().min(1))
    .default([])
    .meta({ title: 'Selected fields' }),
  dotNotation: z.boolean().default(true).meta({ title: 'Dot notation' }),
});

type EditFieldsParameters = z.infer<typeof parameters>;

export class EditFieldsNode implements NodeType<EditFieldsParameters> {
  readonly id = 'editFields';
  readonly version = 1;
  readonly kind = 'transform';
  readonly trigger = null;
  readonly category = 'Transform';
  readonly displayName = 'Edit Fields';
  readonly description =
    'Sets, renames or removes fields by mapping or from a JSON template';
  readonly parameters = parameters;
  readonly inputs = ['main'];
  readonly outputsParameter = null;
  readonly credentialTypes = [];
  readonly defaultSettings = CORE_SETTINGS;
  readonly fixedParameters = ['mode', 'include', 'dotNotation'];

  outputsFor(): readonly string[] {
    return ['main'];
  }

  execute(run: NodeRun<EditFieldsParameters>): NodeResult {
    const edited = run.items.map((item, index) => {
      const settings = run.parametersOf(index);
      const kept = this.kept(item, settings);
      return settings.mode === 'json'
        ? this.merged(kept, settings, index)
        : this.assigned(kept, settings);
    });

    return { main: edited };
  }

  private kept(item: Item, settings: EditFieldsParameters): Item {
    if (settings.include === 'none') return {};

    if (settings.include === 'all') return item;

    if (settings.include === 'except') {
      let remaining = item;

      for (const name of settings.fields) {
        remaining = new ItemPath(name, settings.dotNotation).remove(remaining);
      }

      return remaining;
    }

    let selected: Item = {};

    for (const name of settings.fields) {
      const path = new ItemPath(name, settings.dotNotation);
      const value = path.read(item);

      if (value !== undefined) selected = path.write(selected, value);
    }

    return selected;
  }

  private assigned(item: Item, settings: EditFieldsParameters): Item {
    let result = item;

    for (const assignment of settings.assignments) {
      const path = new ItemPath(assignment.name, settings.dotNotation);
      result = path.write(result, assignment.value);
    }

    return result;
  }

  private merged(
    item: Item,
    settings: EditFieldsParameters,
    index: number,
  ): Item {
    const template = this.template(settings.json, index);
    return { ...item, ...template };
  }

  private template(json: unknown, index: number): Item {
    const value = typeof json === 'string' ? this.parsed(json, index) : json;
    const isArray = Array.isArray(value);

    if (value === null || typeof value !== 'object' || isArray) {
      throw new NodeUserError(
        'The JSON template must be an object',
        'json',
        index,
      );
    }

    return value as Item;
  }

  private parsed(json: string, index: number): unknown {
    try {
      return JSON.parse(json);
    } catch {
      throw new NodeUserError(
        'The JSON template is not valid JSON',
        'json',
        index,
      );
    }
  }
}
