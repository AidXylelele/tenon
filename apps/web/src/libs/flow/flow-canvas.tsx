"use client";

import { MaximizeIcon, ZoomInIcon, ZoomOutIcon } from "lucide-react";
import { useId, useLayoutEffect, useRef, useState } from "react";
import { IconButton } from "@/libs/ui/composites/icon-button";
import { cn } from "@/libs/ui/tokens/cn";
import type {
  FlowCanvasProps,
  ScrollAnchor,
  Size,
  ZoomCorner,
} from "./interfaces";
import {
  centredScrollOf,
  fitOf,
  fitWidthOf,
  isLargestZoom,
  isSmallestZoom,
  zoomInOf,
  zoomLevelOf,
  zoomOutOf,
} from "./zoom";

const ZOOM_CORNERS: Readonly<Record<ZoomCorner, string>> = {
  "bottom-left": "bottom-3 left-3",
  "top-right": "top-3 right-3",
};

export function FlowCanvas({
  label,
  description,
  focusable,
  zoomAt = "bottom-left",
  children,
}: FlowCanvasProps) {
  const canvas = useRef<HTMLElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const opened = useRef(false);
  const anchor = useRef<ScrollAnchor | null>(null);
  const describedId = useId();
  const [zoom, setZoom] = useState(1);
  const [size, setSize] = useState<Size | null>(null);
  const tabIndex = focusable ? 0 : undefined;
  const described = description === undefined ? undefined : describedId;
  const sizer =
    size === null
      ? undefined
      : { width: size.width * zoom, height: size.height * zoom };
  const scale =
    size === null ? undefined : { transform: `scale(${String(zoom)})` };
  const largest = isLargestZoom(zoom);
  const smallest = isSmallestZoom(zoom);
  const level = zoomLevelOf(zoom);

  useLayoutEffect(() => {
    const view = canvas.current;
    const drawn = content.current;

    if (view === null || drawn === null) return;

    const measure = () => {
      const natural = { width: drawn.offsetWidth, height: drawn.offsetHeight };

      if (natural.width === 0) return;

      setSize((shown) => (isSameSize(shown, natural) ? shown : natural));

      if (opened.current) return;

      opened.current = true;
      anchor.current = { kind: "open" };
      const visible = { width: view.clientWidth, height: view.clientHeight };
      const fitted = fitWidthOf(natural, visible);
      setZoom(fitted);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(drawn);
    return () => {
      observer.disconnect();
    };
  }, []);

  useLayoutEffect(() => {
    const view = canvas.current;
    const pending = anchor.current;

    if (view === null || pending === null || size === null) return;

    anchor.current = null;

    if (pending.kind === "open") {
      const drawn = size.width * zoom;
      view.scrollLeft = (drawn - view.clientWidth) / 2;
      return;
    }

    view.scrollLeft = centredScrollOf(
      pending.left,
      view.clientWidth,
      pending.from,
      zoom,
    );
    view.scrollTop = centredScrollOf(
      pending.top,
      view.clientHeight,
      pending.from,
      zoom,
    );
  }, [size, zoom]);

  function zoomTo(next: number) {
    const view = canvas.current;

    if (view === null || next === zoom) return;

    anchor.current = {
      kind: "zoom",
      left: view.scrollLeft,
      top: view.scrollTop,
      from: zoom,
    };
    setZoom(next);
  }

  function zoomIn() {
    const next = zoomInOf(zoom);
    zoomTo(next);
  }

  function zoomOut() {
    const next = zoomOutOf(zoom);
    zoomTo(next);
  }

  function fit() {
    const view = canvas.current;

    if (view === null || size === null) return;

    const visible = { width: view.clientWidth, height: view.clientHeight };
    const fitted = fitOf(size, visible);
    zoomTo(fitted);
  }

  return (
    <div className="relative size-full min-h-0">
      <section
        ref={canvas}
        aria-label={label}
        aria-describedby={described}
        tabIndex={tabIndex}
        className="size-full overflow-auto bg-canvas bg-[radial-gradient(var(--border)_1px,transparent_1px)] bg-size-[16px_16px] focus-visible:[--focus-offset:-2px]"
      >
        {description !== undefined && (
          <p id={describedId} className="sr-only">
            {description}
          </p>
        )}
        <div style={sizer} className="mx-auto">
          <div ref={content} style={scale} className="w-max origin-top-left">
            {children}
          </div>
        </div>
      </section>
      <div
        role="group"
        aria-label="Zoom"
        className={cn(
          "absolute flex gap-0.5 rounded-lg border bg-surface p-0.5 shadow-overlay",
          ZOOM_CORNERS[zoomAt],
        )}
      >
        <IconButton
          label="Zoom in"
          icon={ZoomInIcon}
          aria-disabled={largest}
          onClick={zoomIn}
        />
        <IconButton
          label="Zoom out"
          icon={ZoomOutIcon}
          aria-disabled={smallest}
          onClick={zoomOut}
        />
        <IconButton
          label="Fit the flow to the view"
          icon={MaximizeIcon}
          onClick={fit}
        />
        <output
          aria-live="polite"
          className="grid min-w-12 place-items-center px-1.5 text-caption text-muted-foreground tabular-nums"
        >
          {level}
        </output>
      </div>
    </div>
  );
}

function isSameSize(shown: Size | null, measured: Size): boolean {
  return shown?.width === measured.width && shown.height === measured.height;
}
