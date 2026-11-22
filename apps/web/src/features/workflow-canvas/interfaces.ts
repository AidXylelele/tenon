import type { NodeProps } from "@xyflow/react";
import type {
  Step,
  Trigger,
  WorkflowStructure,
} from "language-server/protocol";
import type { KeyboardEvent, ReactNode } from "react";
import type {
  CanvasEdge,
  CanvasNode,
  Direction,
  Place,
  PlacedLabel,
  Point,
} from "@/operations/workflow-graph";

export interface CanvasEditing {
  readonly onInsert: (place: Place) => void;
  readonly onRemove: (step: string) => void;
}

type StepStatus = (step: Step) => ReactNode;

export interface WorkflowCanvasProps {
  readonly workflow: WorkflowStructure;
  readonly scope: string;
  readonly editing?: CanvasEditing | null;
  readonly selected?: string | null;
  readonly flagged?: ReadonlySet<string>;
  readonly onSelect?: (step: string | null) => void;
  readonly status?: StepStatus | null;
  readonly startLine?: string | null;
  readonly reveal?: { readonly step: string } | null;
}

export interface CanvasState {
  readonly editing: CanvasEditing | null;
  readonly direction: Direction;
  readonly selected: string | null;
  readonly flagged: ReadonlySet<string>;
  readonly triggers: readonly Trigger[];
  readonly status: StepStatus | null;
  readonly startLine: string | null;
  readonly onSelect: (step: string | null) => void;
  readonly onToggle: (id: string) => void;
}

export type CanvasNodeData = Readonly<{
  node: CanvasNode;
  ports: Readonly<Record<string, Point>>;
}>;

export interface StepNodeState {
  readonly selected: boolean;
  readonly flagged: boolean;
  readonly name: string;
  readonly onKeyDown: (event: KeyboardEvent) => void;
}

export type CanvasNodeProps = NodeProps & { readonly data: CanvasNodeData };

export type FlowEdgeData = Readonly<{
  edge: CanvasEdge;
  points: readonly Point[];
  labels: readonly PlacedLabel[];
}>;
