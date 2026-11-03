'use client';

import { type LayoutStorage, useDefaultLayout } from 'react-resizable-panels';

// Browser storage that may be blocked: the width then lasts until the page is left.
const STORAGE: LayoutStorage = {
  getItem: (key) => {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem: (key, value) => {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      // Not kept.
    }
  },
};

// The split between the canvas and the step panel, kept per viewer for the open and the closed
// panel apart, as the panel comes and goes.
export function usePanelLayout(panelOpen: boolean) {
  return useDefaultLayout({
    id: 'workflow-editor',
    panelIds: panelOpen ? ['canvas', 'panel'] : ['canvas'],
    storage: STORAGE,
  });
}
