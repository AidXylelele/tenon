import type { SandboxLimitsProps } from "./interfaces.js";

export class SandboxLimits {
  readonly time: Temporal.Duration;
  readonly memoryBytes: number;
  readonly processes: number;
  readonly outputBytes: number;

  constructor(props: SandboxLimitsProps) {
    this.time = props.time;
    this.memoryBytes = props.memoryBytes;
    this.processes = props.processes;
    this.outputBytes = props.outputBytes;
  }

  responseBytes(): number {
    const escapedOutputs = this.outputBytes * 6 * 2;
    const envelope = 64 * 1024;
    return escapedOutputs + envelope;
  }

  nanosecondsWithin(remaining: number | null): number {
    const own = this.time.total("milliseconds");
    const allowed = remaining === null ? own : Math.min(remaining, own);
    const bound = Temporal.Duration.from({ milliseconds: allowed });
    return bound.total("nanoseconds");
  }
}
