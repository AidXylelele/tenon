import { Stack } from "immutable";
import type { ActivationMark } from "./types.js";

const noMarks = Stack<ActivationMark>();

export class StaticActivations {
  static readonly empty = new StaticActivations(noMarks);

  readonly #marks: Stack<ActivationMark>;

  private constructor(marks: Stack<ActivationMark>) {
    this.#marks = marks;
  }

  entered(mark: ActivationMark): StaticActivations {
    const marks = this.#marks.push(mark);

    return new StaticActivations(marks);
  }

  get taskHops(): number {
    return this.#marks.takeWhile((mark) => mark === "transparent").count();
  }
}
