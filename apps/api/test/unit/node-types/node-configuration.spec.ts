import { z } from 'zod';
import {
  OnError,
  ProblemCode,
  TriggerType,
} from '../../../src/domain/enums.js';
import type { NodeProps } from '../../../src/domain/interfaces.js';
import type { NodeType } from '../../../src/interface-adapters/node-types/node-type.js';
import { NodeTypeRegistry } from '../../../src/interface-adapters/node-types/node-type.registry.js';
import {
  aGraph,
  aNode,
  aTrigger,
  defaultSettings,
  link,
} from '../../support/automation-builders.js';

const routeType: NodeType = {
  id: 'route',
  version: 1,
  kind: 'transform',
  trigger: null,
  category: 'Flow',
  displayName: 'Route',
  description: 'Routes items',
  parameters: z.strictObject({
    field: z.string().min(1),
    limit: z.number().int().min(1).default(5),
    pattern: z
      .string()
      .optional()
      .superRefine((value, context) => {
        if (value === '(') {
          context.addIssue({
            code: 'custom',
            message: 'The pattern is not a valid regular expression',
            params: { problem: ProblemCode.InvalidRegex },
          });
        }
      }),
    mode: z.enum(['a', 'b']).default('a'),
  }),
  inputs: ['main'],
  outputsParameter: null,
  outputsFor: (parameters) =>
    parameters.mode === 'b' ? ['b1', 'b2'] : ['main'],
  credentialTypes: [],
  defaultSettings: defaultSettings({ retry: { attempts: 2, waitMs: 100 } }),
  fixedParameters: ['mode'],
  execute: () => Promise.resolve({}),
};

const registry = new NodeTypeRegistry([routeType]);

const route = (overrides: Partial<NodeProps> = {}) =>
  aNode('route-1', {
    type: 'route',
    parameters: { field: { fixed: 'name' } },
    ...overrides,
  });

const problemsOf = (
  node: NodeProps,
  extra: NodeProps[] = [],
  links = [link('start', node.id)],
) => {
  const graph = aGraph([aTrigger('start'), node, ...extra], links);
  return registry.problemsOf(graph.node(node.id), graph);
};

