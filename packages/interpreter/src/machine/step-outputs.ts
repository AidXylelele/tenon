import type {
  Effect,
  EffectId,
  LifecycleEvent,
  TaskValue,
} from "../api/index.js";
import type { Write } from "./transitions/index.js";

type StepOutput = Extract<
  Write,
  {
    readonly kind:
      "reported" | "taken" | "given" | "requested" | "withdrawn" | "declined";
  }
>;

export interface Outputs {
  readonly events: readonly LifecycleEvent[];
  readonly taskInputs: readonly TaskValue[];
  readonly taskOutputs: readonly TaskValue[];
  readonly requested: readonly Effect[];
  readonly withdrawn: readonly EffectId[];
  readonly declined: readonly string[];
}

export class StepOutputs {
  readonly #events: LifecycleEvent[] = [];
  readonly #taskInputs: TaskValue[] = [];
  readonly #taskOutputs: TaskValue[] = [];
  readonly #requested: Effect[] = [];
  readonly #withdrawn: EffectId[] = [];
  readonly #declined: string[] = [];

  recorded(write: StepOutput): void {
    switch (write.kind) {
      case "reported":
        this.#events.push(write.event);
        return;
      case "taken":
        this.#taskInputs.push(write.input);
        return;
      case "given":
        this.#taskOutputs.push(write.output);
        return;
      case "requested":
        this.#requested.push(write.effect);
        return;
      case "withdrawn":
        this.#withdrew(write.id);
        return;
      case "declined":
        this.#declined.push(write.id);
        return;
    }
  }

  copied(): Outputs {
    const events = Array.from(this.#events);
    const taskInputs = Array.from(this.#taskInputs);
    const taskOutputs = Array.from(this.#taskOutputs);
    const requested = Array.from(this.#requested);
    const withdrawn = Array.from(this.#withdrawn);
    const declined = Array.from(this.#declined);

    return { events, taskInputs, taskOutputs, requested, withdrawn, declined };
  }

  #withdrew(id: EffectId): void {
    const at = this.#requested.findIndex((effect) => effect.id === id);
    const isRequestedNow = at !== -1;

    if (isRequestedNow) {
      this.#requested.splice(at, 1);
      return;
    }

    this.#withdrawn.push(id);
  }
}
