import type { FlowDirective } from "../../standard/index.js";

export interface Flow<Kind extends FlowDirective = FlowDirective> {
  readonly kind: Kind;
}

export interface Jump {
  readonly kind: "jump";
  readonly index: number;
  readonly name: string;
}

export type Directive = Flow | Jump;
