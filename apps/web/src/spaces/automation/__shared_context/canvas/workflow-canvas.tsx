'use client';

import {
  Background,
  BackgroundVariant,
  type Connection,
  Controls,
  type Edge,
  MarkerType,
  MiniMap,
  type Node,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
} from '@xyflow/react';
import { cn } from 'cn';
import { useMemo, useRef } from 'react';
import type { JsonObject, Phase } from '@/libs/data-access/types';
import { describeTrigger, triggerOf } from '../document/trigger';
import type { TaskProgress } from '../outline/progress';
import { CanvasProvider, type CanvasState } from './canvas-context';
import { FlowEdge, type FlowEdgeData } from './flow-edge';
import {
  type CanvasEdge,
  END,
  graphOf,
  isBranchList,
  placeOf,
  START,
} from './graph';
import {
  AddNode,
  type CanvasNodeData,
  ContainerNode,
  EndNode,
  StartNode,
  TaskNode,
} from './nodes';

const NODE_TYPES = {
  start: StartNode,
  end: EndNode,
  task: TaskNode,
  container: ContainerNode,
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
  // A dragged connection from a step or a case to another step of the same list.
  readonly onConnect?: (
    source: string,
    sourceHandle: string | null,
    target: string,
  ) => void;
  // A jump or a case removed with the Delete key.
  readonly onDisconnect?: (edge: CanvasEdge) => void;
  readonly className?: string;
}

const NOTHING = () => undefined;

const PAD = 48;
const READABLE_ZOOM = 0.7;
const MAX_ZOOM = 1;

// The workflow as a graph (FR-022): the builder edits on it, a run's page colours it.
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
  className,
}: WorkflowCanvasProps) {
  // A live refresh brings an equal document as a new object; the layout is redone only when
  // the document itself changed.
  const text = JSON.stringify(document);
  const stable = useMemo(() => JSON.parse(text) as JsonObject, [text]);
  const graph = useMemo(() => graphOf(stable, editable), [stable, editable]);
  const trigger = describeTrigger(triggerOf(stable));
  const { setViewport } = useReactFlow();
  const frame = useRef<HTMLDivElement>(null);

  // The first view: the whole graph when it fits at a readable zoom, otherwise a readable zoom
  // from the start node on the left, the rest a pan away. Edits keep the view where it is.
  function show() {
    const box = frame.current?.getBoundingClientRect();

    if (box === undefined || box.width === 0) {
      waitForSize();
      return;
    }

    const top = graph.nodes.filter((node) => node.parentId === null);
    const left = Math.min(...top.map((node) => node.x));
    const right = Math.max(...top.map((node) => node.x + node.width));
    const upper = Math.min(...top.map((node) => node.y));
    const lower = Math.max(...top.map((node) => node.y + node.height));
    const width = right - left;
    const height = lower - upper;
    const fits = Math.min(
      (box.width - PAD * 2) / width,
      (box.height - PAD * 2) / height,
    );
    const zoom = Math.min(MAX_ZOOM, Math.max(READABLE_ZOOM, fits));
    const x =
      width * zoom + PAD * 2 <= box.width
        ? (box.width - width * zoom) / 2 - left * zoom
        : PAD - left * zoom;
    const y = (box.height - height * zoom) / 2 - upper * zoom;
    void setViewport({ x, y, zoom });
  }

  // A canvas mounted while hidden (a closed sheet, a narrow layout) gets its first view when
  // it gets a size.
  function waitForSize() {
    const element = frame.current;

    if (element === null) return;

    const observer = new ResizeObserver(() => {
      if (element.getBoundingClientRect().width === 0) return;

      observer.disconnect();
      show();
    });
    observer.observe(element);
  }

  const nodes = useMemo<Node<CanvasNodeData>[]>(
    () =>
      graph.nodes.map((node) => ({
        id: node.id,
        type: node.kind,
        position: { x: node.x, y: node.y },
        width: node.width,
        height: node.height,
        parentId: node.parentId ?? undefined,
        extent: node.parentId === null ? undefined : 'parent',
        draggable: false,
        deletable: false,
        selectable: false,
        connectable: editable,
        data: { node },
      })),
    [graph, editable],
  );

  const edges = useMemo<Edge<FlowEdgeData>[]>(
    () =>
      graph.edges.map((edge) => {
        const taken = progress !== null && tookTo(edge, progress, phase);
        const live = taken && progress?.get(edge.target)?.status === 'running';
        return {
          id: edge.id,
          source: edge.source,
          target: edge.target,
          sourceHandle: edge.sourceHandle,
          targetHandle: 'in',
          type: 'flow',
          deletable:
            editable &&
            (edge.kind === 'jump' ||
              edge.kind === 'case' ||
              edge.kind === 'end'),
          selectable:
            editable &&
            (edge.kind === 'jump' ||
              edge.kind === 'case' ||
              edge.kind === 'end'),
          markerEnd: {
            type: MarkerType.ArrowClosed,
            width: 16,
            height: 16,
            color: taken ? 'var(--edge-taken)' : 'var(--edge-neutral)',
          },
          data: { edge, taken, live },
        };
      }),
    [graph, progress, phase, editable],
  );

  const state = useMemo<CanvasState>(
    () => ({
      editable,
      selected,
      flagged,
      progress,
      faultAt,
      phase,
      trigger,
      onSelect,
      onInsert,
    }),
    [
      editable,
      selected,
      flagged,
      progress,
      faultAt,
      phase,
      trigger,
      onSelect,
      onInsert,
    ],
  );

  function connect(connection: Connection) {
    if (onConnect === undefined) return;

    onConnect(
      connection.source,
      connection.sourceHandle ?? null,
      connection.target,
    );
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
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={NODE_TYPES}
          edgeTypes={EDGE_TYPES}
          colorMode="system"
          onInit={show}
          minZoom={0.2}
          maxZoom={1.6}
          nodesDraggable={false}
          nodesConnectable={editable}
          nodesFocusable={false}
          elementsSelectable={editable}
          onConnect={connect}
          isValidConnection={connectable}
          onEdgesDelete={(deleted) => {
            if (onDisconnect === undefined) return;

            for (const each of deleted) {
              const data = each.data as FlowEdgeData | undefined;

              if (data !== undefined) onDisconnect(data.edge);
            }
          }}
          deleteKeyCode={editable ? ['Backspace', 'Delete'] : null}
          onNodeClick={(_, node) =>
            node.type !== 'add' && node.type !== 'end' && onSelect(node.id)
          }
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
              node.type === 'container'
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

// Whether a run went along an edge: its target ran, or it ends a run that completed.
function tookTo(
  edge: CanvasEdge,
  progress: ReadonlyMap<string, TaskProgress>,
  phase: Phase | null,
): boolean {
  if (edge.target === END)
    return (
      phase === 'completed' &&
      (edge.source === START || progress.has(edge.source))
    );

  const target = progress.get(edge.target);

  if (target === undefined) return false;

  return edge.source === START || progress.has(edge.source);
}
