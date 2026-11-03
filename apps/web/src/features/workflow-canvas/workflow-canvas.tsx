'use client';

import {
  Background,
  BackgroundVariant,
  type Connection,
  Controls,
  type Edge,
  type EdgeChange,
  MarkerType,
  MiniMap,
  type Node,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
} from '@xyflow/react';
import { cn } from 'cn';
import { useEffect, useMemo, useRef, useState } from 'react';
import { usePrefersDark } from '@/libs/ui/hooks/use-prefers-dark';
import type { Phase } from '@/libs/data-access/types';
import { isObject, type JsonObject } from '@/libs/document-text/json';
import { Spinner } from '@/libs/ui/components/spinner';
import type { TaskProgress } from '@/operations/run-progress';
import { describeTrigger, triggerOf } from '@/operations/workflow-document';
import { CanvasProvider, type CanvasState } from './canvas-context';
import { CanvasToolbar } from './canvas-toolbar';
import { elkEngine } from './elk-engine';
import { FlowEdge, type FlowEdgeData, strokeOf } from './flow-edge';
import {
  type CanvasEdge,
  caseIndexOf,
  END,
  type Graph,
  graphOf,
  isBranchList,
  placeOf,
  START,
} from './graph';
import { type Direction, IN, type Placement, placementOf } from './layout';
import {
  AddNode,
  type CanvasNodeData,
  EndNode,
  GroupNode,
  HandlerNode,
  StartNode,
  TaskNode,
} from './nodes';
import {
  chooseDirection,
  setCollapsed,
  toggleCollapsed,
  useCollapsed,
  useDirection,
} from './view-preferences';

const NODE_TYPES = {
  start: StartNode,
  end: EndNode,
  task: TaskNode,
  block: GroupNode,
  handler: HandlerNode,
  add: AddNode,
};

const EDGE_TYPES = { flow: FlowEdge };

export interface WorkflowCanvasProps {
  readonly document: JsonObject;
  readonly editable?: boolean;
  readonly selected?: string | null;
  readonly flagged?: string | null;
  readonly progress?: ReadonlyMap<string, TaskProgress> | null;
  readonly faultAt?: string | null;
  readonly phase?: Phase | null;
  readonly onSelect?: (id: string | null) => void;
  readonly onInsert?: (listPointer: string, index: number) => void;
  // A dragged connection from a step, or from a case of a choice by its position in the
  // document, to another step of the same list.
  readonly onConnect?: (
    source: string,
    caseIndex: number | null,
    target: string,
  ) => void;
  // A jump, an end or a case removed with the Delete key: the step it leaves from, and the
  // position of its case, as `onConnect` gives them.
  readonly onDisconnect?: (source: string, caseIndex: number | null) => void;
  // A node to bring into view, as when a fault or a link points at a step; a new request each
  // time, so the same node can be shown again.
  readonly reveal?: Reveal | null;
  readonly className?: string;
}

export interface Reveal {
  readonly id: string;
}

interface LaidOut {
  readonly graph: Graph;
  readonly direction: Direction;
  readonly placement: Placement;
}

const NOTHING = () => undefined;

const PAD = 48;
const READABLE_ZOOM = 0.9;
const MAX_ZOOM = 1;
const REVEAL_MS = 300;
const REVEAL_PADDING = 0.6;

// The workflow as a graph (FR-022, FR-028): the builder edits on it, a run's page colours it.
export function WorkflowCanvas(props: WorkflowCanvasProps) {
  return (
    <ReactFlowProvider>
      <Canvas {...props} />
    </ReactFlowProvider>
  );
}

