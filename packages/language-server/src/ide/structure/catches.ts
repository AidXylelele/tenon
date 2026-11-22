import type { ast, SemanticModel } from "interpreter/front-end";
import type {
  Afterward,
  CatchPolicy,
  CaughtErrors,
  RetryPlan,
} from "./interfaces.js";
import { millisecondsOf } from "./summaries.js";

export function catchPolicyOf(
  task: ast.Task,
  model: SemanticModel,
): CatchPolicy | null {
  if (task.kind !== "try") {
    return null;
  }

  const caught = task.catch;
  const errors = caughtErrorsOf(caught.errors);
  const policy = retryPolicyOf(caught.retry, model);
  const retry = retryPlanOf(policy);
  const afterward = afterwardOf(caught);
  const when = caught.when?.source ?? null;
  const exceptWhen = caught.exceptWhen?.source ?? null;

  return { errors, when, exceptWhen, retry, afterward };
}

function caughtErrorsOf(filter: ast.ErrorFilter | null): CaughtErrors | null {
  if (filter === null) {
    return null;
  }

  const { type, status, instance, title, detail } = filter;
  return { type, status, instance, title, detail };
}

function retryPolicyOf(
  retry: ast.RetryPolicy | ast.Reference | null,
  model: SemanticModel,
): ast.RetryPolicy | null {
  if (retry === null) {
    return null;
  }

  switch (retry.kind) {
    case "retry":
      return retry;
    case "reference":
      return model.symbols.references.retries.get(retry.pointer) ?? null;
  }
}

function retryPlanOf(policy: ast.RetryPolicy | null): RetryPlan | null {
  if (policy === null) {
    return null;
  }

  const milliseconds = delayOf(policy.delay);
  const when = policy.when?.source ?? null;
  const exceptWhen = policy.exceptWhen?.source ?? null;

  return {
    retries: policy.limit.attempt.count,
    milliseconds,
    backoff: policy.backoff.kind,
    when,
    exceptWhen,
  };
}

function delayOf(delay: ast.Duration | null): number | null {
  if (delay === null) {
    return 0;
  }

  return millisecondsOf(delay);
}

function afterwardOf(caught: ast.Catch): Afterward {
  const isRaisedAgain =
    caught.retry !== null && caught.do === null && caught.then === null;

  if (isRaisedAgain) {
    return "stop";
  }

  return caught.do === null ? "continue" : "handle";
}
