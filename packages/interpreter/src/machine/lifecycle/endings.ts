import type {
  Ending,
  HostEnd,
  JsonObject,
  WorkflowError,
} from "../../api/index.js";
import { rootPointer } from "../../runtime/index.js";
import {
  type StatusPhase,
  type TaskEventName,
  type WorkflowEventName,
  standardErrorOf,
} from "../../standard/index.js";
import type { Address } from "../registers/index.js";
import { type Write, freed, reported } from "../transitions/index.js";
import type { View } from "../view.js";
import {
  type TaskReport,
  markedEventOf,
  taskEventOf,
  workflowEventOf,
} from "./events.js";
import { phaseChangedOf } from "./phases.js";

type EndPhase = Extract<StatusPhase, "completed" | "faulted" | "cancelled">;

interface End {
  readonly phase: EndPhase;
  readonly details: JsonObject;
}

const taskEvents: Readonly<Record<EndPhase, TaskEventName>> = {
  completed: "task.completed",
  faulted: "task.faulted",
  cancelled: "task.cancelled",
};

const workflowEvents: Readonly<Record<EndPhase, WorkflowEventName>> = {
  completed: "workflow.completed",
  faulted: "workflow.faulted",
  cancelled: "workflow.cancelled",
};

export const completedEnd: End = { phase: "completed", details: {} };

export const cancelledEnd: End = { phase: "cancelled", details: {} };

export function faultedEnd(error: JsonObject): End {
  return { phase: "faulted", details: { error } };
}

export function taskEndedOf(
  address: Address,
  end: End,
  view: View,
): readonly Write[] {
  const cell = view.store.cellAt(address);
  const name = taskEvents[end.phase];
  const report: TaskReport = { name, cell, details: end.details };
  const event = taskEventOf(report, view);
  const ended = reported(event);
  const phase = phaseChangedOf(address, end.phase, view);
  const release = freed(address);

  return [ended, ...phase, release];
}

export function workflowEndedOf(
  address: Address,
  end: End,
  view: View,
): readonly Write[] {
  const name = workflowEvents[end.phase];
  const event = workflowEventOf(name, view, end.details);
  const ended = reported(event);
  const phase = phaseChangedOf(address, end.phase, view);
  const release = freed(address);

  return [ended, ...phase, release];
}

export function endingOf(end: HostEnd): Ending {
  switch (end.phase) {
    case "faulted": {
      const error = hostFaultOf(end.detail);
      const event = markedEventOf("workflow.faulted", end, { error });
      return { events: [event], error };
    }
    case "cancelled": {
      const event = markedEventOf("workflow.cancelled", end, {});
      return { events: [event], error: null };
    }
  }
}

function hostFaultOf(detail: string): WorkflowError {
  const runtime = standardErrorOf("runtime");

  return {
    type: runtime.type,
    status: runtime.status,
    title: runtime.title,
    detail,
    instance: rootPointer,
  };
}
