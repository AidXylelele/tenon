"use client";

import {
  Background,
  BackgroundVariant,
  Controls,
  type Edge,
  MarkerType,
  MiniMap,
  type Node,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
} from "@xyflow/react";
import { memo, useEffect, useMemo, useRef, useState } from "react";
import type { WorkflowStructure } from "language-server/protocol";
import { Spinner } from "@/libs/ui/components/spinner";
import { useColorScheme } from "@/libs/ui/hooks/use-color-scheme";
import {
  containersOf,
  type Direction,
  END,
  type Graph,
  graphOf,
  IN,
  type Placement,
  placementOf,
  SIZE,
  START,
} from "@/operations/workflow-graph";
import { AddNode } from "./add-node";
import { CanvasProvider } from "./canvas-context";
import { CanvasToolbar } from "./canvas-toolbar";
import { EndNode } from "./end-node";
import { FlowEdge, strokeOf } from "./flow-edge";
import { GroupNode } from "./group-node";
import { HandlerNode } from "./handler-node";
import type {
  CanvasNodeData,
  CanvasState,
  FlowEdgeData,
  WorkflowCanvasProps,
} from "./interfaces";
import { StartNode } from "./start-node";
import { TaskNode } from "./task-node";
import {
  chooseDirection,
  setCollapsed,
  toggleCollapsed,
  useCollapsed,
  useDirection,
} from "./view-preferences";

const NODE_TYPES = {
  start: StartNode,
  end: EndNode,
  task: TaskNode,
  group: GroupNode,
  handler: HandlerNode,
  add: AddNode,
};

const EDGE_TYPES = { flow: FlowEdge };

const NO_FLAGS: ReadonlySet<string> = new Set();
const IGNORE = () => undefined;
const PAD = 48;
const READABLE_ZOOM = 0.9;
const MAX_ZOOM = 1;

interface LaidOut {
  readonly graph: Graph;
  readonly direction: Direction;
  readonly placement: Placement;
}

export const WorkflowCanvas = memo(function WorkflowCanvas(
  props: WorkflowCanvasProps,
) {
  return (
    <ReactFlowProvider>
      <Canvas {...props} />
    </ReactFlowProvider>
  );
});

