import { fireEvent, render, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CanvasProvider, type CanvasState } from './canvas-context';
import {
  FlowEdge,
  type FlowEdgeData,
  roundedPath,
  strokeOf,
} from './flow-edge';
import type { CanvasEdge, EdgeKind } from './graph';
import type { PlacedLabel, Point } from './layout';

// React Flow's edge, reduced to the path it draws and how; its labels render in place.
vi.mock('@xyflow/react', () => ({
  BaseEdge: ({
    id,
    path,
    style,
    className,
  }: {
    readonly id: string;
    readonly path: string;
    readonly style: React.CSSProperties;
    readonly className?: string;
  }) => (
    <span
      data-testid={`edge ${id}`}
      data-path={path}
      data-stroke={style.stroke}
      data-width={String(style.strokeWidth)}
      data-dashed={String(style.strokeDasharray !== undefined)}
      className={className}
    />
  ),
  EdgeLabelRenderer: ({ children }: { readonly children: React.ReactNode }) =>
    children,
}));

const onInsert = vi.fn<(listPointer: string, index: number) => void>();

const STATE: CanvasState = {
  editable: true,
  direction: 'down',
  selected: null,
  flagged: null,
  progress: null,
  faultAt: null,
  phase: null,
  trigger: 'By hand',
  onSelect: () => undefined,
  onInsert,
  onToggle: () => undefined,
};

const DOWN: readonly Point[] = [
  { x: 0, y: 0 },
  { x: 0, y: 100 },
];

type EdgeComponentProps = ComponentProps<typeof FlowEdge>;

// An edge of a kind from one step to the next, with what it says and where a step adds.
function edgeOf(kind: EdgeKind, label: string | null = null): CanvasEdge {
  return {
    id: `${kind}:a:out>b`,
    source: '/do/0/a',
    target: '/do/1/b',
    port: 'out',
    kind,
    label,
    insertAt: { listPointer: '/do', index: 1 },
    caseIndex: null,
  };
}

// An edge drawn on a canvas in a state, along its route with its labels.
function draw(
  data: Partial<FlowEdgeData> & { readonly edge: CanvasEdge },
  changes: Partial<CanvasState> = {},
  picked = false,
) {
  const state = { ...STATE, ...changes };
  const props = {
    id: data.edge.id,
    selected: picked,
    data: { points: DOWN, labels: [], taken: false, live: false, ...data },
  } as EdgeComponentProps;
  return render(
    <CanvasProvider value={state}>
      <FlowEdge {...props} />
    </CanvasProvider>,
  );
}

// Where ELK kept a label of a role.
function labelAt(role: PlacedLabel['role'], x: number, y: number): PlacedLabel {
  return { role, x, y, width: 26, height: 26 };
}

describe('a route as a path', () => {
  it('nothing_to_route_is_no_path', () => {
    expect(roundedPath([])).toBe('');
  });

  it('a_straight_route_is_one_line', () => {
    expect(roundedPath(DOWN)).toBe('M 0 0 L 0 100');
  });

  it('a_corner_is_rounded_by_a_quarter_curve', () => {
    const corner = [
      { x: 0, y: 0 },
      { x: 0, y: 100 },
      { x: 100, y: 100 },
    ];

    expect(roundedPath(corner)).toBe('M 0 0 L 0 90 Q 0 100 10 100 L 100 100');
  });

  it('a_short_leg_takes_a_smaller_curve', () => {
    const corner = [
      { x: 0, y: 0 },
      { x: 0, y: 8 },
      { x: 100, y: 8 },
    ];

    expect(roundedPath(corner)).toBe('M 0 0 L 0 4 Q 0 8 10 8 L 100 8');
  });

  it('a_repeated_point_starts_its_curve_where_it_stands', () => {
    const repeated = [
      { x: 0, y: 0 },
      { x: 0, y: 0 },
      { x: 0, y: 50 },
    ];

    expect(roundedPath(repeated)).toBe('M 0 0 L 0 0 Q 0 0 0 10 L 0 50');
  });
});

