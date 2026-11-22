"use client";

import { createContext, useContext, useSyncExternalStore } from "react";
import type { RovingItemProps } from "@/libs/ui/hooks/use-roving-focus";
import type {
  FlowState,
  FlowView,
  RunView,
  StepMark,
  StepRun,
} from "./interfaces";

export const FlowContext = createContext<FlowState | null>(null);

export function useFlow(): FlowState {
  const state = useContext(FlowContext);

  if (state === null)
    throw new Error("A part of the flow is drawn outside it.");

  return state;
}

export function useFlowView<Seen>(select: (view: FlowView) => Seen): Seen {
  const { store } = useFlow();
  const seen = () => select(store.view());

  return useSyncExternalStore(store.subscribe, seen, seen);
}

export function useRovingItem(item: string): RovingItemProps {
  const tabIndex = useFlowView((view) => view.itemProps(item).tabIndex);

  return { "data-roving-item": item, tabIndex };
}

export function useSelected(target: string): boolean {
  return useFlowView((view) => view.selected === target);
}

export function useMark(step: string): StepMark | undefined {
  return useFlowView((view) => view.marks.get(step));
}

export function useRun(step: string): StepRun | undefined {
  return useFlowView((view) => view.run?.steps.get(step));
}

export function useRunView(): RunView | null {
  return useFlowView((view) => view.run);
}
