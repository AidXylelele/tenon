import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import type { Edge, MiniMapProps, Node, ReactFlowProps } from '@xyflow/react';
import type { ELK } from 'elkjs/lib/elk-api';
import ELKBundled from 'elkjs/lib/elk.bundled.js';
import type { ComponentType, MouseEvent } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { JsonObject } from '@/libs/document-text/json';
import type { TaskProgress } from '@/operations/run-progress';
import type { FlowEdgeData } from './flow-edge';
import { END, START } from './graph';
import type { CanvasNodeData } from './nodes';
import { chooseDirection, setCollapsed } from './view-preferences';
import { type Reveal, WorkflowCanvas } from './workflow-canvas';

type Flow = ReactFlowProps<Node<CanvasNodeData>, Edge<FlowEdgeData>>;

const view = { fitView: vi.fn(), setViewport: vi.fn() };
const engine = vi.fn<() => Promise<ELK>>();
let flow: Flow | null = null;
let minimap: MiniMapProps<Node<CanvasNodeData>> | null = null;

// React Flow, reduced to the props the canvas gives it, with each node drawn by its own type
// and the panels in place: jsdom cannot measure what React Flow positions.
vi.mock('@xyflow/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@xyflow/react')>();
  return {
    ...actual,
    ReactFlowProvider: ({ children }: { readonly children: React.ReactNode }) =>
      children,
    useReactFlow: () => view,
    ReactFlow: (props: Flow) => {
      flow = props;
      return (
        <div>
          {props.nodes?.map((node) => {
            const Type = props.nodeTypes?.[node.type ?? ''] as
              | ComponentType<{ readonly id: string; readonly data: unknown }>
              | undefined;

            if (Type === undefined) return null;

            return <Type key={node.id} id={node.id} data={node.data} />;
          })}
          {props.children}
        </div>
      );
    },
    Background: () => null,
    Controls: () => null,
    MiniMap: (props: MiniMapProps<Node<CanvasNodeData>>) => {
      minimap = props;
      return null;
    },
    Panel: ({ children }: { readonly children: React.ReactNode }) => (
      <div>{children}</div>
    ),
    Handle: () => null,
  };
});

// The page's ELK, as the bundled engine that lays out on this thread.
vi.mock('./elk-engine', () => ({ elkEngine: () => engine() }));

const document: JsonObject = {
  document: {
    dsl: '1.0.3',
    namespace: 'sales',
    name: 'route-lead',
    version: '1.0.0',
  },
  do: [
    { fetch: { set: { lead: '${ .lead }' } } },
    {
      route: {
        switch: [{ big: { when: '${ .big }', then: 'notify' } }],
      },
    },
    {
      each: {
        for: { each: 'x', in: '${ .xs }' },
        do: [{ inner: { set: { b: 1 } } }],
      },
    },
    {
      enrich: {
        try: [{ a: { set: { a: 1 } } }, { b: { set: { b: 2 } } }],
        catch: { do: [{ fallback: { set: { fallback: true } } }] },
      },
    },
    {
      both: {
        fork: {
          branches: [{ left: { set: { l: 1 } } }, { right: { set: { r: 1 } } }],
        },
      },
    },
    { notify: { set: { told: true }, then: 'end' } },
  ],
};

const flat: JsonObject = {
  do: [{ only: { set: { a: 1 } } }],
};

const onSelect = vi.fn<(id: string | null) => void>();
const onConnect =
  vi.fn<(source: string, caseIndex: number | null, target: string) => void>();
const onDisconnect =
  vi.fn<(source: string, caseIndex: number | null) => void>();
const observers: { readonly callback: () => void; disconnected: boolean }[] =
  [];

// The props React Flow was last given.
function current(): Flow {
  if (flow === null) throw new Error('React Flow was not drawn');

  return flow;
}

