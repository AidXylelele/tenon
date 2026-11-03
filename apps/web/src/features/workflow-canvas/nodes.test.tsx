import { fireEvent, render, screen } from '@testing-library/react';
import type { ComponentProps, ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { JsonObject } from '@/libs/document-text/json';
import type { TaskProgress } from '@/operations/run-progress';
import { CanvasProvider, type CanvasState } from './canvas-context';
import { type CanvasNode, END, graphOf, handlerId, START } from './graph';
import {
  AddNode,
  EndNode,
  GroupNode,
  HandlerNode,
  StartNode,
  TaskNode,
} from './nodes';

// React Flow's handle, reduced to where it anchors and whether a connection leaves from it.
vi.mock('@xyflow/react', () => ({
  Handle: ({
    id,
    type,
    position,
    isConnectable,
    style,
    className,
  }: {
    readonly id: string;
    readonly type: string;
    readonly position: string;
    readonly isConnectable: boolean;
    readonly style?: React.CSSProperties;
    readonly className?: string;
  }) => (
    <span
      data-testid={`port ${id}`}
      data-type={type}
      data-position={position}
      data-connectable={String(isConnectable)}
      className={className}
      style={style}
    />
  ),
  Position: { Top: 'top', Bottom: 'bottom', Left: 'left', Right: 'right' },
}));

const document: JsonObject = {
  document: {
    dsl: '1.0.3',
    namespace: 'sales',
    name: 'route-lead',
    version: '1.0.0',
    summary: 'Routes a lead.',
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
          { small: { when: '${ .score < 10 }', then: 'continue' } },
        ],
      },
    },
    {
      callIt: {
        try: [
          {
            post: {
              call: 'http',
              with: { method: 'post', endpoint: 'https://x.example' },
            },
          },
        ],
        catch: {
          retry: { delay: { seconds: 2 }, limit: { attempt: { count: 3 } } },
        },
      },
    },
    {
      tolerate: {
        try: [{ tell: { set: { told: true } } }],
        catch: {},
      },
    },
    {
      each: {
        for: { each: 'lead', in: '${ .leads }' },
        do: [{ first: { set: { a: 1 } } }, { second: { set: { b: 2 } } }],
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
    { notify: { set: { told: true } } },
    {
      stop: {
        raise: {
          error: {
            type: 'https://x.example/errors/stop',
            status: 400,
            title: 'Stopped',
          },
        },
      },
    },
  ],
};

const onSelect = vi.fn<(id: string | null) => void>();
const onInsert = vi.fn<(listPointer: string, index: number) => void>();
const onToggle = vi.fn<(id: string) => void>();

const READING: CanvasState = {
  editable: false,
  direction: 'down',
  selected: null,
  flagged: null,
  progress: null,
  faultAt: null,
  phase: null,
  trigger: 'By hand',
  onSelect,
  onInsert,
  onToggle,
};

type NodeComponentProps = ComponentProps<typeof TaskNode>;

// A node of the document's graph, read-only and open unless asked otherwise.
function nodeAt(
  id: string,
  options: { readonly editable?: boolean; readonly collapsed?: string[] } = {},
): CanvasNode {
  const editable = options.editable ?? false;
  const collapsed = new Set(options.collapsed ?? []);
  const graph = graphOf(document, { editable, collapsed });
  const node = graph.nodes.find((each) => each.id === id);

  if (node === undefined) throw new Error(`No node ${id}`);

  return node;
}

// What React Flow gives a node component; the canvas's nodes read only their data.
function propsOf(
  node: CanvasNode,
  ports: NodeComponentProps['data']['ports'] = {},
): NodeComponentProps {
  return { id: node.id, data: { node, ports } } as NodeComponentProps;
}

// A node drawn on a canvas in a state.
function draw(element: ReactNode, changes: Partial<CanvasState> = {}) {
  const state = { ...READING, ...changes };
  return render(<CanvasProvider value={state}>{element}</CanvasProvider>);
}

// A step's progress on a run.
function progress(
  entries: Record<string, Partial<TaskProgress>>,
): ReadonlyMap<string, TaskProgress> {
  const pairs = Object.entries(entries).map(
    ([pointer, seen]): [string, TaskProgress] => [
      pointer,
      { status: 'running', runs: 1, attempt: 1, retryAt: null, ...seen },
    ],
  );
  return new Map(pairs);
}

