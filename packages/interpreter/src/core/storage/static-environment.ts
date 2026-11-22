import { Stack } from "immutable";
import { InterpreterError } from "../../runtime/index.js";
import type { SlotMeaning } from "../forms/index.js";
import type { Slot, StaticFrame } from "./types.js";

const noFrames = Stack<StaticFrame>();

export class StaticEnvironment {
  static readonly empty = new StaticEnvironment(noFrames);

  readonly #frames: Stack<StaticFrame>;

  private constructor(frames: Stack<StaticFrame>) {
    this.#frames = frames;
  }

  extended(frame: StaticFrame): StaticEnvironment {
    const frames = this.#frames.push(frame);

    return new StaticEnvironment(frames);
  }

  slotOf(meaning: SlotMeaning): Slot {
    for (const [depth, frame] of this.#frames.entries()) {
      const index = frame.findIndex((held) => this.#isSameSlot(held, meaning));

      if (index !== -1) {
        return { depth, index };
      }
    }

    throw new InterpreterError(
      `No frame of the static environment holds ${JSON.stringify(meaning)}.`,
    );
  }

  #isSameSlot(held: SlotMeaning, wanted: SlotMeaning): boolean {
    switch (held.kind) {
      case "argument":
        return wanted.kind === "argument" && held.argument === wanted.argument;
      case "binder":
        return (
          wanted.kind === "binder" &&
          held.declaration === wanted.declaration &&
          held.role === wanted.role
        );
    }
  }
}