function Canvas({
  workflow,
  scope,
  editing = null,
  selected = null,
  flagged = NO_FLAGS,
  onSelect = IGNORE,
  status = null,
  startLine = null,
  reveal = null,
}: WorkflowCanvasProps) {
  const editable = editing !== null;
  const shape = useMemo(() => shapeOf(workflow), [workflow]);
  const stable = useMemo((): WorkflowStructure => JSON.parse(shape), [shape]);
  const direction = useDirection();
  const collapsed = useCollapsed(scope);
  const graph = useMemo(
    () => graphOf(stable, { editable, collapsed }),
    [stable, editable, collapsed],
  );
  const containers = useMemo(() => containersOf(stable), [stable]);
  const { laid, failed } = useLaidOut(graph, direction, editable);
  const { fitView, setViewport } = useReactFlow();
  const scheme = useColorScheme();
  const frame = useRef<HTMLDivElement>(null);
  const shownFor = useRef<Direction | null>(null);

  useEffect(() => {
    const element = frame.current;

    if (laid === null || element === null) return;

    if (shownFor.current === laid.direction) return;

    const show = () => {
      const box = element.getBoundingClientRect();

      if (box.width === 0) return false;

      shownFor.current = laid.direction;
      const view = viewOf(laid, box);
      void setViewport(view);
      return true;
    };

    if (show()) return;

    const observer = new ResizeObserver(() => {
      if (show()) observer.disconnect();
    });
    observer.observe(element);
    return () => {
      observer.disconnect();
    };
  }, [laid, setViewport]);

  useEffect(() => {
    if (reveal === null || laid === null) return;

    const shown = [{ id: reveal.step }];
    void fitView({ nodes: shown, duration: 300, maxZoom: MAX_ZOOM });
  }, [reveal, laid, fitView]);

  const nodes = useMemo(() => (laid === null ? [] : nodesOf(laid)), [laid]);
  const edges = useMemo(() => (laid === null ? [] : edgesOf(laid)), [laid]);

  const state = useMemo<CanvasState>(
    () => ({
      editing,
      direction,
      selected,
      flagged,
      triggers: stable.triggers,
      status,
      startLine,
      onSelect,
      onToggle: (id: string) => {
        toggleCollapsed(scope, id);
      },
    }),
    [
      editing,
      direction,
      selected,
      flagged,
      stable.triggers,
      status,
      startLine,
      onSelect,
      scope,
    ],
  );

  return (
    <CanvasProvider value={state}>
      <div ref={frame} className="relative size-full bg-canvas">
        {laid === null && (
          <p
            className="absolute inset-0 z-10 flex items-center justify-center gap-2 text-sm text-muted-foreground"
            role="status"
          >
            {failed ? (
              "The canvas could not be drawn. The text shows the whole workflow."
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
          colorMode={scheme}
          minZoom={0.2}
          maxZoom={1.6}
          nodesDraggable={false}
          nodesConnectable={false}
          nodesFocusable={false}
          elementsSelectable={false}
          onNodeClick={(_, node) => {
            const step = node.data.node.step;

            if (node.id !== START) {
              if (step !== null) onSelect(step.id);
            } else if (editing !== null) onSelect(START);
          }}
          onPaneClick={() => {
            onSelect(null);
          }}
          panOnScroll
          zoomOnDoubleClick={false}
        >
          <Background
            variant={BackgroundVariant.Dots}
            gap={20}
            size={1.4}
            color="var(--border)"
          />
          <Panel position="top-left">
            <CanvasToolbar
              direction={direction}
              onDirection={chooseDirection}
              grouped={containers.length > 0}
              onCollapseAll={() => {
                setCollapsed(scope, containers);
              }}
              onExpandAll={() => {
                setCollapsed(scope, []);
              }}
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
              node.type === "group" || node.type === "handler"
                ? "var(--color-muted)"
                : node.id === START || node.id === END
                  ? "var(--color-primary)"
                  : "var(--color-border)"
            }
          />
        </ReactFlow>
      </div>
    </CanvasProvider>
  );
}

function useLaidOut(
  graph: Graph,
  direction: Direction,
  editable: boolean,
): { readonly laid: LaidOut | null; readonly failed: boolean } {
  const [laid, setLaid] = useState<LaidOut | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let current = true;

    placementOf(graph, direction, editable).then(
      (placement) => {
        if (current) setLaid({ graph, direction, placement });
      },
      () => {
        if (current) setFailed(true);
      },
    );

    return () => {
      current = false;
    };
  }, [graph, direction, editable]);

  return { laid, failed };
}

function nodesOf(laid: LaidOut): Node<CanvasNodeData>[] {
  return laid.graph.nodes.flatMap((node) => {
    const placed = laid.placement.nodes.get(node.id);

    if (placed === undefined) return [];

    return [
      {
        id: node.id,
        type: node.kind,
        position: { x: placed.x, y: placed.y },
        width: placed.width,
        height: placed.height,
        parentId: node.parentId ?? undefined,
        draggable: false,
        deletable: false,
        selectable: false,
        connectable: false,
        data: { node, ports: placed.ports },
      },
    ];
  });
}

function edgesOf(laid: LaidOut): Edge<FlowEdgeData>[] {
  return laid.graph.edges.map((edge) => {
    const placed = laid.placement.edges.get(edge.id);
    const color = strokeOf(edge.kind);

    return {
      id: edge.id,
      source: edge.source,
      target: edge.target,
      sourceHandle: edge.port,
      targetHandle: IN,
      type: "flow",
      deletable: false,
      selectable: false,
      markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16, color },
      data: {
        edge,
        points: placed?.points ?? [],
        labels: placed?.labels ?? [],
      },
    };
  });
}

function shapeOf(workflow: WorkflowStructure): string {
  return JSON.stringify(workflow, (key, value: unknown) =>
    key === "range" || key === "selectionRange" ? undefined : value,
  );
}

function viewOf(
  laid: LaidOut,
  box: DOMRect,
): { readonly x: number; readonly y: number; readonly zoom: number } {
  const { width, height } = laid.placement;
  const start = laid.placement.nodes.get(START);
  const startX = start?.x ?? 0;
  const startY = start?.y ?? 0;
  const middleX = startX + SIZE.start.width / 2;
  const middleY = startY + SIZE.start.height / 2;
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

  if (laid.direction === "down")
    return {
      x: box.width / 2 - middleX * zoom,
      y: PAD - startY * zoom,
      zoom,
    };

  return {
    x: PAD - startX * zoom,
    y: box.height / 2 - middleY * zoom,
    zoom,
  };
}
