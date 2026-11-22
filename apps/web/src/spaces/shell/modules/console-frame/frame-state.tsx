"use client";

import { useSelectedLayoutSegments } from "next/navigation";
import { useState } from "react";
import { SidebarProvider } from "@/libs/ui/components/sidebar";

export function useOnCanvas(): boolean {
  const segments = useSelectedLayoutSegments();
  return segments.includes("(canvas)");
}

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
