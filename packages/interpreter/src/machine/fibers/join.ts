import type { JsonValue } from "../../api/index.js";
import { InterpreterError } from "../../runtime/index.js";
import { isEnded, normalOf } from "../completions/index.js";
import {
  type Frame,
  type JoinK,
  type Joined,
  joinK,
  joinedOutput,
} from "../frames/index.js";
import type { FiberId } from "../registers/index.js";
import {
  type BranchCompleted,
  type BranchReport,
  type Control,
  raising,
  returning,
} from "../transitions/index.js";

interface Waiting {
  readonly kind: "waiting";
  readonly join: JoinK;
}

interface Done {
  readonly kind: "done";
  readonly control: Control;
  readonly cancel: readonly FiberId[];
}

type JoinStep = Waiting | Done;

export function joinedOf(join: JoinK, report: BranchReport): JoinStep {
  switch (report.kind) {
    case "raised": {
      const raised = raising(report.error);
      return doneOf(join, report.index, raised);
    }
    case "completed":
      return branchCompletedOf(join, report);
  }
}

export function pendingFibersOf(join: JoinK): readonly FiberId[] {
  return join.branches.filter((_fiber, index) => isPendingAt(join, index));
}

export function checkForkOf(join: JoinK, fibers: readonly FiberId[]): void {
  const named = join.branches;
  const isSameCount = fibers.length === named.length;
  const isNamed = fibers.every((fiber, index) => fiber === named[index]);

  const isForked = isSameCount && isNamed;

  if (isForked) {
    return;
  }

  throw new InterpreterError(
    `A fork forks the fibers ${fibers.join(", ")}, but its join names the fibers ${named.join(", ")}.`,
  );
}

export function joinFrameOf(frame: Frame): JoinK {
  if (frame.kind !== "join") {
    throw new InterpreterError(
      `A fork's parent holds its join on top, not the ${frame.kind} frame.`,
    );
  }

  return frame;
}

function branchCompletedOf(join: JoinK, report: BranchCompleted): JoinStep {
  const completion = report.completion;
  const ended = isEnded(completion);

  if (ended) {
    const passed = returning(completion);
    return doneOf(join, report.index, passed);
  }

  switch (join.parallel.join) {
    case "first": {
      const won = normalOf(completion.value);
      const returned = returning(won);
      return doneOf(join, report.index, returned);
    }
    case "all":
      return joinedAllOf(join, report.index, completion.value);
  }
}

function joinedAllOf(join: JoinK, index: number, output: JsonValue): JoinStep {
  const reported = joinedOutput(output);
  const outputs = join.outputs.with(index, reported);
  const values = outputs.flatMap(outputsOf);
  const isJoined = values.length === outputs.length;

  if (!isJoined) {
    const waiting = joinK({
      parallel: join.parallel,
      branches: join.branches,
      outputs,
    });
    return { kind: "waiting", join: waiting };
  }

  const all = normalOf(values);
  const returned = returning(all);
  return { kind: "done", control: returned, cancel: [] };
}

function doneOf(join: JoinK, index: number, control: Control): JoinStep {
  const reporting = join.branches[index];
  const pending = pendingFibersOf(join);
  const cancel = pending.filter((fiber) => fiber !== reporting);

  return { kind: "done", control, cancel };
}

function isPendingAt(join: JoinK, index: number): boolean {
  const joined = join.outputs[index];

  return joined?.kind === "pending";
}

function outputsOf(joined: Joined): readonly JsonValue[] {
  switch (joined.kind) {
    case "pending":
      return [];
    case "joined":
      return [joined.output];
  }
}