// The node React Flow was given for an id.
function nodeOf(id: string): Node<CanvasNodeData> {
  const node = current().nodes?.find((each) => each.id === id);

  if (node === undefined) throw new Error(`No node ${id}`);

  return node;
}

// The edge React Flow was given for an id.
function edgeOf(id: string): Edge<FlowEdgeData> {
  const edge = current().edges?.find((each) => each.id === id);

  if (edge === undefined) throw new Error(`No edge ${id}`);

  return edge;
}

// Whether the canvas draws a group closed.
function isClosed(id: string): boolean {
  return nodeOf(id).data.node.collapsed;
}

// Waits until the graph is laid out and handed to React Flow.
async function laidOut() {
  await waitFor(() => {
    expect(screen.queryByText(/Drawing the workflow/)).not.toBeInTheDocument();
    expect(current().nodes?.length ?? 0).toBeGreaterThan(0);
  });
}

// The box the canvas's frame takes on the page.
function frameOf(width: number, height: number) {
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
    width,
    height,
  } as DOMRect);
}

// A run's progress by step.
function progress(
  entries: Record<string, TaskProgress['status']>,
): ReadonlyMap<string, TaskProgress> {
  const pairs = Object.entries(entries).map(
    ([pointer, status]): [string, TaskProgress] => [
      pointer,
      { status, runs: 1, attempt: 1, retryAt: null },
    ],
  );
  return new Map(pairs);
}

const click = {} as MouseEvent;

