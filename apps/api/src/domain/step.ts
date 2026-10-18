import { StepStatus } from './enums.js';
import type { NodeFailure, StepOutput, StepProps } from './interfaces.js';

export class Step {
  readonly #nodeId: string;
  #status: StepStatus;
  #attempts: number;
  #startedAt: Date | null;
  #finishedAt: Date | null;
  #outputs: readonly StepOutput[];
  #error: NodeFailure | null;

  constructor(props: StepProps) {
    this.#nodeId = props.nodeId;
    this.#status = props.status;
    this.#attempts = props.attempts;
    this.#startedAt = props.startedAt;
    this.#finishedAt = props.finishedAt;
    this.#outputs = props.outputs;
    this.#error = props.error;
  }

  static start(nodeId: string): Step {
    const now = new Date();
    return new Step({
      nodeId,
      status: StepStatus.Running,
      attempts: 0,
      startedAt: now,
      finishedAt: null,
      outputs: [],
      error: null,
    });
  }

  static handOn(nodeId: string, outputs: readonly StepOutput[]): Step {
    const now = new Date();
    return new Step({
      nodeId,
      status: StepStatus.Succeeded,
      attempts: 0,
      startedAt: now,
      finishedAt: now,
      outputs,
      error: null,
    });
  }

  static skip(nodeId: string): Step {
    return new Step({
      nodeId,
      status: StepStatus.Skipped,
      attempts: 0,
      startedAt: null,
      finishedAt: null,
      outputs: [],
      error: null,
    });
  }

  get nodeId(): string {
    return this.#nodeId;
  }

  get status(): StepStatus {
    return this.#status;
  }

  get attempts(): number {
    return this.#attempts;
  }

  get startedAt(): Date | null {
    return this.#startedAt;
  }

  get finishedAt(): Date | null {
    return this.#finishedAt;
  }

  get outputs(): readonly StepOutput[] {
    return this.#outputs;
  }

  get error(): NodeFailure | null {
    return this.#error;
  }

  get isRunning(): boolean {
    return this.#status === StepStatus.Running;
  }

  get executedBytes(): number {
    if (this.#attempts === 0) return 0;

    let bytes = 0;

    for (const output of this.#outputs) {
      bytes += output.bytes;
    }

    return bytes;
  }

  succeed(attempt: number, outputs: readonly StepOutput[]): void {
    this.#status = StepStatus.Succeeded;
    this.#attempts = attempt;
    this.#outputs = outputs;
    this.#finishedAt = new Date();
  }

  fail(
    attempt: number,
    failure: NodeFailure,
    outputs: readonly StepOutput[],
  ): void {
    this.#status = StepStatus.Failed;
    this.#attempts = attempt;
    this.#error = failure;
    this.#outputs = outputs;
    this.#finishedAt = new Date();
  }
}
