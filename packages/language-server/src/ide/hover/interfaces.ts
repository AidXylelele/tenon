import type { Range } from "interpreter/front-end";
import type { Place } from "../places/index.js";

export interface HoverInfo {
  readonly range: Range;
  readonly markdown: string;
}

export type MemberPlace = Extract<Place, { kind: "member" }>;

export type ReferencePlace = Extract<Place, { kind: "reference" }>;

export type ComponentPlace = Extract<Place, { kind: "component" }>;
