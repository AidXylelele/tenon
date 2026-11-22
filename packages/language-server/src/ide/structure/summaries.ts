import type { ast, JsonValue } from "interpreter/front-end";
import { isJsonObject, valueAt } from "../pointers/index.js";
import { inlineYamlOf } from "../yaml-text/index.js";

export function summaryOf(task: ast.Task, document: JsonValue): string | null {
  switch (task.kind) {
    case "call":
      return callSummaryOf(task.call, document);
    case "run":
      return processSummaryOf(task.process, document);
    case "set":
      return setSummaryOf(task.set, document);
    case "wait":
      return writtenAt(document, task.wait.pointer);
    case "emit":
      return emittedTypeOf(task.event, document);
    case "listen":
      return eventTypesOf(task.to, document);
    case "raise":
      return raisedSummaryOf(task.error, document);
    case "for":
      return forSummaryOf(task, document);
    case "fork":
      return forkSummaryOf(task);
    case "switch":
      return countOf(task.switch.length, "case", "cases");
    case "try":
    case "do":
      return null;
  }
}

export function triggerSummaryOf(
  schedule: ast.Schedule,
  document: JsonValue,
): string {
  switch (schedule.kind) {
    case "every":
    case "after":
      return writtenAt(document, schedule.pointer);
    case "cron":
      return schedule.cron;
    case "on":
      return eventTypesOf(schedule.strategy, document) ?? "";
  }
}

export function triggerMillisecondsOf(schedule: ast.Schedule): number | null {
  switch (schedule.kind) {
    case "every":
      return millisecondsOf(schedule.interval);
    case "after":
      return millisecondsOf(schedule.delay);
    case "cron":
    case "on":
      return null;
  }
}

export function stepMillisecondsOf(task: ast.Task): number | null {
  if (task.kind !== "wait") {
    return null;
  }

  return millisecondsOf(task.wait);
}

function millisecondsOf(duration: ast.Duration): number | null {
  switch (duration.kind) {
    case "fixed":
      return duration.milliseconds;
    case "calendar":
    case "computed":
    case "invalid":
      return null;
  }
}

function callSummaryOf(call: ast.Call, document: JsonValue): string | null {
  switch (call.kind) {
    case "http": {
      const method = writtenAt(document, call.method.pointer);
      const endpoint = writtenAt(document, call.endpoint.uri.pointer);
      const verb = method.toUpperCase();
      return writtenPartsOf([verb, endpoint], " ");
    }
    case "openapi":
      return writtenPartsOf([call.operationId], "");
    case "grpc":
      return writtenPartsOf([call.service.name, call.method], ".");
    case "asyncapi": {
      const target = asyncApiTargetOf(call.target);
      return writtenPartsOf([target], "");
    }
    case "a2a":
      return call.method;
    case "mcp":
      return call.method;
    case "function":
      return call.function.name;
  }
}

function asyncApiTargetOf(
  target: ast.AsyncApiChannelTarget | ast.AsyncApiOperationTarget,
): string {
  switch (target.kind) {
    case "channel":
      return target.channel;
    case "operation":
      return target.operation;
  }
}

function processSummaryOf(
  process: ast.Process,
  document: JsonValue,
): string | null {
  const detail = processDetailOf(process, document);

  return writtenPartsOf([process.kind, detail], " ");
}

function processDetailOf(process: ast.Process, document: JsonValue): string {
  switch (process.kind) {
    case "container":
      return writtenAt(document, process.image.pointer);
    case "script":
      return process.language;
    case "shell":
      return writtenAt(document, process.command.pointer);
    case "workflow":
      return process.name;
  }
}

function setSummaryOf(
  set: ast.ValueTemplate,
  document: JsonValue,
): string | null {
  const written = valueAt(document, set.pointer) ?? null;

  if (typeof written === "string") {
    return written;
  }

  const isMapping = isJsonObject(written);

  if (!isMapping) {
    return null;
  }

  const names = Object.keys(written);
  return names.join(", ");
}

function emittedTypeOf(
  event: ast.EventProperties,
  document: JsonValue,
): string | null {
  const type = event.type;

  if (type === null) {
    return null;
  }

  const written = writtenAt(document, type.pointer);
  return writtenPartsOf([written], "");
}

function eventTypesOf(
  strategy: ast.ConsumptionStrategy,
  document: JsonValue,
): string | null {
  const filters = filtersOf(strategy);
  const types = filters.flatMap((filter) => {
    const type = filter.with.attributes.get("type");
    return type === undefined ? [] : [writtenAt(document, type.pointer)];
  });

  return writtenPartsOf(types, ", ");
}

function filtersOf(
  strategy: ast.ConsumptionStrategy,
): readonly ast.EventFilter[] {
  switch (strategy.kind) {
    case "all":
    case "any":
      return strategy.filters;
    case "one":
      return [strategy.filter];
  }
}

function raisedSummaryOf(
  error: ast.ErrorDefinition | ast.Reference,
  document: JsonValue,
): string {
  switch (error.kind) {
    case "error":
      return writtenAt(document, error.type.pointer);
    case "reference":
      return error.name;
  }
}

function forSummaryOf(task: ast.ForTask, document: JsonValue): string {
  const collection = writtenAt(document, task.in.pointer);

  return `${task.each} in ${collection}`;
}

function forkSummaryOf(task: ast.ForkTask): string {
  const count = task.branches.tasks.length;
  const branches = countOf(count, "branch", "branches");

  return task.compete ? `${branches}, compete` : branches;
}

function countOf(count: number, one: string, many: string): string {
  const noun = count === 1 ? one : many;

  return `${String(count)} ${noun}`;
}

function writtenPartsOf(
  parts: readonly string[],
  separator: string,
): string | null {
  const written = parts.filter((part) => part.trim() !== "");

  if (written.length === 0) {
    return null;
  }

  return written.join(separator);
}

function writtenAt(document: JsonValue, pointer: string): string {
  const written = valueAt(document, pointer) ?? null;

  if (typeof written === "string") {
    return written;
  }

  return inlineYamlOf(written);
}
