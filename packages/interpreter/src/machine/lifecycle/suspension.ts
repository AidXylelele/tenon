import { type Fiber, topFrameOf } from "../fibers/index.js";
import type { Frame, TaskK, WorkflowK } from "../frames/index.js";
import type { Address } from "../registers/index.js";
import {
  type Write,
  reported,
  runResumed,
  runSuspended,
} from "../transitions/index.js";
import type { View } from "../view.js";
import { type TaskReport, taskEventOf, workflowEventOf } from "./events.js";
import { type AwaitedPhase, awaitedPhaseOf, phaseChangedOf } from "./phases.js";

export function suspendedOf(
  fibers: readonly Fiber[],
  view: View,
): readonly Write[] {
  const frames = fibers.flatMap(framesOf);
  const roots = frames.filter((frame) => frame.kind === "workflow");
  const tasks = frames.filter((frame) => frame.kind === "task");
  const workflow = roots.flatMap((root) => workflowSuspendedOf(root, view));
  const suspended = tasks.flatMap((task) => taskSuspendedOf(task, view));

  return [runSuspended, ...workflow, ...suspended];
}

export function resumedOf(
  fibers: readonly Fiber[],
  view: View,
): readonly Write[] {
  const frames = fibers.flatMap(framesOf);
  const roots = frames.filter((frame) => frame.kind === "workflow");
  const workflow = roots.flatMap((root) => workflowResumedOf(root, view));
  const resumed = fibers.flatMap((fiber) => tasksResumedOf(fiber, view));

  return [runResumed, ...workflow, ...resumed];
}

function framesOf(fiber: Fiber): readonly Frame[] {
  return fiber.continuation.toArray();
}

function workflowSuspendedOf(frame: WorkflowK, view: View): readonly Write[] {
  const event = workflowEventOf("workflow.suspended", view, {});
  const suspension = reported(event);
  const phase = phaseChangedOf(frame.activation, "suspended", view);

  return [suspension, ...phase];
}

function workflowResumedOf(frame: WorkflowK, view: View): readonly Write[] {
  const event = workflowEventOf("workflow.resumed", view, {});
  const resumption = reported(event);
  const phase = phaseChangedOf(frame.activation, "running", view);

  return [resumption, ...phase];
}

function taskSuspendedOf(frame: TaskK, view: View): readonly Write[] {
  const address = frame.activation;
  const cell = view.store.cellAt(address);
  const report: TaskReport = { name: "task.suspended", cell, details: {} };
  const event = taskEventOf(report, view);
  const suspension = reported(event);
  const phase = phaseChangedOf(address, "suspended", view);

  return [suspension, ...phase];
}

function tasksResumedOf(fiber: Fiber, view: View): readonly Write[] {
  const frames = framesOf(fiber);
  const tasks = frames.filter((frame) => frame.kind === "task");
  const top = topFrameOf(fiber);

  return tasks.flatMap((task) => taskResumedOf(task, top, view));
}

function taskResumedOf(frame: TaskK, top: Frame, view: View): readonly Write[] {
  const address = frame.activation;
  const cell = view.store.cellAt(address);
  const report: TaskReport = { name: "task.resumed", cell, details: {} };
  const event = taskEventOf(report, view);
  const resumption = reported(event);
  const held = heldPhaseOf(top, address);
  const phase = phaseChangedOf(address, held, view);

  return [resumption, ...phase];
}

function heldPhaseOf(top: Frame, address: Address): AwaitedPhase {
  const isAwaitFor = top.kind === "await" && top.activation === address;

  if (isAwaitFor) {
    return awaitedPhaseOf(top);
  }

  const isReceiveFor =
    top.kind === "receive" && top.scope.activation === address;

  if (isReceiveFor) {
    return awaitedPhaseOf(top);
  }

  return "running";
}