describe('a connection on the canvas', () => {
  beforeEach(() => {
    onInsert.mockReset();
  });

  it.each<[EdgeKind, string]>([
    ['next', 'var(--edge-neutral)'],
    ['append', 'var(--edge-faint)'],
    ['case', 'var(--edge-choice)'],
    ['jump', 'var(--edge-choice)'],
    ['end', 'var(--edge-neutral)'],
    ['exit', 'var(--edge-neutral)'],
    ['error', 'var(--edge-failure)'],
  ])('a_%s_edge_has_its_colour', (kind, stroke) => {
    expect(strokeOf(kind)).toBe(stroke);
  });

  it('goes_on_as_a_solid_line_and_leaves_as_a_dashed_one', () => {
    const next = edgeOf('next');
    const exit = edgeOf('exit');
    const { unmount } = draw({ edge: next });
    const solid = screen.getByTestId(`edge ${next.id}`).dataset.dashed;
    unmount();
    draw({ edge: exit });

    expect(solid).toBe('false');
    expect(screen.getByTestId(`edge ${exit.id}`).dataset.dashed).toBe('true');
  });

  it('the_way_a_run_went_is_thicker_in_its_own_colour_and_moves_while_it_runs', () => {
    const next = edgeOf('next');
    draw({ edge: next, taken: true, live: true });
    const path = screen.getByTestId(`edge ${next.id}`);

    expect(path.dataset.stroke).toBe('var(--edge-taken)');
    expect(path.dataset.width).toBe('2.5');
    expect(path).toHaveClass('flow-edge-live');
  });

  it('picked_for_removal_it_keeps_its_colour_inside_a_halo_and_is_thicker', () => {
    const jump = edgeOf('jump');
    draw({ edge: jump }, {}, true);
    const path = screen.getByTestId(`edge ${jump.id}`);

    expect(screen.getByTestId(`halo ${jump.id}`)).toBeInTheDocument();
    expect(path.dataset.stroke).toBe('var(--edge-choice)');
    expect(path.dataset.width).toBe('2.5');
  });

  it('not_picked_it_has_no_halo', () => {
    const jump = edgeOf('jump');
    draw({ edge: jump });

    expect(screen.queryByTestId(`halo ${jump.id}`)).not.toBeInTheDocument();
  });

  it('without_a_route_it_draws_nothing', () => {
    const next = edgeOf('next');
    const point = [{ x: 0, y: 0 }];
    const { container } = draw({ edge: next, points: point });

    expect(container).toBeEmptyDOMElement();
  });

  it.each<[EdgeKind, string]>([
    ['case', 'text-violet-700'],
    ['jump', 'text-violet-700'],
    ['error', 'text-rose-700'],
    ['end', 'text-muted-foreground'],
  ])('a_%s_edge_says_what_it_means', (kind, colour) => {
    const said = edgeOf(kind, 'Go to notify');
    const label = labelAt('label', 10, 40);
    draw({ edge: said, labels: [label] });

    expect(screen.getByText('Go to notify')).toHaveClass(colour);
  });

  it('while_editing_a_plus_on_the_line_adds_a_step_there', () => {
    const next = edgeOf('next');
    const add = labelAt('add', 40, 40);
    draw({ edge: next, labels: [add] });
    const button = screen.getByRole('button', { name: 'Add a step here' });

    fireEvent.click(button);

    expect(onInsert).toHaveBeenCalledWith('/do', 1);
    expect(button.parentElement).toHaveStyle({ left: '-13px', top: '40px' });
  });

  it('the_plus_sits_at_the_nearest_point_of_a_route_with_corners', () => {
    const next = edgeOf('next');
    const corner = [
      { x: 0, y: 0 },
      { x: 0, y: 100 },
      { x: 200, y: 100 },
    ];
    const add = labelAt('add', 120, 120);
    draw({ edge: next, labels: [add], points: corner });
    const button = screen.getByRole('button', { name: 'Add a step here' });

    expect(button.parentElement).toHaveStyle({ left: '120px', top: '87px' });
  });

  it('read_only_there_is_no_plus', () => {
    const next = edgeOf('next');
    const add = labelAt('add', 40, 40);
    draw({ edge: next, labels: [add] }, { editable: false });

    expect(
      screen.queryByRole('button', { name: 'Add a step here' }),
    ).not.toBeInTheDocument();
  });
});
