import type { Point } from "../../standard/index.js";
import type { Position } from "../occurrences/index.js";

const points: Readonly<Record<Position, Point>> = {
  workflowInput: "workflowInputFrom",
  workflowTimeout: "workflowTimeout",
  workflowOutput: "workflowOutputAs",
  taskIf: "taskIf",
  taskInput: "taskInputFrom",
  taskTimeout: "taskInputFrom",
  taskBody: "taskDefinition",
  taskOutput: "taskOutputAs",
  taskExport: "taskExportAs",
  iteratorOutput: "taskOutputAs",
  iteratorExport: "taskExportAs",
  extensionWhen: "taskDefinition",
  scheduleOn: "eventTrigger",
  scheduleTiming: "schedule",
  authenticationComponent: "taskDefinition",
  catalogComponent: "taskDefinition",
  errorComponent: "taskDefinition",
  retryComponent: "taskDefinition",
  timeoutComponent: "taskInputFrom",
};

export function pointOf(position: Position): Point {
  return points[position];
}