describe('NodeTypeRegistry', () => {
  it('describes_a_known_type_with_its_trigger_kind_default_settings_and_credential_types', () => {
    expect(registry.describe('route', 1)).toEqual({
      trigger: null,
      defaultSettings: defaultSettings({ retry: { attempts: 2, waitMs: 100 } }),
      credentialTypes: [],
    });
    expect(registry.describe('route', 2)).toBeNull();
  });

  it('a_well_configured_node_has_no_problems', () => {
    expect(problemsOf(route())).toEqual([]);
  });

  it('a_node_of_an_unknown_type_or_version_is_a_problem', () => {
    expect(problemsOf(route({ typeVersion: 9 }))).toEqual([
      expect.objectContaining({
        nodeId: 'route-1',
        parameter: null,
        code: ProblemCode.UnknownNodeType,
      }),
    ]);
  });

  it('a_fixed_value_against_the_definition_is_an_invalid_parameter_named_by_its_path', () => {
    expect(
      problemsOf(
        route({ parameters: { field: { fixed: '' }, limit: { fixed: 0 } } }),
      ),
    ).toEqual([
      expect.objectContaining({
        code: ProblemCode.InvalidParameter,
        parameter: 'field',
      }),
      expect.objectContaining({
        code: ProblemCode.InvalidParameter,
        parameter: 'limit',
      }),
    ]);
  });

  it('a_required_parameter_bound_to_a_field_or_formula_is_checked_only_when_the_node_runs', () => {
    expect(
      problemsOf(
        route({
          parameters: {
            field: { ref: { node: '$item', path: 'name' } },
            limit: { formula: '{{ $json.size }}' },
          },
        }),
      ),
    ).toEqual([]);
  });

  it('a_value_that_is_not_a_binding_and_an_unknown_parameter_are_invalid', () => {
    expect(
      problemsOf(route({ parameters: { field: 'name', extra: { fixed: 1 } } })),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: ProblemCode.InvalidParameter,
          parameter: 'field',
        }),
        expect.objectContaining({
          code: ProblemCode.InvalidParameter,
          parameter: null,
        }),
      ]),
    );
  });

  it('formula_syntax_and_scope_problems_are_reported_by_parameter', () => {
    expect(
      problemsOf(
        route({
          parameters: {
            field: { formula: '{{ $json. }}' },
            pattern: { formula: '{{ secrets }}' },
          },
        }),
      ),
    ).toEqual([
      expect.objectContaining({
        code: ProblemCode.FormulaSyntax,
        parameter: 'field',
      }),
      expect.objectContaining({
        code: ProblemCode.FormulaScope,
        parameter: 'pattern',
      }),
    ]);
  });

  it('an_invalid_regular_expression_is_its_own_problem', () => {
    expect(
      problemsOf(
        route({
          parameters: { field: { fixed: 'a' }, pattern: { fixed: '(' } },
        }),
      ),
    ).toEqual([
      expect.objectContaining({
        code: ProblemCode.InvalidRegex,
        parameter: 'pattern',
      }),
    ]);
  });

  it('a_parameter_that_takes_only_fixed_values_refuses_a_formula', () => {
    expect(
      problemsOf(
        route({
          parameters: { field: { fixed: 'a' }, mode: { formula: '{{ "b" }}' } },
        }),
      ),
    ).toEqual([
      expect.objectContaining({
        code: ProblemCode.InvalidParameter,
        parameter: 'mode',
      }),
    ]);
  });

  it('a_connection_on_a_port_the_node_does_not_have_is_an_unknown_port', () => {
    const after = aNode('after');
    expect(
      problemsOf(
        route(),
        [after],
        [
          link('start', 'route-1', 'main', 'side'),
          link('route-1', 'after', 'b1'),
        ],
      ),
    ).toEqual([
      expect.objectContaining({
        code: ProblemCode.UnknownPort,
        nodeId: 'route-1',
      }),
      expect.objectContaining({
        code: ProblemCode.UnknownPort,
        nodeId: 'route-1',
      }),
    ]);
  });

  it('ports_that_depend_on_parameters_and_the_error_output_are_known', () => {
    const node = route({
      parameters: { field: { fixed: 'a' }, mode: { fixed: 'b' } },
      settings: defaultSettings({ onError: OnError.ErrorOutput }),
    });
    expect(
      problemsOf(
        node,
        [aNode('x'), aNode('y')],
        [
          link('start', 'route-1'),
          link('route-1', 'x', 'b2'),
          link('route-1', 'y', 'error'),
        ],
      ),
    ).toEqual([]);
  });

  it('a_credential_on_a_node_that_takes_none_is_a_mismatch', () => {
    expect(problemsOf(route({ credentialId: 'credential-1' }))).toEqual([
      expect.objectContaining({ code: ProblemCode.CredentialTypeMismatch }),
    ]);
  });

  it('the_catalogue_lists_every_type_with_the_json_schema_of_its_parameters', () => {
    const [entry] = registry.list();
    expect(entry).toMatchObject({
      id: 'route',
      version: 1,
      kind: 'transform',
      trigger: null,
      displayName: 'Route',
      inputs: ['main'],
      outputs: ['main'],
    });
    expect(entry!.parameters).toMatchObject({
      type: 'object',
      properties: { field: { type: 'string' } },
      required: ['field'],
    });
  });

  it('a_trigger_type_is_described_with_its_kind', () => {
    const trigger: NodeType = {
      ...routeType,
      id: 'hook',
      kind: 'trigger',
      trigger: TriggerType.Webhook,
      inputs: [],
    };
    expect(new NodeTypeRegistry([trigger]).describe('hook', 1)?.trigger).toBe(
      TriggerType.Webhook,
    );
  });
});