beforeEach(() => {
  flow = null;
  minimap = null;
  observers.length = 0;
  view.fitView.mockReset();
  view.setViewport.mockReset();
  onSelect.mockReset();
  onConnect.mockReset();
  onDisconnect.mockReset();
  engine.mockReset();
  engine.mockResolvedValue(new ELKBundled());
  vi.stubGlobal('matchMedia', () => ({
    matches: false,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
  vi.stubGlobal(
    'ResizeObserver',
    class {
      private readonly entry: {
        readonly callback: () => void;
        disconnected: boolean;
      };

      constructor(callback: () => void) {
        this.entry = { callback, disconnected: false };
        observers.push(this.entry);
      }

      observe() {}

      disconnect() {
        this.entry.disconnected = true;
      }
    },
  );
});

// The arrangement lasts as long as the page; each test starts with none.
afterEach(() => {
  vi.restoreAllMocks();
  act(() => {
    chooseDirection('down');
    setCollapsed('sales/route-lead', []);
    setCollapsed('/', []);
  });
  window.localStorage.clear();
});

describe('a workflow on the canvas', () => {
  it('a_line_says_it_is_drawn_until_the_layout_comes', () => {
    engine.mockReturnValue(new Promise<ELK>(() => undefined));

    render(<WorkflowCanvas document={document} />);

    expect(screen.getByText(/Drawing the workflow/)).toBeInTheDocument();
    expect(current().nodes).toEqual([]);
  });

  it('a_layout_that_fails_points_at_the_code_view', async () => {
    engine.mockRejectedValue(new Error('No worker'));

    render(<WorkflowCanvas document={document} />);

    expect(
      await screen.findByText(
        'The canvas could not be drawn. The Code view shows the whole document.',
      ),
    ).toBeInTheDocument();
  });

  it('every_step_is_a_node_where_the_layout_put_it_and_none_is_dragged', async () => {
    render(<WorkflowCanvas document={document} />);
    await laidOut();
    const inner = nodeOf('/do/2/each/do/0/inner');

    expect(nodeOf(START).type).toBe('start');
    expect(nodeOf(END).type).toBe('end');
    expect(nodeOf('/do/2/each').type).toBe('block');
    expect(nodeOf('/do/3/enrich/catch/do').type).toBe('handler');
    expect(inner.parentId).toBe('/do/2/each');
    expect(inner.draggable).toBe(false);
    expect(typeof inner.position.x).toBe('number');
    expect(screen.getByRole('button', { name: /fetch/ })).toBeInTheDocument();
  });

  it('a_refresh_with_an_equal_document_lays_nothing_out_again', async () => {
    const { rerender } = render(<WorkflowCanvas document={document} />);
    await laidOut();
    const copy = structuredClone(document);
    rerender(<WorkflowCanvas document={copy} />);
    const afterCopy = engine.mock.calls.length;

    rerender(<WorkflowCanvas document={flat} />);
    await waitFor(() => expect(nodeOf('/do/0/only')).toBeDefined());

    expect(afterCopy).toBe(1);
    expect(engine).toHaveBeenCalledTimes(2);
  });

  it('read_only_nothing_connects_or_is_removed', async () => {
    render(<WorkflowCanvas document={document} />);
    await laidOut();
    const removable = current().edges?.filter((edge) => edge.deletable);

    expect(current().nodesConnectable).toBe(false);
    expect(current().elementsSelectable).toBe(false);
    expect(current().deleteKeyCode).toBeNull();
    expect(removable).toEqual([]);
  });

  it('while_editing_only_jumps_cases_and_ends_can_be_removed', async () => {
    render(<WorkflowCanvas document={document} editable />);
    await laidOut();
    const kinds = current()
      .edges?.filter((edge) => edge.deletable)
      .map((edge) => edge.data?.edge.kind);

    expect(current().deleteKeyCode).toEqual(['Backspace', 'Delete']);
    expect(new Set(kinds)).toEqual(new Set(['case', 'end']));
    expect(nodeOf('add:/do/2/each/do').type).toBe('add');
  });

  it('a_node_picked_picks_its_step_and_a_handler_picks_its_try', async () => {
    render(<WorkflowCanvas document={document} editable onSelect={onSelect} />);
    await laidOut();
    const fetch = nodeOf('/do/0/fetch');
    const handler = nodeOf('/do/3/enrich/catch/do');

    current().onNodeClick?.(click, fetch);
    current().onNodeClick?.(click, handler);
    current().onNodeClick?.(click, nodeOf(END));
    current().onNodeClick?.(click, nodeOf('add:/do/2/each/do'));
    current().onPaneClick?.(click);

    expect(onSelect.mock.calls).toEqual([
      ['/do/0/fetch'],
      ['/do/3/enrich'],
      [null],
    ]);
  });

  it('a_step_picked_with_the_keyboard_is_picked_too', async () => {
    render(<WorkflowCanvas document={document} onSelect={onSelect} />);
    await laidOut();

    fireEvent.keyDown(screen.getByRole('button', { name: /fetch/ }), {
      key: 'Enter',
    });

    expect(onSelect).toHaveBeenCalledWith('/do/0/fetch');
  });

  it('a_connection_from_a_case_says_which_case_and_from_a_step_says_none', async () => {
    render(
      <WorkflowCanvas document={document} editable onConnect={onConnect} />,
    );
    await laidOut();

    current().onConnect?.({
      source: '/do/1/route',
      sourceHandle: 'case-0',
      target: '/do/0/fetch',
      targetHandle: 'in',
    });
    current().onConnect?.({
      source: '/do/0/fetch',
      sourceHandle: 'out',
      target: '/do/5/notify',
      targetHandle: 'in',
    });

    expect(onConnect.mock.calls).toEqual([
      ['/do/1/route', 0, '/do/0/fetch'],
      ['/do/0/fetch', null, '/do/5/notify'],
    ]);
  });

  it('a_connection_without_a_listener_changes_nothing', async () => {
    render(<WorkflowCanvas document={document} editable />);
    await laidOut();

    const connect = () =>
      current().onConnect?.({
        source: '/do/0/fetch',
        sourceHandle: null,
        target: '/do/5/notify',
        targetHandle: null,
      });

    expect(connect).not.toThrow();
  });

  it.each([
    ['two_steps_of_one_list', '/do/0/fetch', '/do/5/notify', true],
    [
      'a_step_and_one_inside_a_block',
      '/do/0/fetch',
      '/do/2/each/do/0/inner',
      false,
    ],
    ['a_step_and_itself', '/do/0/fetch', '/do/0/fetch', false],
    ['the_start_and_a_step', START, '/do/0/fetch', false],
    [
      'two_branches_of_a_fork',
      '/do/4/both/fork/branches/0/left',
      '/do/4/both/fork/branches/1/right',
      false,
    ],
  ])(
    'a_connection_between_%s_is_one_the_dsl_can_say_%s',
    async (_, source, target, valid) => {
      render(<WorkflowCanvas document={document} editable />);
      await laidOut();
      const connection = {
        source,
        target,
        sourceHandle: null,
        targetHandle: null,
      };

      expect(current().isValidConnection?.(connection)).toBe(valid);
    },
  );

  it('a_removed_jump_or_case_is_reported_once_each', async () => {
    render(
      <WorkflowCanvas
        document={document}
        editable
        onDisconnect={onDisconnect}
      />,
    );
    await laidOut();
    const ending = edgeOf('end:/do/5/notify:out>end');
    const choice = edgeOf('case:/do/1/route:case-0>/do/5/notify');
    const bare = { id: 'bare', source: 'a', target: 'b' };

    current().onEdgesDelete?.([ending, choice, bare]);

    expect(onDisconnect.mock.calls).toEqual([
      ['/do/5/notify', null],
      ['/do/1/route', 0],
    ]);
  });

  it('a_removal_without_a_listener_changes_nothing', async () => {
    render(<WorkflowCanvas document={document} editable />);
    await laidOut();
    const ending = edgeOf('end:/do/5/notify:out>end');

    const remove = () => current().onEdgesDelete?.([ending]);

    expect(remove).not.toThrow();
  });
});

describe('a run on the canvas', () => {
  it('the_way_it_went_is_taken_and_into_a_running_step_it_moves', async () => {
    const seen = progress({
      '/do/0/fetch': 'completed',
      '/do/1/route': 'running',
    });
    render(
      <WorkflowCanvas document={document} progress={seen} phase="running" />,
    );
    await laidOut();
    const into = edgeOf('next:start:out>/do/0/fetch');
    const onward = edgeOf('next:/do/0/fetch:out>/do/1/route');
    const untaken = edgeOf('case:/do/1/route:case-0>/do/5/notify');

    expect(into.data?.taken).toBe(true);
    expect(into.data?.live).toBe(false);
    expect(onward.data?.taken).toBe(true);
    expect(onward.data?.live).toBe(true);
    expect(onward.markerEnd).toMatchObject({ color: 'var(--edge-taken)' });
    expect(untaken.data?.taken).toBe(false);
    expect(untaken.markerEnd).toMatchObject({ color: 'var(--edge-choice)' });
  });

  it('a_block_whose_steps_ran_counts_as_ran', async () => {
    const seen = progress({
      '/do/0/fetch': 'completed',
      '/do/1/route': 'completed',
      '/do/2/each/do/0/inner': 'completed',
    });
    render(
      <WorkflowCanvas document={document} progress={seen} phase="running" />,
    );
    await laidOut();

    expect(edgeOf('next:/do/1/route:out>/do/2/each').data?.taken).toBe(true);
  });

  it.each([
    ['completed' as const, true],
    ['faulted' as const, false],
  ])(
    'the_way_to_the_end_is_taken_only_by_a_run_that_%s',
    async (phase, taken) => {
      const seen = progress({ '/do/5/notify': 'completed' });
      render(
        <WorkflowCanvas document={document} progress={seen} phase={phase} />,
      );
      await laidOut();

      expect(edgeOf('end:/do/5/notify:out>end').data?.taken).toBe(taken);
    },
  );

  it('without_a_run_nothing_is_taken', async () => {
    render(<WorkflowCanvas document={document} />);
    await laidOut();
    const taken = current().edges?.filter((edge) => edge.data?.taken);

    expect(taken).toEqual([]);
  });

  it('a_closed_block_opens_while_a_run_is_inside_it_or_faulted_there', async () => {
    setCollapsed('sales/route-lead', ['/do/2/each', '/do/3/enrich']);
    const inside = progress({ '/do/2/each/do/0/inner': 'running' });
    const { rerender } = render(<WorkflowCanvas document={document} />);
    await laidOut();
    const closedBefore = isClosed('/do/2/each');

    rerender(
      <WorkflowCanvas
        document={document}
        progress={inside}
        faultAt="/do/3/enrich/try/1/b"
        phase="running"
      />,
    );

    await waitFor(() => expect(isClosed('/do/2/each')).toBe(false));
    expect(closedBefore).toBe(true);
    expect(isClosed('/do/3/enrich')).toBe(false);
  });

  it('a_run_elsewhere_keeps_the_closed_blocks_closed', async () => {
    setCollapsed('sales/route-lead', ['/do/2/each']);
    const elsewhere = progress({ '/do/0/fetch': 'running' });
    render(
      <WorkflowCanvas
        document={document}
        progress={elsewhere}
        phase="running"
      />,
    );
    await laidOut();

    expect(isClosed('/do/2/each')).toBe(true);
  });
});

describe('the viewer arranging the canvas', () => {
  it('closes_and_opens_every_block_at_once', async () => {
    render(<WorkflowCanvas document={document} />);
    await laidOut();

    fireEvent.click(screen.getByRole('button', { name: 'Close every block' }));
    await waitFor(() => expect(isClosed('/do/2/each')).toBe(true));
    const closed = ['/do/3/enrich', '/do/3/enrich/catch/do', '/do/4/both'].map(
      isClosed,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Open every block' }));
    await waitFor(() => expect(isClosed('/do/2/each')).toBe(false));

    expect(closed).toEqual([true, true, true]);
  });

  it('a_block_toggled_on_the_canvas_closes', async () => {
    render(<WorkflowCanvas document={document} />);
    await laidOut();
    const [toggle] = screen.getAllByRole('button', { name: 'Hide the steps' });

    if (toggle === undefined) throw new Error('No block to close');

    fireEvent.click(toggle);

    await waitFor(() => expect(isClosed('/do/2/each')).toBe(true));
  });

  it('a_workflow_without_blocks_offers_nothing_to_open_or_close', async () => {
    render(<WorkflowCanvas document={flat} />);
    await laidOut();

    expect(
      screen.queryByRole('button', { name: 'Close every block' }),
    ).not.toBeInTheDocument();
  });

  it('a_small_graph_is_shown_whole_and_centred', async () => {
    frameOf(5000, 4000);
    render(<WorkflowCanvas document={flat} />);
    await laidOut();

    await waitFor(() => expect(view.setViewport).toHaveBeenCalledTimes(1));
    const [shown] = view.setViewport.mock.calls[0] ?? [];
    expect(shown).toMatchObject({ zoom: 1 });
    expect(shown.x).toBeGreaterThan(0);
    expect(shown.y).toBeGreaterThan(0);
  });

  it('a_graph_too_big_to_read_whole_opens_at_a_readable_zoom_from_its_start', async () => {
    frameOf(400, 300);
    render(<WorkflowCanvas document={document} />);
    await laidOut();
    await waitFor(() => expect(view.setViewport).toHaveBeenCalledTimes(1));
    const start = nodeOf(START).position;

    expect(view.setViewport).toHaveBeenCalledWith({
      x: 200 - (start.x + 136) * 0.9,
      y: 48 - start.y * 0.9,
      zoom: 0.9,
    });
  });

  it('turned_left_to_right_it_is_laid_out_and_shown_again', async () => {
    frameOf(400, 300);
    render(<WorkflowCanvas document={document} />);
    await laidOut();
    await waitFor(() => expect(view.setViewport).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole('radio', { name: 'Left to right' }));
    await waitFor(() => expect(view.setViewport).toHaveBeenCalledTimes(2));
    const start = nodeOf(START).position;

    expect(engine).toHaveBeenCalledTimes(2);
    expect(view.setViewport).toHaveBeenLastCalledWith({
      x: 48 - start.x * 0.9,
      y: 150 - (start.y + 36) * 0.9,
      zoom: 0.9,
    });
  });

  it('a_canvas_drawn_hidden_is_shown_once_it_has_a_size', async () => {
    render(<WorkflowCanvas document={flat} />);
    await laidOut();
    const hidden = view.setViewport.mock.calls.length;
    frameOf(5000, 4000);

    act(() => observers.forEach((observer) => observer.callback()));

    expect(hidden).toBe(0);
    expect(view.setViewport).toHaveBeenCalledTimes(1);
    expect(observers.every((observer) => observer.disconnected)).toBe(true);
  });

  it('a_node_asked_for_is_brought_into_view_once_per_request', async () => {
    const asked: Reveal = { id: '/do/5/notify' };
    const again: Reveal = { id: '/do/5/notify' };
    const { rerender } = render(<WorkflowCanvas document={document} />);
    await laidOut();

    rerender(<WorkflowCanvas document={document} reveal={asked} />);
    rerender(<WorkflowCanvas document={document} reveal={asked} />);
    const once = view.fitView.mock.calls.length;
    rerender(<WorkflowCanvas document={document} reveal={again} />);

    expect(once).toBe(1);
    expect(view.fitView).toHaveBeenCalledTimes(2);
    expect(view.fitView).toHaveBeenCalledWith({
      nodes: [{ id: '/do/5/notify' }],
      duration: 300,
      maxZoom: 1,
      padding: 0.6,
    });
  });

  it('a_node_not_on_the_canvas_is_not_looked_for', async () => {
    const missing: Reveal = { id: '/do/9/gone' };
    render(<WorkflowCanvas document={document} reveal={missing} />);
    await laidOut();

    expect(view.fitView).not.toHaveBeenCalled();
  });

  it('it_follows_the_system_colour_scheme', async () => {
    vi.stubGlobal('matchMedia', () => ({
      matches: true,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }));
    render(<WorkflowCanvas document={flat} />);
    await laidOut();

    expect(current().colorMode).toBe('dark');
  });

  it('the_map_shows_blocks_muted_and_the_ends_in_the_accent', async () => {
    render(<WorkflowCanvas document={document} />);
    await laidOut();
    const colour = minimap?.nodeColor;

    if (typeof colour !== 'function') throw new Error('No map colours');

    expect(colour(nodeOf('/do/2/each'))).toBe('var(--color-muted)');
    expect(colour(nodeOf('/do/3/enrich/catch/do'))).toBe('var(--color-muted)');
    expect(colour(nodeOf(START))).toBe('var(--color-primary)');
    expect(colour(nodeOf(END))).toBe('var(--color-primary)');
    expect(colour(nodeOf('/do/0/fetch'))).toBe('var(--color-border)');
  });

  it('a_document_without_a_header_keeps_its_arrangement_all_the_same', async () => {
    const headless: JsonObject = {
      do: [
        {
          each: {
            for: { each: 'x', in: '${ .xs }' },
            do: [{ a: { set: { a: 1 } } }],
          },
        },
      ],
    };
    render(<WorkflowCanvas document={headless} />);
    await laidOut();

    fireEvent.click(screen.getByRole('button', { name: 'Close every block' }));

    await waitFor(() => expect(isClosed('/do/0/each')).toBe(true));
    expect(window.localStorage.getItem('canvas.collapsed:/')).toBe(
      '["/do/0/each"]',
    );
  });
});
