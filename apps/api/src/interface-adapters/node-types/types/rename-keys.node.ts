import { z } from 'zod';
import type { Item } from '../../../application/interfaces.js';
import { ProblemCode } from '../../../domain/enums.js';
import { RegularExpression } from '../conditions/regular-expression.js';
import { CORE_SETTINGS } from '../core-settings.js';
import { ItemPath } from '../item-path.js';
import type { NodeResult, NodeRun, NodeType } from '../node-type.js';

const parameters = z
  .strictObject({
    mode: z.enum(['pairs', 'regex']).default('pairs').meta({ title: 'Mode' }),
    pairs: z
      .array(
        z.strictObject({
          from: z.string().min(1).meta({ title: 'Current name' }),
          to: z.string().min(1).meta({ title: 'New name' }),
        }),
      )
      .default([])
      .meta({ title: 'Fields to rename' }),
    pattern: z.string().optional().meta({ title: 'Pattern' }),
    replacement: z.string().default('').meta({ title: 'Replace with' }),
    dotNotation: z.boolean().default(true).meta({ title: 'Dot notation' }),
  })
  .superRefine((settings, context) => {
    if (settings.mode !== 'regex') return;

    if (!settings.pattern) {
      context.addIssue({
        code: 'custom',
        path: ['pattern'],
        message: 'A pattern is required to rename by regular expression',
      });
      return;
    }

    const problem = RegularExpression.problemOf(settings.pattern);

    if (problem) {
      context.addIssue({
        code: 'custom',
        path: ['pattern'],
        message: problem,
        params: { problem: ProblemCode.InvalidRegex },
      });
    }
  });

type RenameKeysParameters = z.infer<typeof parameters>;

export class RenameKeysNode implements NodeType<RenameKeysParameters> {
  readonly id = 'renameKeys';
  readonly version = 1;
  readonly kind = 'transform';
  readonly trigger = null;
  readonly category = 'Transform';
  readonly displayName = 'Rename Keys';
  readonly description =
    'Renames fields by name pairs or by a regular expression';
  readonly parameters = parameters;
  readonly inputs = ['main'];
  readonly outputsParameter = null;
  readonly credentialTypes = [];
  readonly defaultSettings = CORE_SETTINGS;
  readonly fixedParameters = ['mode'];

  outputsFor(): readonly string[] {
    return ['main'];
  }

  execute(run: NodeRun<RenameKeysParameters>): NodeResult {
    const renamed = run.items.map((item, index) => {
      const settings = run.parametersOf(index);
      return settings.mode === 'regex'
        ? this.renamedByPattern(item, settings)
        : this.renamedByPairs(item, settings);
    });

    return { main: renamed };
  }

  private renamedByPairs(item: Item, settings: RenameKeysParameters): Item {
    let result = item;

    for (const pair of settings.pairs) {
      const from = new ItemPath(pair.from, settings.dotNotation);
      const value = from.read(result);

      if (value === undefined) continue;

      const to = new ItemPath(pair.to, settings.dotNotation);
      const remaining = from.remove(result);
      result = to.write(remaining, value);
    }

    return result;
  }

  private renamedByPattern(item: Item, settings: RenameKeysParameters): Item {
    const pattern = RegularExpression.compile(settings.pattern!, false);
    const entries = Object.entries(item).map(
      ([key, value]): [string, unknown] => [
        pattern.replaceAll(key, settings.replacement),
        value,
      ],
    );
    return Object.fromEntries(entries);
  }
}
