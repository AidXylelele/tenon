import type { BackoffKind } from "../../standard/index.js";

export interface Amounts {
  readonly delay: number;
  readonly from: number;
  readonly to: number;
}

export function waitOf(
  amounts: Amounts,
  factor: number,
  fraction: number,
): number {
  const backedOff = amounts.delay * factor;
  const range = amounts.to - amounts.from;
  const jitter = amounts.from + fraction * range;

  return Math.round(backedOff + jitter);
}

export function factorOf(backoff: BackoffKind, attempt: number): number {
  switch (backoff) {
    case "constant":
      return 1;
    case "linear":
      return attempt;
    case "exponential":
      return 2 ** (attempt - 1);
  }
}
