import { z } from 'zod';
import { ConditionSet } from '../conditions/condition-set.js';
import { conditionsSchema } from '../conditions/conditions-schema.js';
import { CORE_SETTINGS } from '../core-settings.js';
import type { NodeResult, NodeRun, NodeType } from '../node-type.js';

const parameters = z.strictObject({ conditions: conditionsSchema });

type FilterParameters = z.infer<typeof parameters>;

export class FilterNode implements NodeType<FilterParameters> {
  readonly id = 'filter';
  readonly version = 1;
  readonly kind = 'transform';
  readonly trigger = null;
  readonly category = 'Flow';
  readonly displayName = 'Filter';
  readonly description =
    'Keeps only the items whose conditions hold, joined with AND or OR';
  readonly parameters = parameters;
  readonly inputs = ['main'];
  readonly outputsParameter = null;
  readonly credentialTypes = [];
  readonly defaultSettings = CORE_SETTINGS;
  readonly fixedParameters = [];

  outputsFor(): readonly string[] {
    return ['main'];
  }

  execute(run: NodeRun<FilterParameters>): NodeResult {
    const kept = run.items.filter((_item, index) => {
      const { conditions } = run.parametersOf(index);
      return new ConditionSet(conditions).holds();
    });

    return { main: kept };
  }
}
