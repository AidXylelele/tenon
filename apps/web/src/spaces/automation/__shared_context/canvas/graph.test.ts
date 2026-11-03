import { describe, expect, it } from 'vitest';
import type { JsonObject } from '@/libs/data-access/types';
import { END, graphOf, placeOf, START } from './graph';

const document: JsonObject = {
  document: {
    dsl: '1.0.3',
    namespace: 'sales',
    name: 'route-lead',
    version: '1.0.0',
  },
  do: [
    {
      fetch: {
        call: 'http',
        with: { method: 'get', endpoint: 'https://crm.example.com' },
      },
    },
    {
      route: {
        switch: [
          { big: { when: '${ .score > 50 }', then: 'notify' } },
          { otherwise: { then: 'continue' } },
        ],
      },
    },
    { archive: { set: { archived: true }, then: 'end' } },
    {
      notify: {
        emit: {
          event: { with: { source: 'https://x.example', type: 'lead.big' } },
        },
      },
    },
    {
      each: {
        for: { each: 'lead', in: '${ .leads }' },
        do: [{ first: { set: { a: 1 } } }, { second: { set: { b: 2 } } }],
      },
    },
  ],
};

const edgesOf = (graph: ReturnType<typeof graphOf>) =>
  graph.edges.map(
    (each) =>
      `${each.kind} ${each.source} -> ${each.target}${each.label === null ? '' : ` (${each.label})`}`,
  );

describe('a document as a graph', () => {
  it('runs_from_start_through_its_steps_to_the_end', () => {
    const graph = graphOf(document, false);

    expect(graph.nodes[0]?.id).toBe(START);
    expect(graph.nodes.some((node) => node.id === END)).toBe(true);
    expect(edgesOf(graph)).toContain('next start -> /do/0/fetch');
    expect(edgesOf(graph)).toContain('next /do/4/each -> end');
  });

  it('a_choice_draws_one_edge_per_case_to_where_the_case_goes', () => {
    const edges = edgesOf(graphOf(document, false));

    expect(edges).toContain('case /do/1/route -> /do/3/notify (big)');
    expect(edges).toContain('case /do/1/route -> /do/2/archive (otherwise)');
    expect(edges).not.toContain('next /do/1/route -> /do/2/archive');
  });

  it('a_then_replaces_the_next_edge_with_a_jump_or_the_end', () => {
    const edges = edgesOf(graphOf(document, false));

    expect(edges).toContain('end /do/2/archive -> end (then end)');
    expect(edges.some((each) => each.startsWith('next /do/2/archive'))).toBe(
      false,
    );
  });

  it('a_loop_is_a_container_holding_its_steps_connected_inside_it', () => {
    const graph = graphOf(document, false);
    const loop = graph.nodes.find((node) => node.id === '/do/4/each');
    const first = graph.nodes.find(
      (node) => node.id === '/do/4/each/do/0/first',
    );

    expect(loop?.kind).toBe('container');
    expect(loop?.lanes.map((lane) => lane.label)).toEqual(['For each item']);
    expect(first?.parentId).toBe('/do/4/each');
    expect(edgesOf(graph)).toContain(
      'next /do/4/each/do/0/first -> /do/4/each/do/1/second',
    );
  });

  it('parents_come_before_their_children', () => {
    const ids = graphOf(document, false).nodes.map((node) => node.id);

    expect(ids.indexOf('/do/4/each')).toBeLessThan(
      ids.indexOf('/do/4/each/do/0/first'),
    );
  });

  it('while_editing_every_list_ends_with_a_place_to_add_and_edges_carry_their_insertion', () => {
    const graph = graphOf(document, true);
    const add = graph.nodes.find((node) => node.id === 'add:/do/4/each/do');
    const between = graph.edges.find((each) => each.source === '/do/0/fetch');

    expect(add?.addTo).toEqual({ listPointer: '/do/4/each/do', index: 2 });
    expect(between?.insertAt).toEqual({ listPointer: '/do', index: 1 });
  });

  it('read_only_graphs_have_no_places_to_add', () => {
    expect(
      graphOf(document, false).nodes.some((node) => node.kind === 'add'),
    ).toBe(false);
  });

  it('the_steps_of_a_list_do_not_overlap', () => {
    const roots = graphOf(document, false).nodes.filter(
      (node) => node.parentId === null,
    );
    const sorted = roots.slice().sort((a, b) => a.x - b.x);

    sorted.slice(1).forEach((node, index) => {
      const previous = sorted[index];
      expect(node.x).toBeGreaterThanOrEqual(
        (previous?.x ?? 0) + (previous?.width ?? 0),
      );
    });
  });

  it('knows_the_list_and_index_of_a_step_from_its_pointer', () => {
    expect(placeOf('/do/4/each/do/1/second')).toEqual({
      listPointer: '/do/4/each/do',
      index: 1,
    });
    expect(placeOf('start')).toBeNull();
  });
});
