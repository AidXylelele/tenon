import type { Schedule } from "../../api/index.js";
import { InterpreterError } from "../../runtime/index.js";
import type * as ast from "../../syntax/index.js";
import {
  type Iterator,
  type Stream,
  afterSchedule,
  cronSchedule,
  eventSchedule,
  everySchedule,
  listenSource,
  stopConsumption,
  stream,
} from "../forms/index.js";
import type { Context } from "./context.js";
import { strategyTemplateOf } from "./strategies.js";

const noIterators: readonly Iterator[] = [];

export function schedulesOf(
  schedules: readonly ast.Schedule[],
  context: Context,
): readonly Schedule[] {
  return schedules.map((schedule) => scheduleOf(schedule, context));
}

export function triggersOf(
  schedules: readonly ast.Schedule[],
  context: Context,
): readonly Stream[] {
  const triggers = schedules.filter((schedule) => schedule.kind === "on");
  return triggers.map((trigger) => triggerOf(trigger, context));
}

function scheduleOf(schedule: ast.Schedule, context: Context): Schedule {
  switch (schedule.kind) {
    case "every": {
      const interval = lengthOf(schedule.interval);
      return everySchedule({ interval });
    }
    case "cron":
      return cronSchedule({ cron: schedule.cron });
    case "after": {
      const delay = lengthOf(schedule.delay);
      return afterSchedule({ delay });
    }
    case "on": {
      const id = context.termIdOf(schedule.pointer, "stream");
      const types = consumedTypesOf(schedule.strategy);
      return eventSchedule({ stream: id, types });
    }
  }
}

function triggerOf(schedule: ast.EventSchedule, context: Context): Stream {
  const id = context.termIdOf(schedule.pointer, "stream");
  const strategy = strategyTemplateOf(schedule.strategy, context);
  const source = listenSource({ strategy, read: schedule.read });

  return stream({
    id,
    source,
    stop: stopConsumption,
    iterators: noIterators,
  });
}

function consumedTypesOf(strategy: ast.ConsumptionStrategy): readonly string[] {
  const filters = filtersOf(strategy);
  const types = filters.flatMap(typeOf);

  return [...new Set(types)];
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

function typeOf(filter: ast.EventFilter): readonly string[] {
  const type = filter.with.attributes.get("type");

  if (type?.kind !== "pattern") {
    return [];
  }

  return [type.pattern];
}

function lengthOf(duration: ast.Duration): number {
  switch (duration.kind) {
    case "fixed":
      return duration.milliseconds;
    case "calendar":
    case "computed":
    case "invalid":
      throw new InterpreterError(
        `The schedule's length at '${duration.pointer}' is not fixed.`,
      );
  }
}
