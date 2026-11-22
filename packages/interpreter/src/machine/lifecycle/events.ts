import type { JsonObject, LifecycleEvent, RunMark } from "../../api/index.js";
import { instantTextOf } from "../../runtime/index.js";
import {
  type LifecycleEventName,
  type TaskEventName,
  type WorkflowEventName,
  lifecycleEventCatalogue,
} from "../../standard/index.js";
import { executionOf } from "../identity/index.js";
import type { Activation } from "../registers/index.js";
import type { View } from "../view.js";

export interface TaskReport {
  readonly name: TaskEventName;
  readonly cell: Activation;
  readonly details: JsonObject;
}

export function workflowEventOf(
  name: WorkflowEventName,
  view: View,
  details: JsonObject,
): LifecycleEvent {
  const mark = markOf(view);
  return markedEventOf(name, mark, details);
}

export function markedEventOf(
  name: WorkflowEventName,
  mark: RunMark,
  details: JsonObject,
): LifecycleEvent {
  const types = lifecycleEventCatalogue[name].types;
  const workflow = qualifiedNameOf(mark);
  const moment = momentOf(name, mark);
  const data = { name: workflow, ...moment, ...details };

  return { subject: "workflow", name, types, data };
}

export function workflowStartedOf(view: View): LifecycleEvent {
  const identity = view.program.manifest.identity;
  const definition = {
    name: identity.name,
    namespace: identity.namespace,
    version: identity.version,
  };
  const details = { definition };

  return workflowEventOf("workflow.started", view, details);
}

export function correlationStartedOf(view: View): LifecycleEvent {
  return workflowEventOf("workflow.correlation-started", view, {});
}

export function correlationCompletedOf(
  keys: JsonObject,
  view: View,
): LifecycleEvent {
  const details = { correlationKeys: keys };

  return workflowEventOf("workflow.correlation-completed", view, details);
}

export function taskEventOf(report: TaskReport, view: View): LifecycleEvent {
  const name = report.name;
  const types = lifecycleEventCatalogue[name].types;
  const mark = markOf(view);
  const workflow = qualifiedNameOf(mark);
  const task = report.cell.descriptor.reference;
  const moment = momentOf(name, mark);
  const data = { workflow, task, ...moment, ...report.details };
  const execution = executionOf(report.cell.path);

  return { subject: "task", name, types, data, execution };
}

function markOf(view: View): RunMark {
  return {
    identity: view.program.manifest.identity,
    instance: view.run.instance,
    now: view.context.now,
  };
}

function qualifiedNameOf(mark: RunMark): string {
  const { identity, instance } = mark;
  return `${identity.name}-${instance}.${identity.namespace}`;
}

function momentOf(name: LifecycleEventName, mark: RunMark): JsonObject {
  const at = lifecycleEventCatalogue[name].at;
  const now = instantTextOf(mark.now);

  return { [at]: now };
}
