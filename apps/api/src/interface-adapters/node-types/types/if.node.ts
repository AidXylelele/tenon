import { z } from 'zod';
import type { Item } from '../../../application/interfaces.js';
import { ConditionSet } from '../conditions/condition-set.js';
import { conditionsSchema } from '../conditions/conditions-schema.js';
import { CORE_SETTINGS } from '../core-settings.js';
import type { NodeResult, NodeRun, NodeType } from '../node-type.js';

const parameters = z.strictObject({ conditions: conditionsSchema });

type IfParameters = z.infer<typeof parameters>;

export class IfNode implements NodeType<IfParameters> {
  readonly id = 'if';
  readonly version = 1;
  readonly kind = 'transform';
  readonly trigger = null;
  readonly category = 'Flow';
  readonly displayName = 'If';
  readonly description =
    'Routes each item to "true" or "false" by conditions joined with AND or OR';
  readonly parameters = parameters;
  readonly inputs = ['main'];
  readonly outputsParameter = null;
  readonly credentialTypes = [];
  readonly defaultSettings = CORE_SETTINGS;
  readonly fixedParameters = [];

  outputsFor(): readonly string[] {
    return ['true', 'false'];
  }

  execute(run: NodeRun<IfParameters>): NodeResult {
    const matching: Item[] = [];
    const other: Item[] = [];

    run.items.forEach((item, index) => {
      const { conditions } = run.parametersOf(index);
      const holds = new ConditionSet(conditions).holds();
      (holds ? matching : other).push(item);
    });

    return { true: matching, false: other };
  }
}
