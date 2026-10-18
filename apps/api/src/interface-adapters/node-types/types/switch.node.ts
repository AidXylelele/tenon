import { z } from 'zod';
import type { Item } from '../../../application/interfaces.js';
import { ConditionSet } from '../conditions/condition-set.js';
import { conditionsSchema } from '../conditions/conditions-schema.js';
import { CORE_SETTINGS } from '../core-settings.js';
import type { NodeResult, NodeRun, NodeType } from '../node-type.js';

const parameters = z.strictObject({
  rules: z
    .array(
      z.strictObject({
        conditions: conditionsSchema,
        output: z.string().min(1).optional().meta({ title: 'Output name' }),
      }),
    )
    .min(1)
    .meta({ title: 'Routing rules' }),
  allMatching: z
    .boolean()
    .default(false)
    .meta({ title: 'Send to all matching outputs' }),
  fallback: z
    .enum(['none', 'extra'])
    .default('none')
    .meta({ title: 'Fallback output' }),
});

type SwitchParameters = z.infer<typeof parameters>;

export class SwitchNode implements NodeType<SwitchParameters> {
  static readonly FALLBACK = 'fallback';

  readonly id = 'switch';
  readonly version = 1;
  readonly kind = 'transform';
  readonly trigger = null;
  readonly category = 'Flow';
  readonly displayName = 'Switch';
  readonly description =
    'Routes each item to the output of the first rule it matches, or of every matching rule';
  readonly parameters = parameters;
  readonly inputs = ['main'];
  readonly outputsParameter = 'rules';
  readonly credentialTypes = [];
  readonly defaultSettings = CORE_SETTINGS;
  readonly fixedParameters = ['allMatching', 'fallback'];

  outputsFor(sketch: Readonly<Record<string, unknown>>): readonly string[] {
    const sketchedRules = sketch.rules;
    const isArray = Array.isArray(sketchedRules);
    const rules: readonly unknown[] = isArray ? sketchedRules : [];
    const outputs = rules.map((rule, index) => this.outputOf(rule, index));

    if (sketch.fallback === 'extra') outputs.push(SwitchNode.FALLBACK);

    return outputs;
  }

  execute(run: NodeRun<SwitchParameters>): NodeResult {
    const nodeSettings = run.parameters();
    const outputs = this.outputsFor(nodeSettings);
    const routed = this.emptyOutputs(outputs);

    run.items.forEach((item, index) => {
      const settings = run.parametersOf(index);

      for (const output of this.destinations(settings)) {
        this.route(routed, output, item);
      }
    });

    return Object.fromEntries(routed);
  }

  private outputOf(rule: unknown, index: number): string {
    if (rule === null || typeof rule !== 'object') return String(index);

    if (!('output' in rule)) return String(index);

    const { output } = rule;
    return typeof output === 'string' && output !== '' ? output : String(index);
  }

  private emptyOutputs(outputs: readonly string[]): Map<string, Item[]> {
    const routed = new Map<string, Item[]>();

    for (const output of outputs) {
      routed.set(output, []);
    }

    return routed;
  }

  private destinations(settings: SwitchParameters): string[] {
    const destinations: string[] = [];

    for (const [index, rule] of settings.rules.entries()) {
      const holds = new ConditionSet(rule.conditions).holds();

      if (!holds) continue;

      const output = this.outputOf(rule, index);
      const included = destinations.includes(output);

      if (!included) destinations.push(output);

      if (!settings.allMatching) return destinations;
    }

    if (destinations.length > 0) return destinations;

    if (settings.fallback === 'extra') return [SwitchNode.FALLBACK];

    return [];
  }

  private route(routed: Map<string, Item[]>, output: string, item: Item): void {
    const items = routed.get(output) ?? [];
    items.push(item);
    routed.set(output, items);
  }
}
