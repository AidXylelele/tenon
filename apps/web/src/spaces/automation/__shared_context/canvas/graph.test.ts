import { describe, expect, it } from 'vitest';
import type { JsonObject } from '@/libs/data-access/types';
import { addId, END, graphOf, handlerId, placeOf, START } from './graph';

const document: JsonObject = {
  document: {
    dsl: '1.0.3',
    namespace: 'sales',
    name: 'route-lead',
    version: '1.0.0',
    summary: 'Routes a lead to sales or to the archive.',
  },
  do: [
    {
      fetch: {
        call: 'http',
        with: { method: 'get', endpoint: 'https://crm.example.com' },
        metadata: { note: 'The lead as the CRM has it' },
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
        do: [
          { first: { set: { a: 1 } } },
          { quit: { set: { b: 2 }, then: 'exit' } },
        ],
      },
    },
  ],
};

const READ = { editable: false, collapsed: new Set<string>() };
const EDIT = { editable: true, collapsed: new Set<string>() };

const edgesOf = (graph: ReturnType<typeof graphOf>) =>
  graph.edges.map(
    (each) =>
      `${each.kind} ${each.source} -> ${each.target}${each.label === null ? '' : ` (${each.label})`}`,
  );

describe('a document as a graph', () => {
  it('runs_from_start_through_its_steps_to_the_end', () => {
    const graph = graphOf(document, READ);
    const start = graph.nodes[0];

    expect(start?.id).toBe(START);
    expect(start?.note).toBe('Routes a lead to sales or to the archive.');
    expect(graph.nodes.some((node) => node.id === END)).toBe(true);
    expect(edgesOf(graph)).toContain('next start -> /do/0/fetch');
    expect(edgesOf(graph)).toContain('next /do/4/each -> end');
  });

  it('a_choice_draws_one_edge_per_case_from_its_own_port', () => {
    const graph = graphOf(document, READ);
    const cases = graph.edges.filter((each) => each.kind === 'case');

    expect(edgesOf(graph)).toContain('case /do/1/route -> /do/3/notify (big)');
    expect(edgesOf(graph)).toContain(
      'case /do/1/route -> /do/2/archive (otherwise (otherwise))',
    );
    expect(cases.map((each) => each.port)).toEqual(['case-0', 'case-1']);
    expect(edgesOf(graph)).not.toContain('next /do/1/route -> /do/2/archive');
  });

  it('a_then_replaces_the_next_edge_with_a_jump_the_end_or_a_way_out', () => {
    const edges = edgesOf(graphOf(document, READ));

    expect(edges).toContain('end /do/2/archive -> end (End the run)');
    expect(edges).toContain(
      'exit /do/4/each/do/1/quit -> end (Leave the block)',
    );
    expect(edges.some((each) => each.startsWith('next /do/2/archive'))).toBe(
      false,
    );
  });

  it('a_loop_is_a_group_holding_its_steps_connected_inside_it', () => {
    const graph = graphOf(document, READ);
    const first = graph.nodes.find(
      (node) => node.id === '/do/4/each/do/0/first',
    );

    expect(graph.nodes.find((node) => node.id === '/do/4/each')?.kind).toBe(
      'group',
    );
    expect(first?.parentId).toBe('/do/4/each');
    expect(edgesOf(graph)).toContain(
      'next /do/4/each/do/0/first -> /do/4/each/do/1/quit',
    );
  });

  it('a_note_shows_under_its_step_and_makes_room_for_itself', () => {
    const graph = graphOf(document, READ);
    const fetch = graph.nodes.find((node) => node.id === '/do/0/fetch');
    const archive = graph.nodes.find((node) => node.id === '/do/2/archive');

    expect(fetch?.note).toBe('The lead as the CRM has it');
    expect(fetch?.height).toBeGreaterThan(archive?.height ?? 0);
  });

  it('a_closed_group_is_one_node_that_counts_its_steps', () => {
    const collapsed = new Set(['/do/4/each']);
    const graph = graphOf(document, { editable: false, collapsed });
    const loop = graph.nodes.find((node) => node.id === '/do/4/each');

    expect(loop?.collapsed).toBe(true);
    expect(loop?.steps).toBe(2);
    expect(graph.nodes.some((node) => node.parentId === '/do/4/each')).toBe(
      false,
    );
    expect(
      graph.edges.some((each) => each.source.startsWith('/do/4/each/')),
    ).toBe(false);
  });

  it('while_editing_offers_a_step_on_every_next_edge_and_at_the_end_of_every_block', () => {
    const graph = graphOf(document, EDIT);
    const onward = graph.edges.find(
      (each) => each.source === '/do/3/notify' && each.target === '/do/4/each',
    );

    expect(onward?.insertAt).toEqual({ listPointer: '/do', index: 4 });
    expect(
      graph.nodes.find((node) => node.id === addId('/do/4/each/do'))?.addTo,
    ).toEqual({ listPointer: '/do/4/each/do', index: 2 });
  });

  it('places_a_step_by_its_pointer_even_with_escaped_names', () => {
    expect(placeOf('/do/2/a~1b')).toEqual({ listPointer: '/do', index: 2 });
    expect(placeOf('/do')).toBeNull();
  });
});

describe('failure handling on the graph', () => {
  const handled: JsonObject = {
    document: { dsl: '1.0.3', namespace: 'n', name: 'w', version: '1.0.0' },
    do: [
      {
        callIt: {
          try: [
            {
              fetchIt: {
                call: 'http',
                with: { method: 'get', endpoint: 'https://x.example' },
              },
            },
          ],
          catch: {
            retry: { delay: { seconds: 2 }, limit: { attempt: { count: 3 } } },
          },
        },
      },
      {
        enrich: {
          try: [{ a: { set: { a: 1 } } }, { b: { set: { b: 2 } } }],
          catch: {
            as: 'error',
            do: [{ fallback: { set: { fallback: true } } }],
          },
        },
      },
      { after: { set: { done: true } } },
    ],
  };

  it('a_step_protected_on_its_own_is_drawn_as_that_step_with_its_retry', () => {
    const graph = graphOf(handled, READ);
    const node = graph.nodes.find((each) => each.id === '/do/0/callIt');

    expect(node?.kind).toBe('task');
    expect(node?.protection?.step.name).toBe('fetchIt');
    expect(node?.protection?.retry).toBe(
      'Retries up to 3 times, 2 seconds apart',
    );
    expect(graph.nodes.some((each) => each.parentId === '/do/0/callIt')).toBe(
      false,
    );
  });

  it('a_try_with_steps_for_its_failures_is_a_block_and_a_handler_joined_by_a_failure_edge', () => {
    const graph = graphOf(handled, READ);
    const handler = graph.nodes.find(
      (each) => each.id === handlerId('/do/1/enrich'),
    );
    const edges = edgesOf(graph);

    expect(graph.nodes.find((each) => each.id === '/do/1/enrich')?.kind).toBe(
      'group',
    );
    expect(handler?.kind).toBe('handler');
    expect(handler?.parentId).toBeNull();
    expect(edges).toContain(
      'error /do/1/enrich -> /do/1/enrich/catch/do (If it fails)',
    );
    expect(edges).toContain('next /do/1/enrich -> /do/2/after');
    expect(edges).toContain('next /do/1/enrich/catch/do -> /do/2/after');
    expect(edges).toContain(
      'next /do/1/enrich/try/0/a -> /do/1/enrich/try/1/b',
    );
  });
});
