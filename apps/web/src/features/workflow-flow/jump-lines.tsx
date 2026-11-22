"use client";

import { memo, useLayoutEffect, useRef, useState } from "react";
import { cn } from "@/libs/ui/tokens/cn";
import { useRunView } from "./context";
import { isReached } from "./flow";
import { jumpLineOf } from "./geometry";
import type { Box, Jump, JumpLine, RunView } from "./interfaces";

interface Offset {
  readonly left: number;
  readonly top: number;
}

interface JumpPathProps {
  readonly line: JumpLine;
  readonly taken: boolean;
}

const NO_LINES: readonly JumpLine[] = [];

const DASHED = "stroke-(--flow-edge) stroke-[1.5] [stroke-dasharray:5_4]";

const SOLID = "stroke-accent-solid stroke-2";

export const JumpLines = memo(function JumpLines({
  jumps,
}: {
  readonly jumps: readonly Jump[];
}) {
  const run = useRunView();
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
        const taken = jump !== undefined && isTaken(run, jump);

        return <JumpPath key={line.key} line={line} taken={taken} />;
      })}
    </svg>
  );
});

function JumpPath({ line, taken }: JumpPathProps) {
  const stroke = cn("fill-none", taken ? SOLID : DASHED);
  const arrow = cn(stroke, "[stroke-dasharray:none]");

  return (
    <g data-jump-line={line.key}>
      <path d={line.path} className={stroke} />
      <path d={line.arrow} className={arrow} />
    </g>
  );
}

function isTaken(run: RunView | null, jump: Jump): boolean {
  if (run === null) return false;

  if (jump.case !== null) return run.steps.get(jump.from)?.branch === jump.case;

  return isReached(run, jump.from) && isReached(run, jump.to);
}

function linesOf(
  area: HTMLElement,
  jumps: readonly Jump[],
): readonly JumpLine[] {
  const steps = boxesOf(area, "[data-step-box]", "stepBox");
  const sources = boxesOf(area, "[data-jump-source]", "jumpSource");

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
  area: HTMLElement,
  selector: string,
  key: "stepBox" | "jumpSource",
): ReadonlyMap<string, Box> {
  const elements = [...area.querySelectorAll<HTMLElement>(selector)];
  const entries = elements.map((element) => {
    const { left, top } = offsetIn(area, element);
    const right = left + element.offsetWidth;
    const bottom = top + element.offsetHeight;
    return [element.dataset[key] ?? "", { left, top, right, bottom }] as const;
  });

  return new Map(entries);
}

function offsetIn(area: HTMLElement, element: HTMLElement): Offset {
  const parent = element.offsetParent;
  const own = { left: element.offsetLeft, top: element.offsetTop };

  if (parent === area || !(parent instanceof HTMLElement)) return own;

  const above = offsetIn(area, parent);
  const left = own.left + above.left + parent.clientLeft;
  const top = own.top + above.top + parent.clientTop;

  return { left, top };
}