describe('the start of a workflow', () => {
  beforeEach(() => {
    onSelect.mockReset();
  });

  it('says_how_a_run_begins_and_what_the_workflow_does', () => {
    const start = nodeAt(START);
    draw(<StartNode {...propsOf(start)} />, { trigger: 'By hand' });

    expect(screen.getByText('Start')).toBeInTheDocument();
    expect(screen.getByText('By hand')).toBeInTheDocument();
    expect(screen.getByText('Routes a lead.')).toBeInTheDocument();
  });

  it.each([
    ['Every 5 minutes', 'lucide-calendar-clock'],
    ['On a schedule', 'lucide-calendar-clock'],
    ['Once, 5 minutes after it is turned on', 'lucide-calendar-clock'],
    ['When an event arrives', 'lucide-radio'],
    ['By hand', 'lucide-hand'],
  ])('a_trigger_of_%s_has_its_icon', (trigger, icon) => {
    const start = nodeAt(START);
    const { container } = draw(<StartNode {...propsOf(start)} />, {
      trigger,
    });

    expect(container.querySelector(`.${icon}`)).not.toBeNull();
  });

  it('enter_picks_it', () => {
    const start = nodeAt(START);
    draw(<StartNode {...propsOf(start)} />);

    fireEvent.keyDown(screen.getByRole('button'), { key: 'Enter' });

    expect(onSelect).toHaveBeenCalledWith(START);
  });

  it('a_run_that_began_rings_it', () => {
    const start = nodeAt(START);
    draw(<StartNode {...propsOf(start)} />, { phase: 'running' });

    expect(screen.getByRole('button')).toHaveAttribute('data-started', 'true');
  });

  it('a_problem_with_the_trigger_marks_it', () => {
    const start = nodeAt(START);
    draw(<StartNode {...propsOf(start)} />, { flagged: START });

    expect(screen.getByRole('button')).toHaveAttribute('data-flagged', 'true');
  });
});

describe('a node without its canvas', () => {
  it('is_a_mistake_said_plainly', () => {
    const end = nodeAt(END);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const drawn = () => render(<EndNode {...propsOf(end)} />);

    expect(drawn).toThrow('A canvas node is drawn outside its canvas');
  });
});

describe('the end of a workflow', () => {
  it.each([
    ['completed' as const, 'lucide-circle-check'],
    ['faulted' as const, 'lucide-flag'],
    ['cancelled' as const, 'lucide-flag'],
  ])('a_run_that_is_%s_marks_it_so', (phase, icon) => {
    const end = nodeAt(END);
    const { container } = draw(<EndNode {...propsOf(end)} />, { phase });
    const node = screen.getByText('End');

    expect(node).toHaveAttribute('data-phase', phase);
    expect(container.querySelector(`.${icon}`)).not.toBeNull();
  });

  it('a_workflow_without_a_run_leaves_it_unmarked', () => {
    const end = nodeAt(END);
    const { container } = draw(<EndNode {...propsOf(end)} />, { phase: null });
    const node = screen.getByText('End');

    expect(node).not.toHaveAttribute('data-phase');
    expect(container.querySelector('.lucide-flag')).not.toBeNull();
  });
});

