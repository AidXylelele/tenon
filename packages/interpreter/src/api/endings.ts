import type { WorkflowError } from "./errors.js";
import type { LifecycleEvent } from "./events.js";
import type { WorkflowIdentity } from "./manifest.js";

export interface RunMark {
  readonly identity: WorkflowIdentity;
  readonly instance: string;
  readonly now: number;
}

interface FaultedByHost extends RunMark {
  readonly phase: "faulted";
  readonly detail: string;
}

interface CancelledByHost extends RunMark {
  readonly phase: "cancelled";
}

export type HostEnd = FaultedByHost | CancelledByHost;

export interface Ending {
  readonly events: readonly LifecycleEvent[];
  readonly error: WorkflowError | null;
}
