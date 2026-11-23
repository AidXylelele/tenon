import type { PageNumber } from "./interfaces";

export const PAGE_SIZES: readonly number[] = [25, 50, 100];

const NEAR = 2;

const numbers = new Intl.NumberFormat("en-US");

export function pageCountOf(total: number, size: number): number {
  const count = Math.ceil(total / size);
  return Math.max(1, count);
}

export function pageNumbersOf(
  page: number,
  count: number,
): readonly PageNumber[] {
  const shown = Array.from({ length: count }, (_, index) => index + 1).filter(
    (each) => each === 1 || each === count || Math.abs(each - page) <= NEAR,
  );
  return shown.flatMap((each, index): PageNumber[] => {
    const previous = shown[index - 1];
    const skipped = previous !== undefined && each - previous > 1;
    const number: PageNumber = { kind: "page", page: each };

    if (!skipped) return [number];

    const gap: PageNumber = { kind: "gap", key: `after-${String(previous)}` };
    return [gap, number];
  });
}

export function rangeText(
  page: number,
  size: number,
  total: number,
  exact: boolean,
): string {
  const first = (page - 1) * size + 1;
  const last = Math.min(total, page * size);
  const range = `${numbers.format(first)}–${numbers.format(last)}`;
  const counted = numbers.format(total);
  const of = exact ? counted : `more than ${counted}`;
  return `${range} of ${of}`;
}
