import type { FlowDirective } from "../../standard/index.js";

interface KeywordDirective {
  readonly kind: FlowDirective;
  readonly pointer: string;
}

export interface LabelDirective {
  readonly kind: "label";
  readonly pointer: string;
  readonly name: string;
}

export type Directive = KeywordDirective | LabelDirective;