describe('a step on the canvas', () => {
  beforeEach(() => {
    onSelect.mockReset();
  });

  it('shows_its_name_its_kind_what_it_does_and_its_note', () => {
    const fetch = nodeAt('/do/0/fetch');
    draw(<TaskNode {...propsOf(fetch)} />);

    expect(
      screen.getByRole('button', { name: 'fetch, Call a URL' }),
    ).toBeInTheDocument();
    expect(screen.getByText('GET https://crm.example.com')).toBeInTheDocument();
    expect(screen.getByText('The lead as the CRM has it')).toBeInTheDocument();
  });

  it.each(['Enter', ' '])('the_%s_key_picks_it', (key) => {
    const fetch = nodeAt('/do/0/fetch');
    draw(<TaskNode {...propsOf(fetch)} />);

    fireEvent.keyDown(screen.getByRole('button'), { key });

    expect(onSelect).toHaveBeenCalledWith('/do/0/fetch');
  });

  it('another_key_picks_nothing', () => {
    const fetch = nodeAt('/do/0/fetch');
    draw(<TaskNode {...propsOf(fetch)} />);

    fireEvent.keyDown(screen.getByRole('button'), { key: 'a' });

    expect(onSelect).not.toHaveBeenCalled();
  });

  it('the_picked_step_is_pressed_and_one_with_a_problem_says_so', () => {
    const fetch = nodeAt('/do/0/fetch');
    draw(<TaskNode {...propsOf(fetch)} />, {
      selected: '/do/0/fetch',
      flagged: '/do/0/fetch',
    });

    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByLabelText('Has a problem')).toBeInTheDocument();
  });

  it('a_step_protected_on_its_own_is_drawn_as_that_step_with_its_retry', () => {
    const callIt = nodeAt('/do/2/callIt');
    draw(<TaskNode {...propsOf(callIt)} />);

    expect(
      screen.getByRole('button', { name: 'post, Call a URL' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Retries up to 3 times, 2 seconds apart'),
    ).toBeInTheDocument();
  });

  it('a_problem_in_the_protected_step_marks_its_node', () => {
    const callIt = nodeAt('/do/2/callIt');
    draw(<TaskNode {...propsOf(callIt)} />, {
      flagged: '/do/2/callIt/try/0/post',
    });

    expect(screen.getByLabelText('Has a problem')).toBeInTheDocument();
  });

  it('a_step_whose_failure_is_let_through_says_the_run_goes_on', () => {
    const tolerate = nodeAt('/do/3/tolerate');
    draw(<TaskNode {...propsOf(tolerate)} />);

    expect(screen.getByText('Goes on if it fails')).toBeInTheDocument();
  });

  it('a_choice_has_a_port_per_case_and_one_for_when_none_matches', () => {
    const route = nodeAt('/do/1/route');
    draw(<TaskNode {...propsOf(route)} />);

    expect(screen.getByTestId('port case-0')).toBeInTheDocument();
    expect(screen.getByTestId('port case-1')).toBeInTheDocument();
    expect(screen.getByTestId('port out')).toBeInTheDocument();
  });

  it('a_choice_with_a_default_case_leaves_only_through_its_cases', () => {
    const chosen: JsonObject = {
      document: { dsl: '1.0.3', namespace: 'n', name: 'w', version: '1.0.0' },
      do: [
        {
          route: {
            switch: [
              { big: { when: '${ .big }', then: 'end' } },
              { rest: { then: 'continue' } },
            ],
          },
        },
      ],
    };
    const graph = graphOf(chosen, { editable: false, collapsed: new Set() });
    const route = graph.nodes.find((each) => each.id === '/do/0/route');

    if (route === undefined) throw new Error('No route');

    draw(<TaskNode {...propsOf(route)} />);

    expect(screen.queryByTestId('port out')).not.toBeInTheDocument();
  });

  it('a_raise_ends_its_path_and_has_no_way_on', () => {
    const stop = nodeAt('/do/8/stop');
    draw(<TaskNode {...propsOf(stop)} />);

    expect(screen.getByText('Fail: Stopped')).toBeInTheDocument();
    expect(screen.queryByTestId('port out')).not.toBeInTheDocument();
  });

  it('while_editing_its_way_on_can_be_dragged_and_read_only_it_cannot', () => {
    const editing = nodeAt('/do/0/fetch', { editable: true });
    const reading = nodeAt('/do/0/fetch');
    const { unmount } = draw(<TaskNode {...propsOf(editing)} />, {
      editable: true,
    });
    const dragged = screen.getByTestId('port out').dataset.connectable;
    unmount();
    draw(<TaskNode {...propsOf(reading)} />);

    expect(dragged).toBe('true');
    expect(screen.getByTestId('port out').dataset.connectable).toBe('false');
  });

  it('a_branch_of_a_fork_connects_to_nothing_beside_it', () => {
    const left = nodeAt('/do/6/both/fork/branches/0/left', { editable: true });
    draw(<TaskNode {...propsOf(left)} />, { editable: true });

    expect(screen.getByTestId('port out').dataset.connectable).toBe('false');
  });

  it.each([
    ['down' as const, 'top', 'bottom', { left: '120px' }],
    ['right' as const, 'left', 'right', { top: '30px' }],
  ])(
    'running_%s_its_ports_sit_where_the_direction_and_the_layout_put_them',
    (direction, into, onward, style) => {
      const fetch = nodeAt('/do/0/fetch');
      const ports = { in: { x: 120, y: 30 }, out: { x: 120, y: 30 } };
      draw(<TaskNode {...propsOf(fetch, ports)} />, { direction });
      const input = screen.getByTestId('port in');
      const output = screen.getByTestId('port out');

      expect(input.dataset.position).toBe(into);
      expect(output.dataset.position).toBe(onward);
      expect(input).toHaveStyle(style);
    },
  );

  it('a_node_that_is_not_a_step_draws_nothing', () => {
    const start = nodeAt(START);
    const { container } = draw(<TaskNode {...propsOf(start)} />);

    expect(container).toBeEmptyDOMElement();
  });
});

describe('a step on a run', () => {
  it('a_running_step_says_so_with_the_try_it_is_on', () => {
    const fetch = nodeAt('/do/0/fetch');
    const seen = progress({ '/do/0/fetch': { status: 'running', attempt: 2 } });
    draw(<TaskNode {...propsOf(fetch)} />, {
      progress: seen,
      phase: 'running',
    });

    expect(screen.getByText('Running')).toBeInTheDocument();
    expect(screen.getByText('try 2')).toBeInTheDocument();
    expect(screen.getByRole('button')).toHaveAttribute(
      'data-status',
      'running',
    );
  });

  it('a_finished_step_counts_its_tries_and_its_runs', () => {
    const fetch = nodeAt('/do/0/fetch');
    const seen = progress({
      '/do/0/fetch': { status: 'completed', attempt: 3, runs: 4 },
    });
    draw(<TaskNode {...propsOf(fetch)} />, {
      progress: seen,
      phase: 'completed',
    });

    expect(screen.getByText('Completed')).toBeInTheDocument();
    expect(screen.getByText('3 tries')).toBeInTheDocument();
    expect(screen.getByText('×4')).toBeInTheDocument();
  });

  it('a_step_waiting_to_be_tried_again_counts_down_to_it', () => {
    const fetch = nodeAt('/do/0/fetch');
    const seen = progress({
      '/do/0/fetch': {
        status: 'faulted',
        attempt: 2,
        retryAt: '2999-01-01T00:00:00Z',
      },
    });
    draw(<TaskNode {...propsOf(fetch)} />, {
      progress: seen,
      phase: 'running',
    });

    expect(screen.getByText(/Tries again/)).toBeInTheDocument();
    expect(screen.queryByText('try 2')).not.toBeInTheDocument();
    expect(screen.getByRole('button')).toHaveAttribute(
      'data-status',
      'retrying',
    );
  });

  it('a_run_that_ended_tries_nothing_again_so_the_step_stays_faulted', () => {
    const fetch = nodeAt('/do/0/fetch');
    const seen = progress({
      '/do/0/fetch': { status: 'faulted', retryAt: '2999-01-01T00:00:00Z' },
    });
    draw(<TaskNode {...propsOf(fetch)} />, {
      progress: seen,
      phase: 'faulted',
    });

    expect(screen.getByText('Faulted')).toBeInTheDocument();
    expect(screen.queryByText(/Tries again/)).not.toBeInTheDocument();
  });

  it('where_the_run_faulted_is_faulted_even_without_a_record', () => {
    const fetch = nodeAt('/do/0/fetch');
    draw(<TaskNode {...propsOf(fetch)} />, {
      faultAt: '/do/0/fetch',
      phase: 'faulted',
      progress: new Map(),
    });

    expect(screen.getByText('Faulted')).toBeInTheDocument();
  });

  it('a_protected_step_reports_through_the_step_it_protects', () => {
    const callIt = nodeAt('/do/2/callIt');
    const seen = progress({ '/do/2/callIt/try/0/post': { status: 'skipped' } });
    draw(<TaskNode {...propsOf(callIt)} />, {
      progress: seen,
      phase: 'completed',
    });

    expect(screen.getByText('Skipped')).toBeInTheDocument();
  });
});

describe('a block on the canvas', () => {
  beforeEach(() => {
    onSelect.mockReset();
    onToggle.mockReset();
  });

  it('open_it_heads_its_steps_and_offers_to_hide_them', () => {
    const each = nodeAt('/do/4/each');
    draw(<GroupNode {...propsOf(each)} />);
    const toggle = screen.getByRole('button', { name: 'Hide the steps' });

    fireEvent.click(toggle);

    expect(
      screen.getByRole('button', { name: 'each, Repeat for each item' }),
    ).toBeInTheDocument();
    expect(screen.getByText('For each lead in ${ .leads }')).toBeVisible();
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(onToggle).toHaveBeenCalledWith('/do/4/each');
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('closed_it_counts_its_steps_and_offers_to_show_them', () => {
    const each = nodeAt('/do/4/each', { collapsed: ['/do/4/each'] });
    draw(<GroupNode {...propsOf(each)} />);

    expect(
      screen.getByText('Repeat for each item, 2 steps'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Show the steps' }),
    ).toHaveAttribute('aria-expanded', 'false');
  });

  it.each(['Enter', ' '])('the_%s_key_picks_it', (key) => {
    const each = nodeAt('/do/4/each');
    draw(<GroupNode {...propsOf(each)} />);

    fireEvent.keyDown(
      screen.getByRole('button', { name: 'each, Repeat for each item' }),
      { key },
    );

    expect(onSelect).toHaveBeenCalledWith('/do/4/each');
  });

  it('another_key_picks_nothing', () => {
    const each = nodeAt('/do/4/each');
    draw(<GroupNode {...propsOf(each)} />);

    fireEvent.keyDown(
      screen.getByRole('button', { name: 'each, Repeat for each item' }),
      { key: 'Tab' },
    );

    expect(onSelect).not.toHaveBeenCalled();
  });

  it('a_fork_says_how_its_branches_run', () => {
    const both = nodeAt('/do/6/both');
    draw(<GroupNode {...propsOf(both)} />);

    expect(screen.getByText('Every branch runs at once')).toBeInTheDocument();
  });

  it('a_try_with_steps_for_its_failures_has_a_port_for_them', () => {
    const enrich = nodeAt('/do/5/enrich');
    draw(<GroupNode {...propsOf(enrich)} />);

    expect(screen.getByTestId('port err').dataset.position).toBe('right');
  });

  it('closed_on_a_run_it_shows_the_status_of_what_it_holds', () => {
    const each = nodeAt('/do/4/each', { collapsed: ['/do/4/each'] });
    const seen = progress({ '/do/4/each': { status: 'running' } });
    draw(<GroupNode {...propsOf(each)} />, {
      progress: seen,
      phase: 'running',
    });

    expect(screen.getByText('Running')).toBeInTheDocument();
  });

  it('a_fault_inside_it_faults_the_block', () => {
    const each = nodeAt('/do/4/each');
    draw(<GroupNode {...propsOf(each)} />, {
      faultAt: '/do/4/each/do/1/second',
      phase: 'faulted',
    });

    expect(screen.getByText('Faulted')).toBeInTheDocument();
  });

  it('a_node_that_is_not_a_block_draws_nothing', () => {
    const end = nodeAt(END);
    const { container } = draw(<GroupNode {...propsOf(end)} />);

    expect(container).toBeEmptyDOMElement();
  });
});

describe('the steps a try runs when it fails', () => {
  beforeEach(() => {
    onToggle.mockReset();
  });

  it('are_named_after_their_try_and_can_be_hidden', () => {
    const id = handlerId('/do/5/enrich');
    const handler = nodeAt(id);
    draw(<HandlerNode {...propsOf(handler)} />);

    fireEvent.click(screen.getByRole('button', { name: 'Hide the steps' }));

    expect(screen.getByText('If enrich fails')).toBeInTheDocument();
    expect(screen.getByText('These steps run instead')).toBeInTheDocument();
    expect(onToggle).toHaveBeenCalledWith(id);
  });

  it('closed_they_are_counted', () => {
    const id = handlerId('/do/5/enrich');
    const handler = nodeAt(id, { collapsed: [id] });
    draw(<HandlerNode {...propsOf(handler)} />);

    expect(screen.getByText('1 step run instead')).toBeInTheDocument();
  });

  it('a_run_that_used_them_marks_them', () => {
    const id = handlerId('/do/5/enrich');
    const handler = nodeAt(id);
    const seen = progress({ [`${id}/0/fallback`]: { status: 'completed' } });
    const { container } = draw(<HandlerNode {...propsOf(handler)} />, {
      progress: seen,
    });

    expect(container.firstElementChild).toHaveAttribute('data-used', 'true');
  });

  it('a_node_that_is_not_a_handler_draws_nothing', () => {
    const start = nodeAt(START);
    const { container } = draw(<HandlerNode {...propsOf(start)} />);

    expect(container).toBeEmptyDOMElement();
  });
});

describe('the place a list takes a new step', () => {
  beforeEach(() => {
    onInsert.mockReset();
  });

  it('adds_a_step_at_the_end_of_its_list', () => {
    const add = nodeAt('add:/do/4/each/do', { editable: true });
    draw(<AddNode {...propsOf(add)} />, { editable: true });

    fireEvent.click(screen.getByRole('button', { name: 'Add step' }));

    expect(onInsert).toHaveBeenCalledWith('/do/4/each/do', 2);
  });

  it('a_node_that_adds_nothing_draws_nothing', () => {
    const fetch = nodeAt('/do/0/fetch');
    const { container } = draw(<AddNode {...propsOf(fetch)} />);

    expect(container).toBeEmptyDOMElement();
  });
});
