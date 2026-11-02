import type {
  ChildWorkflowHandle,
  WorkflowCondition,
  WorkflowContext,
} from '@nestjs/workflows';

// What one run of an instance remembers between its rounds; a replay rebuilds it.
export class RunState {
  static readonly #FIRST_BUSY_MS = 1_000;
  static readonly #LAST_BUSY_MS = 30_000;

  readonly #instanceId: string;
  readonly #attempted = new Set<string>();
  readonly #awaited = new Map<string, ChildWorkflowHandle<void>>();
  #busy = RunState.#FIRST_BUSY_MS;

  constructor(instanceId: string) {
    this.#instanceId = instanceId;
  }

  get instanceId(): string {
    return this.#instanceId;
  }

  // The sub-workflows not yet started, in the order the instance asked for them.
  unattempted(ids: readonly string[]): readonly string[] {
    return ids.filter((id) => !this.#attempted.has(id));
  }

  attempt(id: string): void {
    this.#attempted.add(id);
  }

  await(id: string, handle: ChildWorkflowHandle<void>): void {
    this.#awaited.set(id, handle);
  }

  // 1 s, doubling to 30 s while capacity stays short.
  busy(): number {
    const pause = this.#busy;
    this.#busy = Math.min(pause * 2, RunState.#LAST_BUSY_MS);
    return pause;
  }

  rested(): void {
    this.#busy = RunState.#FIRST_BUSY_MS;
  }

  conditions(
    ctx: WorkflowContext,
    wakeAt: number | null,
  ): Record<string, WorkflowCondition> {
    const conditions: Record<string, WorkflowCondition> = {};

    if (wakeAt !== null) conditions.timer = ctx.timer({ until: wakeAt });

    for (const [id, handle] of this.#awaited) conditions[id] = handle;

    return conditions;
  }

  // Whether `key` was an awaited child; it is awaited no longer.
  ended(key: string): boolean {
    return this.#awaited.delete(key);
  }
}
