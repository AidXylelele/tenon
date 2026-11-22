import { Stack } from "immutable";
import { InterpreterError } from "../../runtime/index.js";
import { type Frame, branchK } from "../frames/index.js";
import type { FiberId } from "../registers/index.js";
import type { OwnedAt } from "../time/index.js";
import {
  type BranchReport,
  type Evaluating,
  type Unwinding,
  cancelling,
  expiryOf,
} from "../transitions/index.js";
import { type ReadyFiber, isAnswerTo } from "./agenda.js";
import { type Fiber, fiberOf } from "./fiber.js";
import { checkForkOf, joinFrameOf, joinedOf } from "./join.js";
import { topFrameOf } from "./top.js";

export class FiberTable {
  readonly #fibers: Map<FiberId, Fiber>;
  #ready: ReadyFiber[] = [];
  #next: FiberId;

  constructor(fibers: readonly Fiber[], next: FiberId) {
    const entries = fibers.map((fiber) => [fiber.id, fiber] as const);

    this.#fibers = new Map(entries);
    this.#next = next;
  }

  get next(): FiberId {
    return this.#next;
  }

  held(): readonly Fiber[] {
    const fibers = this.#fibers.values();

    return Array.from(fibers);
  }

  fiber(id: FiberId): Fiber {
    const fiber = this.#fibers.get(id);

    if (fiber === undefined) {
      throw new InterpreterError(`The run has no fiber ${String(id)}.`);
    }

    return fiber;
  }

  readied(ready: ReadyFiber): void {
    this.#ready.push(ready);
  }

  nextReady(): ReadyFiber | undefined {
    return this.#ready.shift();
  }

  forked(parent: FiberId, branches: readonly Evaluating[]): void {
    const forking = this.fiber(parent);
    const top = topFrameOf(forking);
    const join = joinFrameOf(top);
    const numbers = branches.map((_branch, index) => this.#next + index);
    const children: ReadyFiber[] = [];

    checkForkOf(join, numbers);

    for (const [index, control] of branches.entries()) {
      const id = this.#next;
      const bottom = branchK({ index });
      const continuation = Stack.of<Frame>(bottom);
      const fiber = fiberOf(id, parent, continuation);
      const ready: ReadyFiber = { kind: "run", fiber: id, control };

      this.#fibers.set(id, fiber);
      children.push(ready);
      this.#next = id + 1;
    }

    this.#ahead(children);
  }

  ended(id: FiberId, report: BranchReport): void {
    const parent = this.#parentOf(id);

    this.removed(id);

    const frame = this.popped(parent);
    const join = joinFrameOf(frame);
    const step = joinedOf(join, report);

    switch (step.kind) {
      case "waiting": {
        const frames = [step.join];
        this.pushed(parent, frames);
        return;
      }
      case "done": {
        const continued: ReadyFiber = {
          kind: "run",
          fiber: parent,
          control: step.control,
        };
        this.#unwoundBefore(step.cancel, continued);
        return;
      }
    }
  }

  unwound(parent: FiberId, unwinding: Unwinding): void {
    const continued: ReadyFiber = {
      kind: "run",
      fiber: parent,
      control: unwinding.then,
    };

    this.#unwoundBefore(unwinding.fibers, continued);
  }

  expired(owner: OwnedAt): void {
    const control = expiryOf(owner);
    const interrupted: ReadyFiber = {
      kind: "run",
      fiber: owner.fiber,
      control,
    };
    const entries = [interrupted];

    this.#ahead(entries);
  }

  removed(id: FiberId): void {
    this.#fibers.delete(id);
    this.#ready = this.#ready.filter((ready) => ready.fiber !== id);
  }

  hasAnswerFor(id: FiberId): boolean {
    return this.#ready.some((ready) => isAnswerTo(ready, id));
  }

  finished(id: FiberId): void {
    const fiber = this.fiber(id);

    if (fiber.parent !== "root") {
      throw new InterpreterError(
        `The fiber ${String(id)} is a branch's: only the run's first fiber finishes the run.`,
      );
    }

    this.removed(id);
  }

  chainOf(id: FiberId): readonly Fiber[] {
    const fiber = this.fiber(id);
    const parent = fiber.parent;

    if (parent === "root") {
      return [fiber];
    }

    const ancestors = this.chainOf(parent);
    return [fiber, ...ancestors];
  }

  depthOf(id: FiberId): number {
    const fiber = this.fiber(id);

    return fiber.continuation.size - 1;
  }

  popped(id: FiberId): Frame {
    const fiber = this.fiber(id);
    const frame = topFrameOf(fiber);
    const continuation = fiber.continuation.pop();
    const popped = fiberOf(id, fiber.parent, continuation);

    this.#fibers.set(id, popped);
    return frame;
  }

  pushed(id: FiberId, frames: readonly Frame[]): void {
    const fiber = this.fiber(id);
    const continuation = frames.reduce(
      (stack, frame) => stack.push(frame),
      fiber.continuation,
    );
    const pushed = fiberOf(id, fiber.parent, continuation);

    this.#fibers.set(id, pushed);
  }

  #parentOf(id: FiberId): FiberId {
    const parent = this.fiber(id).parent;

    if (parent === "root") {
      throw new InterpreterError(
        `The fiber ${String(id)} is the run's first: it ends no fork.`,
      );
    }

    return parent;
  }

  #unwoundBefore(fibers: readonly FiberId[], then: ReadyFiber): void {
    const cancels = fibers.map((fiber): ReadyFiber => ({
      kind: "run",
      fiber,
      control: cancelling,
    }));
    const entries = [...cancels, then];

    this.#ahead(entries);
  }

  #ahead(entries: readonly ReadyFiber[]): void {
    this.#ready = entries.concat(this.#ready);
  }
}
