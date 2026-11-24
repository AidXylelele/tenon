import type { ReactNode } from "react";

export interface Size {
  readonly width: number;
  readonly height: number;
}

export type ZoomCorner = "bottom-left" | "top-right";

export interface FlowCanvasProps {
  readonly label: string;
  readonly description?: string;
  readonly focusable: boolean;
  readonly zoomAt?: ZoomCorner;
  readonly children: ReactNode;
}

export type ScrollAnchor =
  | { readonly kind: "open" }
  | {
      readonly kind: "zoom";
      readonly left: number;
      readonly top: number;
      readonly from: number;
    };
