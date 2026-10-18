import { z } from 'zod';
import type { WebhookSettings } from '../../../application/interfaces.js';
import { TriggerType } from '../../../domain/enums.js';
import type { NodeParameters } from '../../../domain/interfaces.js';
import { CORE_SETTINGS } from '../core-settings.js';
import type { NodeResult, NodeRun, NodeType } from '../node-type.js';
import { ParameterTree } from '../parameters/parameter-tree.js';

const parameters = z.strictObject({
  methods: z
    .array(z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']))
    .min(1)
    .default(['POST'])
    .meta({ title: 'HTTP methods' }),
  authentication: z
    .enum(['token', 'signature'])
    .default('token')
    .meta({ title: 'Authentication' }),
});

type WebhookParameters = z.infer<typeof parameters>;

export class WebhookTriggerNode implements NodeType<WebhookParameters> {
  readonly id = 'webhook';
  readonly version = 1;
  readonly kind = 'trigger';
  readonly trigger = TriggerType.Webhook;
  readonly category = 'Triggers';
  readonly displayName = 'Webhook';
  readonly description =
    'Starts a run of the active release for every authenticated call to its address';
  readonly parameters = parameters;
  readonly inputs = [];
  readonly outputsParameter = null;
  readonly credentialTypes = [];
  readonly defaultSettings = CORE_SETTINGS;
  readonly fixedParameters = ['methods', 'authentication'];

  outputsFor(): readonly string[] {
    return ['main'];
  }

  execute(run: NodeRun<WebhookParameters>): NodeResult {
    return { main: run.items };
  }

  webhookOf(raw: NodeParameters): WebhookSettings | null {
    const sketch = ParameterTree.parse(raw).sketch();
    const parsed = parameters.safeParse(sketch);

    if (!parsed.success) return null;

    return parsed.data;
  }
}
