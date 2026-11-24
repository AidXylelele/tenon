import type { EffectResponse, Step } from "../../api/index.js";
import type { Fiber } from "../fibers/index.js";
import type { FiberId, RunRecord, Store } from "../registers/index.js";
import type { RunResult } from "../transitions/index.js";
import type { TermTable } from "./term-table.js";

export interface Snapshot {
  readonly run: RunRecord;
  readonly status: Step["status"];
  readonly store: Store;
  readonly fibers: readonly Fiber[];
  readonly nextFiber: FiberId;
  readonly queued: readonly EffectResponse[];
  readonly result: RunResult | Unended;
}

interface Unended {
  readonly kind: "running";
}

export const unended: Unended = { kind: "running" };

export interface Seal {
  readonly terms: TermTable;
  readonly fingerprint: string;
}

export function snapshotOf(parts: Snapshot): Snapshot {
  return {
    run: parts.run,
    status: parts.status,
    store: parts.store,
    fibers: parts.fibers,
    nextFiber: parts.nextFiber,
    queued: parts.queued,
    result: parts.result,
  };
}
