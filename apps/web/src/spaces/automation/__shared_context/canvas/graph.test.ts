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

describe('what the graph shows of flow directives', () => {
  const doc = (tasks: JsonObject[]): JsonObject => ({
    document: { name: 'x' },
    do: tasks,
  });

  it('a_then_exit_at_the_root_ends_the_run_visibly', () => {
    const graph = graphOf(
      doc([
        { stop: { set: { a: 1 }, then: 'exit' } },
        { never: { set: { b: 2 } } },
      ]),
      false,
    );

    expect(edgesOf(graph)).toContain('end /do/0/stop -> end (then exit)');
  });

  it('a_then_exit_inside_a_block_marks_the_step_as_leaving_it', () => {
    const graph = graphOf(
      doc([
        {
          group: {
            do: [{ out: { set: {}, then: 'exit' } }, { skipped: { set: {} } }],
          },
        },
      ]),
      false,
    );
    const out = graph.nodes.find((node) => node.id === '/do/0/group/do/0/out');

    expect(out?.leaves).toBe(true);
    expect(
      graph.edges.some((each) => each.source === '/do/0/group/do/0/out'),
    ).toBe(false);
  });

  it('a_choice_without_a_default_shows_where_no_match_goes', () => {
    const graph = graphOf(
      doc([
        { route: { switch: [{ big: { when: '${ . > 1 }', then: 'end' } }] } },
        { next: { set: {} } },
      ]),
      false,
    );

    expect(edgesOf(graph)).toContain(
      'next /do/0/route -> /do/1/next (no match)',
    );
  });

  it('a_case_keeps_its_position_in_the_document_even_after_a_broken_item', () => {
    const graph = graphOf(
      doc([
        { route: { switch: ['broken', { only: { then: 'continue' } }] } },
        { next: { set: {} } },
      ]),
      false,
    );
    const route = graph.nodes.find((node) => node.id === '/do/0/route');

    expect(route?.cases.map((each) => each.index)).toEqual([1]);
    expect(graph.edges.find((each) => each.kind === 'case')?.sourceHandle).toBe(
      'case-1',
    );
  });

  it('the_branches_of_a_fork_are_marked_and_not_connected_to_each_other', () => {
    const graph = graphOf(
      doc([
        {
          both: {
            fork: { branches: [{ a: { set: {} } }, { b: { set: {} } }] },
          },
        },
      ]),
      false,
    );
    const a = graph.nodes.find(
      (node) => node.id === '/do/0/both/fork/branches/0/a',
    );

    expect(a?.branch).toBe(true);
    expect(graph.edges.some((each) => each.source.includes('/branches/'))).toBe(
      false,
    );
  });

  it('a_choice_is_measured_to_hold_its_cases', () => {
    const graph = graphOf(
      doc([
        {
          route: {
            switch: [{ a: { then: 'continue' } }, { b: { then: 'continue' } }],
          },
        },
      ]),
      false,
    );
    const route = graph.nodes.find((node) => node.id === '/do/0/route');

    expect(route?.height).toBe(64 + 2 * 24 + 8);
  });
});
