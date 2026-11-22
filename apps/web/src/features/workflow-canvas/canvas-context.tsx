"use client";

import { createContext, use } from "react";
import type { CanvasState } from "./interfaces";

const CanvasContext = createContext<CanvasState | null>(null);

export const CanvasProvider = CanvasContext.Provider;

export function useCanvas(): CanvasState {
  const state = use(CanvasContext);

  if (state === null)
    throw new Error("A canvas node is drawn outside its canvas");

  return state;
}
