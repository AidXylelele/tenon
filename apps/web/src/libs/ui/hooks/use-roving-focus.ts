import {
  type FocusEvent,
  type KeyboardEvent,
  type RefObject,
  useLayoutEffect,
  useState,
} from "react";

type Move = (index: number, last: number) => number;

export interface RovingItemProps {
  readonly "data-roving-item": string;
  readonly tabIndex: 0 | -1;
}

export interface RovingFocus {
  readonly itemProps: (item: string) => RovingItemProps;
  readonly onFocus: (event: FocusEvent<HTMLElement>) => void;
  readonly onKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
  readonly focus: (items: readonly string[]) => void;
}

const ITEMS = "[data-roving-item]";

const MOVES: ReadonlyMap<string, Move> = new Map<string, Move>([
  ["ArrowDown", (index, last) => Math.min(index + 1, last)],
  ["ArrowRight", (index, last) => Math.min(index + 1, last)],
  ["ArrowUp", (index) => Math.max(index - 1, 0)],
  ["ArrowLeft", (index) => Math.max(index - 1, 0)],
  ["Home", () => 0],
  ["End", (_, last) => last],
]);

export function useRovingFocus(
  containerRef: RefObject<HTMLElement | null>,
  preferred: string | null,
  layout: unknown,
): RovingFocus {
  const [current, setCurrent] = useState<string | null>(null);
  const stop = current ?? preferred;

  useLayoutEffect(() => {
    const element = containerRef.current;

    if (element === null) return;

    const items = itemsIn(element);
    const reachable = items.some((item) => item.tabIndex === 0);
    const first = items[0]?.dataset.rovingItem;

    if (!reachable && first !== undefined) setCurrent(first);
  }, [containerRef, stop, layout]);

  function itemProps(item: string): RovingItemProps {
    const tabIndex = item === stop ? 0 : -1;

    return { "data-roving-item": item, tabIndex };
  }

  function onFocus(event: FocusEvent<HTMLElement>) {
    const item = itemOf(event.target);

    if (item !== undefined && item !== current) setCurrent(item);
  }

  function onKeyDown(event: KeyboardEvent<HTMLElement>) {
    const from = event.target;
    const move = MOVES.get(event.key);
    const item = itemOf(from);

    if (event.defaultPrevented || move === undefined || item === undefined)
      return;

    const items = itemsIn(event.currentTarget);
    const index = items.findIndex((each) => each === from);
    const last = items.length - 1;
    const moved = move(index, last);
    event.preventDefault();
    items[moved]?.focus();
  }

  function focus(asked: readonly string[]) {
    const element = containerRef.current;

    if (element === null) return;

    const items = itemsIn(element);
    const present = asked.flatMap((name) =>
      items.filter((each) => each.dataset.rovingItem === name),
    );
    present[0]?.focus();
  }

  return { itemProps, onFocus, onKeyDown, focus };
}

function itemsIn(container: Element): readonly HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>(ITEMS)];
}

function itemOf(target: EventTarget): string | undefined {
  if (!(target instanceof HTMLElement)) return undefined;

  return target.dataset.rovingItem;
}
