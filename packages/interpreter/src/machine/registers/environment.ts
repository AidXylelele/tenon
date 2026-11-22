import type { JsonValue } from "../../api/index.js";
import {
  type BinderSlot,
  type Binders,
  constantListOf,
} from "../../core/index.js";
import { InterpreterError } from "../../runtime/index.js";

export type BoundValues = Partial<
  Readonly<Record<BinderSlot["role"], JsonValue>>
>;

interface Outermost {
  readonly kind: "outermost";
}

interface Enclosed {
  readonly kind: "enclosed";
  readonly environment: Environment;
}

type Enclosing = Outermost | Enclosed;

const outermost: Outermost = { kind: "outermost" };

const noSlots: readonly JsonValue[] = constantListOf([]);

export class Environment {
  static readonly empty = new Environment(noSlots, outermost);

  readonly #slots: readonly JsonValue[];
  readonly #enclosing: Enclosing;

  private constructor(slots: readonly JsonValue[], enclosing: Enclosing) {
    this.#slots = slots;
    this.#enclosing = enclosing;
  }

  get slots(): readonly JsonValue[] {
    return this.#slots;
  }

  get enclosing(): Enclosing {
    return this.#enclosing;
  }

  extended(slots: readonly JsonValue[]): Environment {
    const enclosing: Enclosed = { kind: "enclosed", environment: this };

    return new Environment(slots, enclosing);
  }

  bound(binders: Binders, values: BoundValues): Environment {
    const slots = binders.slots.map((slot) => this.#valueOf(slot, values));

    return this.extended(slots);
  }

  slotAt(depth: number, index: number): JsonValue {
    if (depth > 0) {
      const enclosing = this.#enclosingOf(depth);
      const outward = depth - 1;

      return enclosing.slotAt(outward, index);
    }

    const slot = this.#slots[index];

    if (slot === undefined) {
      throw new InterpreterError(
        `No slot ${String(index)} in a frame of the environment.`,
      );
    }

    return slot;
  }

  #enclosingOf(depth: number): Environment {
    const enclosing = this.#enclosing;

    if (enclosing.kind === "outermost") {
      throw new InterpreterError(
        `The environment has no frame ${String(depth)} out.`,
      );
    }

    return enclosing.environment;
  }

  #valueOf(slot: BinderSlot, values: BoundValues): JsonValue {
    const value = values[slot.role];

    if (value === undefined) {
      throw new InterpreterError(
        `Nothing is bound to the binder '${slot.name}'.`,
      );
    }

    return value;
  }
}
