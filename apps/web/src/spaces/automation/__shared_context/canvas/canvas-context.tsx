'use client';

import { createContext, useContext } from 'react';
import type { Phase } from '@/libs/data-access/types';
import type { TaskProgress } from '@/operations/run-progress';
import type { Direction } from './layout';

// What every node and edge of a canvas reads: whether it is edited, which way it runs, what is
// picked, where the check's problem is, and a run's progress. Kept apart from the graph, so
// picking a node does not lay the graph out again.
export interface CanvasState {
  readonly editable: boolean;
  readonly direction: Direction;
  readonly selected: string | null;
  readonly flagged: string | null;
  readonly progress: ReadonlyMap<string, TaskProgress> | null;
  readonly faultAt: string | null;
  readonly phase: Phase | null;
  readonly trigger: string;
  readonly onSelect: (id: string | null) => void;
  readonly onInsert: (listPointer: string, index: number) => void;
  // Opens or closes a group.
  readonly onToggle: (id: string) => void;
}

const CanvasContext = createContext<CanvasState | null>(null);

export const CanvasProvider = CanvasContext.Provider;

export function useCanvas(): CanvasState {
  const state = useContext(CanvasContext);

  if (state === null)
    throw new Error('A canvas node is drawn outside its canvas');

  return state;
}
