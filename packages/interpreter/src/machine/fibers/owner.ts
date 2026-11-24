import type { Frame } from "../frames/index.js";
import type { FiberId } from "../registers/index.js";
import { type OwnedAt, type Owner, hasPassed } from "../time/index.js";
import type { Fiber } from "./fiber.js";

const unlimited: Owner = { kind: "none" };

type Parents = ReadonlyMap<FiberId, FiberId>;

export function ownerOf(chain: readonly Fiber[]): Owner {
  const deadlines = chain.flatMap(deadlinesOf);

  return deadlines.reduce<Owner>(earlierOf, unlimited);
}

export function lapsedOwnerOf(fibers: readonly Fiber[], now: number): Owner {
  const deadlines = fibers.flatMap(deadlinesOf);
  const passed = deadlines.filter((owned) => hasPassed(owned.instant, now));

  if (passed.length === 0) {
    return unlimited;
  }

  const instants = passed.map((owned) => owned.instant);
  const earliest = Math.min(...instants);
  const tied = passed.filter((owned) => owned.instant === earliest);
  const parents = parentsOf(fibers);
  const innermost = tied.filter((owned) => isInnermost(owned, tied, parents));
  const byFiber = innermost.toSorted((one, other) => one.fiber - other.fiber);
  const [first] = byFiber;

  return first ?? unlimited;
}

function isInnermost(
  owned: OwnedAt,
  tied: readonly OwnedAt[],
  parents: Parents,
): boolean {
  const inside = tied.filter((other) => isInside(other, owned, parents));

  return inside.length === 0;
}

function isInside(inner: OwnedAt, outer: OwnedAt, parents: Parents): boolean {
  if (inner.fiber === outer.fiber) {
    return inner.depth > outer.depth;
  }

  return descendsFrom(inner.fiber, outer.fiber, parents);
}

function descendsFrom(
  fiber: FiberId,
  ancestor: FiberId,
  parents: Parents,
): boolean {
  for (
    let parent = parents.get(fiber);
    parent !== undefined;
    parent = parents.get(parent)
  ) {
    if (parent === ancestor) {
      return true;
    }
  }

  return false;
}

function parentsOf(fibers: readonly Fiber[]): Parents {
  const parents = new Map<FiberId, FiberId>();

  for (const fiber of fibers) {
    const parent = fiber.parent;

    if (parent !== "root") {
      parents.set(fiber.id, parent);
    }
  }

  return parents;
}

function deadlinesOf(fiber: Fiber): readonly OwnedAt[] {
  const frames = fiber.continuation.toArray();
  const top = frames.length - 1;

  return frames.flatMap((frame, index) => {
    const depth = top - index;
    return deadlineAt(frame, fiber.id, depth);
  });
}

function deadlineAt(
  frame: Frame,
  fiber: FiberId,
  depth: number,
): readonly OwnedAt[] {
  if (frame.kind !== "deadline") {
    return [];
  }

  const owner: OwnedAt = { kind: "at", instant: frame.instant, fiber, depth };
  return [owner];
}

function earlierOf(owner: Owner, deadline: OwnedAt): Owner {
  if (owner.kind === "none") {
    return deadline;
  }

  const isEarlier = deadline.instant < owner.instant;

  if (isEarlier) {
    return deadline;
  }

  return owner;
}
