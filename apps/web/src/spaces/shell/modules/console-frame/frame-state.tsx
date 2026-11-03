'use client';

import { useSelectedLayoutSegments } from 'next/navigation';
import { useState } from 'react';
import { SidebarProvider } from '@/libs/ui/components/sidebar';

// Whether the page in view is a canvas: its route group says so.
export function useOnCanvas(): boolean {
  const segments = useSelectedLayoutSegments();
  return segments.includes('(canvas)');
}

// The sidebar's state, kept apart for canvases: they open with it collapsed to icons, so the
// graph has the width (research R15), and a person who opens it there keeps it open there.
export function FrameState({
  children,
}: {
  readonly children: React.ReactNode;
}) {
  const canvas = useOnCanvas();
  const [columnOpen, setColumnOpen] = useState(true);
  const [canvasOpen, setCanvasOpen] = useState(false);

  return (
    <SidebarProvider
      open={canvas ? canvasOpen : columnOpen}
      onOpenChange={canvas ? setCanvasOpen : setColumnOpen}
    >
      {children}
    </SidebarProvider>
  );
}
