import { TriggerType, ProblemCode } from '../../../src/domain/enums.js';
import { Graph } from '../../../src/domain/graph.js';
import { Node } from '../../../src/domain/node.js';
import { NodeTypeRegistry } from '../../../src/interface-adapters/node-types/node-type.registry.js';
import { WebhookTriggerNode } from '../../../src/interface-adapters/node-types/types/webhook-trigger.node.js';
import { aNode } from '../../support/automation-builders.js';

const registry = new NodeTypeRegistry([new WebhookTriggerNode()]);

const hook = (parameters: Record<string, unknown>) =>
  new Node(
    aNode('hook', {
      type: 'webhook',
      trigger: TriggerType.Webhook,
      parameters,
    }),
  );

describe('Webhook trigger', () => {
  it('is_a_webhook_trigger_without_inputs', () => {
    const type = new WebhookTriggerNode();
    expect(type.trigger).toBe(TriggerType.Webhook);
    expect(type.kind).toBe('trigger');
    expect(type.inputs).toEqual([]);
  });

  it('answers_post_with_a_token_unless_configured_otherwise', () => {
    expect(registry.webhookOf(hook({}))).toEqual({
      methods: ['POST'],
      authentication: 'token',
    });
    expect(
      registry.webhookOf(
        hook({
          methods: { fixed: ['GET', 'POST'] },
          authentication: { fixed: 'signature' },
        }),
      ),
    ).toEqual({ methods: ['GET', 'POST'], authentication: 'signature' });
  });

  it('a_node_that_is_not_a_webhook_or_is_misconfigured_has_no_settings', () => {
    expect(registry.webhookOf(new Node(aNode('a')))).toBeNull();
    expect(registry.webhookOf(hook({ methods: { fixed: [] } }))).toBeNull();
  });

  it('its_settings_are_fixed_values_only', () => {
    const node = hook({ authentication: { formula: '{{ "token" }}' } });
    const graph = new Graph({
      nodes: [
        aNode('hook', {
          type: 'webhook',
          trigger: TriggerType.Webhook,
          parameters: node.parameters,
        }),
      ],
      connections: [],
    });
    expect(registry.problemsOf(graph.node('hook'), graph)).toEqual([
      expect.objectContaining({
        parameter: 'authentication',
        code: ProblemCode.InvalidParameter,
      }),
    ]);
  });
});
