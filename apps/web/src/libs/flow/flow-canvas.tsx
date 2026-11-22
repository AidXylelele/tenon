"use client";

import { MaximizeIcon, ZoomInIcon, ZoomOutIcon } from "lucide-react";
import { useId, useLayoutEffect, useRef, useState } from "react";
import { IconButton } from "@/libs/ui/composites/icon-button";
import type { FlowCanvasProps, Size } from "./interfaces";
import {
  fitOf,
  fitWidthOf,
  isLargestZoom,
  isSmallestZoom,
  zoomInOf,
  zoomOutOf,
} from "./zoom";

export function FlowCanvas({
  label,
  description,
  focusable,
  children,
}: FlowCanvasProps) {
  const canvas = useRef<HTMLElement>(null);
  const content = useRef<HTMLDivElement>(null);
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

  useLayoutEffect(() => {
    const view = canvas.current;
    const drawn = content.current;

    if (view === null || drawn === null) return;

    let opened = false;
    const measure = () => {
      const natural = { width: drawn.offsetWidth, height: drawn.offsetHeight };

      if (natural.width === 0) return;

      setSize((shown) => (isSameSize(shown, natural) ? shown : natural));

      if (opened) return;

      opened = true;
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

  function zoomIn() {
    if (!largest) setZoom(zoomInOf);
  }

  function zoomOut() {
    if (!smallest) setZoom(zoomOutOf);
  }

  function fit() {
    const view = canvas.current;

    if (view === null || size === null) return;

    const visible = { width: view.clientWidth, height: view.clientHeight };
    const fitted = fitOf(size, visible);
    setZoom(fitted);
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
        className="absolute bottom-3 left-3 flex gap-0.5 rounded-lg border bg-surface p-0.5 shadow-overlay"
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
      </div>
    </div>
  );
}

function isSameSize(shown: Size | null, measured: Size): boolean {
  return shown?.width === measured.width && shown.height === measured.height;
}
