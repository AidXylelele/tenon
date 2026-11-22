import type {
  CloudEvent,
  EventFilter,
  JsonObject,
  JsonValue,
} from "../../api/index.js";
import {
  type CompiledExpression,
  type Evaluation,
  type ExpressionLanguage,
  InterpreterError,
  isCloudEvent,
  isTruthy,
} from "../../runtime/index.js";
import {
  type AttributeVerdict,
  type ConditionalVerdict,
  type Expression,
  type FilterTemplate,
  type Program,
  type Stream,
  filterVerdictsOf,
  listenStrategiesOf,
  placedFiltersOf,
} from "../forms/index.js";

interface Matching {
  readonly program: Program;
  readonly expressions: ExpressionLanguage;
}

const noArguments: JsonObject = Object.freeze({});

const fixedNow = 0;

export function eventFilterOf(
  program: Program,
  expressions: ExpressionLanguage,
): EventFilter {
  const filter = triggerFilterOf(program);
  const matching: Matching = { program, expressions };
  const accepts = (event: CloudEvent): boolean =>
    isAccepted(event, filter, matching);
  const eventFilter: EventFilter = { accepts };

  return Object.freeze(eventFilter);
}

function triggerFilterOf(program: Program): FilterTemplate {
  const filters = program.triggers.flatMap(triggerFiltersOf);
  const [filter] = filters;
  const isOneFilter = filter !== undefined && filters.length === 1;

  if (!isOneFilter) {
    throw new InterpreterError(
      "The program of a filter does not start on one filter.",
    );
  }

  return filter;
}

function triggerFiltersOf(trigger: Stream): readonly FilterTemplate[] {
  const strategies = listenStrategiesOf(trigger);

  return strategies.flatMap(placedFiltersOf);
}

function isAccepted(
  value: JsonValue,
  filter: FilterTemplate,
  matching: Matching,
): boolean {
  const isEvent = isCloudEvent(value);

  if (!isEvent) {
    return false;
  }

  const verdicts = filterVerdictsOf(value, filter, matching.program.patterns);
  const fails = verdicts.some((verdict) => verdict.kind === "failed");

  if (fails) {
    return false;
  }

  const conditionals = verdicts.filter(isConditional);
  return conditionals.every((verdict) => isConditionHeld(verdict, matching));
}

function isConditional(
  verdict: AttributeVerdict,
): verdict is ConditionalVerdict {
  return verdict.kind === "conditional";
}

function isConditionHeld(
  verdict: ConditionalVerdict,
  matching: Matching,
): boolean {
  const expression = compiledConditionOf(verdict.condition, matching.program);
  const evaluation: Evaluation = {
    expression,
    input: verdict.value,
    arguments: noArguments,
    now: fixedNow,
  };
  const evaluated = matching.expressions.evaluate(evaluation);

  switch (evaluated.kind) {
    case "value":
      return isTruthy(evaluated.value);
    case "failed":
      return false;
  }
}

function compiledConditionOf(
  condition: Expression,
  program: Program,
): CompiledExpression {
  const compiled = program.expressions.get(condition.id);

  if (compiled === undefined) {
    throw new InterpreterError(
      `The program compiled no expression '${condition.id}'.`,
    );
  }

  return compiled;
}
