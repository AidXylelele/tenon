import { GraphFaultCode, TriggerType } from '../../../src/domain/enums.js';
import {
  InvalidGraphError,
  NodeNotFoundError,
} from '../../../src/domain/errors.js';
import { Graph } from '../../../src/domain/graph.js';
import {
  aGraph,
  aNode,
  aTrigger,
  link,
} from '../../support/automation-builders.js';

const faultsOf = (build: () => Graph) => {
  try {
    build();
  } catch (error) {
    if (error instanceof InvalidGraphError) return error.faults;
    throw error;
  }
  return [];
};

const ids = (nodes: readonly { id: string }[]) => nodes.map((node) => node.id);

describe('Graph', () => {
  it('a_well_formed_graph_keeps_its_nodes_and_connections_in_the_saved_order', () => {
    const graph = aGraph(
      [aTrigger('start'), aNode('a'), aNode('b')],
      [link('start', 'a'), link('a', 'b', 'true', 'main')],
    );
    expect(ids(graph.nodes)).toEqual(['start', 'a', 'b']);
    expect(
      graph.connections.map((connection) => [
        connection.from.id,
        connection.output,
        connection.to.id,
        connection.input,
      ]),
    ).toEqual([
      ['start', 'main', 'a', 'main'],
      ['a', 'true', 'b', 'main'],
    ]);
  });

  it('an_empty_graph_is_well_formed', () => {
    expect(Graph.empty().nodes).toEqual([]);
  });

  it('a_graph_with_a_repeated_node_identifier_is_refused', () => {
    const faults = faultsOf(() =>
      aGraph([aNode('a'), aNode('a', { name: 'b' })]),
    );
    expect(faults).toEqual([
      expect.objectContaining({
        code: GraphFaultCode.DuplicateNodeId,
        nodeId: 'a',
      }),
    ]);
  });

  it('a_connection_to_a_node_outside_the_graph_is_refused', () => {
    const faults = faultsOf(() => aGraph([aNode('a')], [link('a', 'ghost')]));
    expect(faults).toEqual([
      expect.objectContaining({
        code: GraphFaultCode.UnknownConnectionNode,
        nodeId: 'ghost',
      }),
    ]);
  });

  it('two_nodes_with_one_name_are_refused_because_formulas_name_nodes', () => {
    const faults = faultsOf(() =>
      aGraph([aNode('a', { name: 'Same' }), aNode('b', { name: 'Same' })]),
    );
    expect(faults).toEqual([
      expect.objectContaining({
        code: GraphFaultCode.DuplicateNodeName,
        nodeId: 'b',
      }),
    ]);
  });

  it('a_cycle_is_refused', () => {
    const faults = faultsOf(() =>
      aGraph(
        [aTrigger('start'), aNode('a'), aNode('b')],
        [link('start', 'a'), link('a', 'b'), link('b', 'a')],
      ),
    );
    expect(faults).toEqual([
      expect.objectContaining({ code: GraphFaultCode.Cycle }),
    ]);
  });

  it('every_fault_is_reported_at_once', () => {
    const faults = faultsOf(() =>
      aGraph(
        [aNode('a'), aNode('a', { name: 'x' }), aNode('b', { name: 'a' })],
        [link('a', 'ghost')],
      ),
    );
    expect(faults.map((fault) => fault.code).sort()).toEqual(
      [
        GraphFaultCode.DuplicateNodeId,
        GraphFaultCode.DuplicateNodeName,
        GraphFaultCode.UnknownConnectionNode,
      ].sort(),
    );
  });

  it('a_cycle_is_reported_beside_a_repeated_name', () => {
    const faults = faultsOf(() =>
      aGraph(
        [aTrigger('start'), aNode('a'), aNode('b', { name: 'a' })],
        [link('start', 'a'), link('a', 'start')],
      ),
    );
    expect(faults.map((fault) => fault.code).sort()).toEqual(
      [GraphFaultCode.Cycle, GraphFaultCode.DuplicateNodeName].sort(),
    );
  });

  it('a_node_is_found_by_its_identifier_and_an_unknown_one_is_not_found', () => {
    const graph = aGraph([aNode('a')]);
    expect(graph.node('a').id).toBe('a');
    expect(graph.has('a')).toBe(true);
    expect(graph.has('b')).toBe(false);
    expect(() => graph.node('b')).toThrow(NodeNotFoundError);
  });

  it('triggers_are_the_nodes_with_a_trigger_kind', () => {
    const graph = aGraph([
      aTrigger('manual'),
      aNode('a'),
      aNode('hook', { type: 'webhook', trigger: TriggerType.Webhook }),
    ]);
    expect(ids(graph.triggers)).toEqual(['manual', 'hook']);
    expect(ids(graph.triggersOf(TriggerType.Webhook))).toEqual(['hook']);
  });

  it('the_order_from_a_trigger_follows_the_dependencies', () => {
    const graph = aGraph(
      [aNode('c'), aNode('b'), aTrigger('start'), aNode('a')],
      [link('start', 'a'), link('a', 'b'), link('b', 'c')],
    );
    expect(ids(graph.orderFrom(graph.node('start')))).toEqual([
      'start',
      'a',
      'b',
      'c',
    ]);
  });

  it('a_node_with_two_inputs_comes_after_both_branches', () => {
    const graph = aGraph(
      [
        aTrigger('start'),
        aNode('merge', { position: { x: 300, y: 0 } }),
        aNode('lower', { position: { x: 100, y: 100 } }),
        aNode('upper', { position: { x: 100, y: 0 } }),
        aNode('after-upper', { position: { x: 200, y: 0 } }),
      ],
      [
        link('start', 'upper'),
        link('start', 'lower'),
        link('upper', 'after-upper'),
        link('after-upper', 'merge', 'main', 'input1'),
        link('lower', 'merge', 'main', 'input2'),
      ],
    );
    expect(ids(graph.orderFrom(graph.node('start')))).toEqual([
      'start',
      'upper',
      'lower',
      'after-upper',
      'merge',
    ]);
  });

  it('ready_nodes_are_taken_left_to_right_then_top_to_bottom', () => {
    const graph = aGraph(
      [
        aTrigger('start'),
        aNode('bottom', { position: { x: 100, y: 200 } }),
        aNode('top', { position: { x: 100, y: 0 } }),
        aNode('left', { position: { x: 50, y: 300 } }),
      ],
      [link('start', 'bottom'), link('start', 'top'), link('start', 'left')],
    );
    expect(ids(graph.orderFrom(graph.node('start')))).toEqual([
      'start',
      'left',
      'top',
      'bottom',
    ]);
  });

  it('only_nodes_reachable_from_the_firing_trigger_are_ordered', () => {
    const graph = aGraph(
      [
        aTrigger('manual'),
        aTrigger('other'),
        aNode('a'),
        aNode('b'),
        aNode('orphan'),
      ],
      [link('manual', 'a'), link('other', 'b'), link('b', 'a')],
    );
    expect(ids(graph.orderFrom(graph.node('manual')))).toEqual(['manual', 'a']);
  });

  it('the_connections_into_a_node_are_its_incoming_connections', () => {
    const graph = aGraph(
      [aTrigger('start'), aNode('a'), aNode('b')],
      [link('start', 'b', 'main', 'input1'), link('a', 'b', 'main', 'input2')],
    );
    expect(
      graph.incoming(graph.node('b')).map((connection) => connection.from.id),
    ).toEqual(['start', 'a']);
  });

  it('the_upstream_of_a_node_are_all_its_ancestors', () => {
    const graph = aGraph(
      [aTrigger('start'), aNode('a'), aNode('b'), aNode('side'), aNode('c')],
      [link('start', 'a'), link('a', 'b'), link('side', 'b'), link('b', 'c')],
    );
    expect(ids(graph.upstreamOf(graph.node('b'))).sort()).toEqual([
      'a',
      'side',
      'start',
    ]);
  });

  it('a_renamed_node_is_found_by_its_identifier_in_the_previous_graph', () => {
    const previous = aGraph([aNode('a', { name: 'Old' }), aNode('b')]);
    const next = aGraph([aNode('a', { name: 'New' }), aNode('b'), aNode('c')]);
    expect(next.renamesFrom(previous)).toEqual([{ from: 'Old', to: 'New' }]);
  });

  it('keeping_credentials_clears_every_other_credential_reference', () => {
    const graph = aGraph([
      aNode('a', { credentialId: 'mine' }),
      aNode('b', { credentialId: 'theirs' }),
      aNode('c'),
    ]);
    const kept = graph.keepCredentials(new Set(['mine']));
    expect(kept.nodes.map((node) => node.credentialId)).toEqual([
      'mine',
      null,
      null,
    ]);
    expect(graph.credentialIds).toEqual(['mine', 'theirs']);
  });
});