function Canvas({
  document,
  editable = false,
  selected = null,
  flagged = null,
  progress = null,
  faultAt = null,
  phase = null,
  onSelect = NOTHING,
  onInsert = NOTHING,
  onConnect,
  onDisconnect,
  reveal = null,
  className,
}: WorkflowCanvasProps) {
  // A live refresh brings an equal document as a new object; the graph is redone only when
  // the document itself changed.
  const text = JSON.stringify(document);
  const stable = useMemo(() => JSON.parse(text) as JsonObject, [text]);
  const scope = scopeOf(stable);
  const direction = useDirection();
  const stored = useCollapsed(scope);
  // A run opens the groups that hold what is running or what faulted.
  const active = activeOf(progress, faultAt).join('\n');
  const collapsed = useMemo(() => openedFor(stored, active), [stored, active]);
  const graph = useMemo(
    () => graphOf(stable, { editable, collapsed }),
    [stable, editable, collapsed],
  );
  const groups = useMemo(() => groupsOf(stable, editable), [stable, editable]);
  const { laid, failed } = useLaidOut(graph, direction, editable);
  const trigger = describeTrigger(triggerOf(stable));
  const { fitView, setViewport } = useReactFlow();
  // The system's scheme once the page is live; the server and the first render draw light.
  const dark = usePrefersDark();
  const frame = useRef<HTMLDivElement>(null);
  const shownFor = useRef<Direction | null>(null);
  // The connections picked for the Delete key. The edges come from the document, so the canvas
  // keeps what React Flow reports picked and gives it back (a controlled flow).
  const [picked, setPicked] = useState<ReadonlySet<string>>(new Set());

  // The first view, and again when the direction changes: the whole graph when it fits at a
  // readable zoom, otherwise a readable zoom from the start. Edits keep the view where it is.
  useEffect(() => {
    const element = frame.current;

    if (laid === null || element === null) return;

    if (shownFor.current === laid.direction) return;

    const show = () => {
      const box = element.getBoundingClientRect();

      if (box.width === 0) return false;

      shownFor.current = laid.direction;
      const start = laid.placement.nodes.get(START);
      const view = viewOf(laid, box, start?.x ?? 0, start?.y ?? 0);
      void setViewport(view);
      return true;
    };

    if (show()) return;

    // A canvas drawn while hidden (a closed sheet, a narrow layout) gets its view with a size.
    const observer = new ResizeObserver(() => {
      if (show()) observer.disconnect();
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [laid, setViewport]);

  // The asked-for node, once its graph is laid out; each request once, so later layouts (an
  // edit, a block opened) keep the view where the person left it.
  const revealed = useRef<Reveal | null>(null);
  useEffect(() => {
    if (reveal === null || reveal === revealed.current || laid === null) return;

    if (!laid.placement.nodes.has(reveal.id)) return;

    revealed.current = reveal;
    const target = [{ id: reveal.id }];
    void fitView({
      nodes: target,
      duration: REVEAL_MS,
      maxZoom: MAX_ZOOM,
      padding: REVEAL_PADDING,
    });
  }, [reveal, laid, fitView]);

  const nodes = useMemo<Node<CanvasNodeData>[]>(
    () =>
      laid === null
        ? []
        : laid.graph.nodes.flatMap((node) => {
            const placed = laid.placement.nodes.get(node.id);

            if (placed === undefined) return [];

            return [
              {
                id: node.id,
                type: node.kind === 'group' ? 'block' : node.kind,
                position: { x: placed.x, y: placed.y },
                width: placed.width,
                height: placed.height,
                parentId: node.parentId ?? undefined,
                draggable: false,
                deletable: false,
                selectable: false,
                connectable: editable,
                data: { node, ports: placed.ports },
              },
            ];
          }),
    [laid, editable],
  );

  const edges = useMemo<Edge<FlowEdgeData>[]>(
    () =>
      laid === null
        ? []
        : laid.graph.edges.map((edge) => {
            const placed = laid.placement.edges.get(edge.id);
            const taken = progress !== null && tookTo(edge, progress, phase);
            const live =
              taken && progress?.get(edge.target)?.status === 'running';
            const removable =
              editable &&
              (edge.kind === 'jump' ||
                edge.kind === 'case' ||
                edge.kind === 'end' ||
                edge.kind === 'exit');
            return {
              id: edge.id,
              source: edge.source,
              target: edge.target,
              sourceHandle: edge.port,
              targetHandle: IN,
              type: 'flow',
              deletable: removable,
              selectable: removable,
              selected: removable && picked.has(edge.id),
              markerEnd: {
                type: MarkerType.ArrowClosed,
                width: 16,
                height: 16,
                color: taken ? 'var(--edge-taken)' : strokeOf(edge.kind),
              },
              data: {
                edge,
                points: placed?.points ?? [],
                labels: placed?.labels ?? [],
                taken,
                live,
              },
            };
          }),
    [laid, progress, phase, editable, picked],
  );

  const state = useMemo<CanvasState>(
    () => ({
      editable,
      direction,
      selected,
      flagged,
      progress,
      faultAt,
      phase,
      trigger,
      onSelect,
      onInsert,
      onToggle: (id: string) => toggleCollapsed(scope, id),
    }),
    [
      editable,
      direction,
      selected,
      flagged,
      progress,
      faultAt,
      phase,
      trigger,
      onSelect,
      onInsert,
      scope,
    ],
  );

  function connect(connection: Connection) {
    if (onConnect === undefined) return;

    const port = connection.sourceHandle ?? null;
    const caseIndex = caseIndexOf(port);
    onConnect(connection.source, caseIndex, connection.target);
  }

  // A connection the DSL can say: from a step or a case to another step of the same list.
  function connectable(connection: Connection | Edge): boolean {
    const from = placeOf(connection.source);
    const to = placeOf(connection.target);

    if (from === null || to === null || connection.source === connection.target)
      return false;

    // Fork branches run side by side; a `then` between them would mean nothing.
    return (
      from.listPointer === to.listPointer && !isBranchList(from.listPointer)
    );
  }

  return (
    <CanvasProvider value={state}>
      <div ref={frame} className={cn('relative size-full', className)}>
        {laid === null && (
          <p
            className="absolute inset-0 z-10 flex items-center justify-center gap-2 text-sm text-muted-foreground"
            role="status"
          >
            {failed ? (
              'The canvas could not be drawn. The Code view shows the whole document.'
            ) : (
              <>
                <Spinner /> Drawing the workflow…
              </>
            )}
          </p>
        )}
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={NODE_TYPES}
          edgeTypes={EDGE_TYPES}
          colorMode={dark ? 'dark' : 'light'}
          minZoom={0.2}
          maxZoom={1.6}
          nodesDraggable={false}
          nodesConnectable={editable}
          nodesFocusable={false}
          elementsSelectable={editable}
          onConnect={connect}
          isValidConnection={connectable}
          onEdgesChange={(changes) => {
            setPicked((before) => pickedAfter(before, changes));
          }}
          onEdgesDelete={(deleted) => {
            if (onDisconnect === undefined) return;

            for (const each of deleted) {
              const data = each.data as FlowEdgeData | undefined;

              if (data !== undefined)
                onDisconnect(data.edge.source, data.edge.caseIndex);
            }
          }}
          deleteKeyCode={editable ? ['Backspace', 'Delete'] : null}
          onNodeClick={(_, node) => {
            if (node.type === 'add' || node.type === 'end') return;

            // A handler belongs to its `try`, which the panel shows.
            const data = node.data as CanvasNodeData;
            onSelect(data.node.entry?.pointer ?? node.id);
          }}
          onPaneClick={() => onSelect(null)}
          panOnScroll
          zoomOnDoubleClick={false}
          proOptions={{ hideAttribution: false }}
          className="bg-[radial-gradient(circle_at_top,var(--color-muted)_0%,transparent_60%)]"
        >
          <Background
            variant={BackgroundVariant.Dots}
            gap={20}
            size={1.4}
            color="var(--canvas-dots)"
          />
          <Panel position="top-left">
            <CanvasToolbar
              direction={direction}
              onDirection={chooseDirection}
              grouped={groups.length > 0}
              onCollapseAll={() => setCollapsed(scope, groups)}
              onExpandAll={() => setCollapsed(scope, [])}
            />
          </Panel>
          <Controls
            showInteractive={false}
            position="bottom-left"
            className="!overflow-hidden !rounded-xl !border !shadow-sm"
          />
          <MiniMap
            pannable
            zoomable
            position="bottom-right"
            className="!hidden !overflow-hidden !rounded-xl !border !shadow-sm md:!block"
            nodeColor={(node) =>
              node.type === 'block' || node.type === 'handler'
                ? 'var(--color-muted)'
                : node.id === START || node.id === END
                  ? 'var(--color-primary)'
                  : 'var(--color-border)'
            }
          />
        </ReactFlow>
      </div>
    </CanvasProvider>
  );
}

// The graph as ELK lays it out. Until the next layout is ready the previous one stays, so an
// edit never blanks the canvas.
function useLaidOut(
  graph: Graph,
  direction: Direction,
  editable: boolean,
): { readonly laid: LaidOut | null; readonly failed: boolean } {
  const [laid, setLaid] = useState<LaidOut | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let current = true;

    elkEngine()
      .then((elk) => placementOf(graph, direction, editable, elk))
      .then((placement) => {
        if (current) setLaid({ graph, direction, placement });
      })
      .catch(() => {
        if (current) setFailed(true);
      });

    return () => {
      current = false;
    };
  }, [graph, direction, editable]);

  return { laid, failed };
}

function viewOf(
  laid: LaidOut,
  box: DOMRect,
  startX: number,
  startY: number,
): { readonly x: number; readonly y: number; readonly zoom: number } {
  const { width, height } = laid.placement;
  const fits = Math.min(
    (box.width - PAD * 2) / width,
    (box.height - PAD * 2) / height,
  );

  if (fits >= READABLE_ZOOM) {
    const zoom = Math.min(MAX_ZOOM, fits);
    return {
      x: (box.width - width * zoom) / 2,
      y: (box.height - height * zoom) / 2,
      zoom,
    };
  }

  const zoom = READABLE_ZOOM;

  if (laid.direction === 'down')
    return {
      x: box.width / 2 - (startX + 136) * zoom,
      y: PAD - startY * zoom,
      zoom,
    };

  return {
    x: PAD - startX * zoom,
    y: box.height / 2 - (startY + 36) * zoom,
    zoom,
  };
}

// Whether a run went along an edge: both its ends ran, or it ends a run that completed.
function tookTo(
  edge: CanvasEdge,
  progress: ReadonlyMap<string, TaskProgress>,
  phase: Phase | null,
): boolean {
  const from = edge.source === START || ran(progress, edge.source);

  if (edge.target === END) return phase === 'completed' && from;

  return from && ran(progress, edge.target);
}

// A step ran, or a step inside a block or a handler did.
function ran(progress: ReadonlyMap<string, TaskProgress>, id: string): boolean {
  if (progress.has(id)) return true;

  const inside = `${id}/`;
  return [...progress.keys()].some((pointer) => pointer.startsWith(inside));
}

// What a run is at: the steps running, and where it faulted.
function activeOf(
  progress: ReadonlyMap<string, TaskProgress> | null,
  faultAt: string | null,
): string[] {
  const running = [...(progress?.entries() ?? [])]
    .filter(([, seen]) => seen.status === 'running')
    .map(([pointer]) => pointer);
  return faultAt === null ? running : [...running, faultAt];
}

// The picked connections after React Flow's changes: a connection is picked, let go, or
// removed.
function pickedAfter(
  before: ReadonlySet<string>,
  changes: readonly EdgeChange<Edge<FlowEdgeData>>[],
): ReadonlySet<string> {
  const after = new Set(before);

  for (const change of changes) {
    if (change.type === 'remove') after.delete(change.id);

    if (change.type !== 'select') continue;

    if (change.selected) after.add(change.id);
    else after.delete(change.id);
  }

  return after;
}

// The viewer's closed groups, less those that hold what a run is at.
function openedFor(
  stored: ReadonlySet<string>,
  active: string,
): ReadonlySet<string> {
  if (active === '') return stored;

  const pointers = active.split('\n');
  const opened = [...stored].filter(
    (id) => !pointers.some((pointer) => pointer.startsWith(`${id}/`)),
  );
  return opened.length === stored.size ? stored : new Set(opened);
}

// Every group the canvas can open or close.
function groupsOf(document: JsonObject, editable: boolean): string[] {
  const whole = graphOf(document, { editable, collapsed: new Set() });
  return whole.nodes
    .filter((node) => node.kind === 'group' || node.kind === 'handler')
    .map((node) => node.id);
}

// The workflow the arrangement is kept for.
function scopeOf(document: JsonObject): string {
  const header = isObject(document.document) ? document.document : {};
  const namespace =
    typeof header.namespace === 'string' ? header.namespace : '';
  const name = typeof header.name === 'string' ? header.name : '';
  return `${namespace}/${name}`;
}
