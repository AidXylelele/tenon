"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { cn } from "@/libs/ui/tokens/cn";
import { useFlow } from "./context";
import { isReached } from "./flow";
import { jumpLineOf } from "./geometry";
import type { Box, FlowMode, Jump, JumpLine } from "./interfaces";

const NO_LINES: readonly JumpLine[] = [];

export function JumpLines({ jumps }: { readonly jumps: readonly Jump[] }) {
  const { mode } = useFlow();
  const drawing = useRef<SVGSVGElement>(null);
  const [lines, setLines] = useState(NO_LINES);

  useLayoutEffect(() => {
    const area = drawing.current?.parentElement;

    if (area === null || area === undefined) return;

    const measure = () => {
      const measured = linesOf(area, jumps);
      const shown = JSON.stringify(measured);
      setLines((drawn) => (JSON.stringify(drawn) === shown ? drawn : measured));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(area);
    return () => {
      observer.disconnect();
    };
  }, [jumps]);

  return (
    <svg
      ref={drawing}
      className="pointer-events-none absolute inset-0 size-full overflow-visible"
      aria-hidden
    >
      {lines.map((line) => {
        const jump = jumps.find((each) => each.key === line.key);
        const taken = jump !== undefined && isTaken(mode, jump);
        const stroke = cn(
          "fill-none",
          taken
            ? "stroke-accent-solid stroke-2"
            : "stroke-(--flow-edge) stroke-[1.5] [stroke-dasharray:5_4]",
        );

        return (
          <g key={line.key} data-jump-line={line.key}>
            <path d={line.path} className={stroke} />
            <path
              d={line.arrow}
              className={cn(stroke, "[stroke-dasharray:none]")}
            />
          </g>
        );
      })}
    </svg>
  );
}

function isTaken(mode: FlowMode, jump: Jump): boolean {
  if (mode.kind !== "run") return false;

  if (jump.case !== null)
    return mode.steps.get(jump.from)?.branch === jump.case;

  return isReached(mode, jump.from) && isReached(mode, jump.to);
}

function linesOf(
  root: HTMLElement,
  jumps: readonly Jump[],
): readonly JumpLine[] {
  const origin = root.getBoundingClientRect();
  const zoom = root.offsetWidth === 0 ? 1 : origin.width / root.offsetWidth;
  const steps = boxesOf(root, "[data-step-box]", "stepBox", origin, zoom);
  const sources = boxesOf(
    root,
    "[data-jump-source]",
    "jumpSource",
    origin,
    zoom,
  );

  return jumps.flatMap((jump) => {
    const card = steps.get(jump.from);
    const row = sources.get(jump.key);
    const target = steps.get(jump.to);

    if (card === undefined || row === undefined || target === undefined)
      return [];

    const source = {
      left: card.left,
      right: card.right,
      top: row.top,
      bottom: row.bottom,
    };
    const between = jump.between.flatMap((id) => {
      const box = steps.get(id);
      return box === undefined ? [] : [box];
    });

    return [jumpLineOf({ jump, source, target, between })];
  });
}

function boxesOf(
  root: HTMLElement,
  selector: string,
  key: "stepBox" | "jumpSource",
  origin: DOMRect,
  zoom: number,
): ReadonlyMap<string, Box> {
  const elements = [...root.querySelectorAll<HTMLElement>(selector)];
  const entries = elements.map((element) => {
    const rect = element.getBoundingClientRect();
    const box = {
      left: (rect.left - origin.left) / zoom,
      right: (rect.right - origin.left) / zoom,
      top: (rect.top - origin.top) / zoom,
      bottom: (rect.bottom - origin.top) / zoom,
    };
    return [element.dataset[key] ?? "", box] as const;
  });

  return new Map(entries);
}
