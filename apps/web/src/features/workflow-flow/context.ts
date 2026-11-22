"use client";

import { createContext, useContext } from "react";
import type { FlowState } from "./interfaces";

export const FlowContext = createContext<FlowState | null>(null);

export function useFlow(): FlowState {
  const state = useContext(FlowContext);

  if (state === null)
    throw new Error("A part of the flow is drawn outside it.");

  return state;
}
