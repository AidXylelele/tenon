import type { Step } from "language-server/protocol";

export type NodeKind = "start" | "end" | "task" | "group" | "handler" | "add";

export interface Place {
  readonly list: string;
  readonly index: number;
}

export interface GraphCase {
  readonly when: string | null;
  readonly index: number;
}

export interface CanvasNode {
  readonly id: string;
  readonly kind: NodeKind;
  readonly parentId: string | null;
  readonly step: Step | null;
  readonly cases: readonly GraphCase[];
  readonly addTo: Place | null;
  readonly failing: boolean;
  readonly collapsed: boolean;
  readonly inside: number;
  readonly width: number;
  readonly height: number;
}

export type EdgeKind =
  "next" | "case" | "jump" | "end" | "exit" | "error" | "append";

export interface CanvasEdge {
  readonly id: string;
  readonly source: string;
  readonly target: string;
  readonly port: string;
  readonly kind: EdgeKind;
  readonly label: string | null;
  readonly insertAt: Place | null;
}

export interface Graph {
  readonly nodes: readonly CanvasNode[];
  readonly edges: readonly CanvasEdge[];
}

export interface GraphOptions {
  readonly editable: boolean;
  readonly collapsed: ReadonlySet<string>;
}

export type Direction = "down" | "right";

export interface Point {
  readonly x: number;
  readonly y: number;
}

interface Box extends Point {
  readonly width: number;
  readonly height: number;
}

export interface PlacedNode extends Box {
  readonly ports: Readonly<Record<string, Point>>;
}

export interface PlacedLabel extends Box {
  readonly role: "label" | "add";
}

export interface PlacedEdge {
  readonly points: readonly Point[];
  readonly labels: readonly PlacedLabel[];
}

export interface Placement {
  readonly nodes: ReadonlyMap<string, PlacedNode>;
  readonly edges: ReadonlyMap<string, PlacedEdge>;
  readonly width: number;
  readonly height: number;
}

export interface StepPlace {
  readonly list: string;
  readonly index: number;
  readonly size: number;
}
