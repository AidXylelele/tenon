import type { JsonObject } from "../../api/index.js";
import { handlingBindersOf } from "../../semantics/index.js";
import { errorProperties } from "../../standard/index.js";
import type * as ast from "../../syntax/index.js";
import {
  type Binders,
  type Case,
  type Catch,
  type CatchTest,
  type Expression,
  type Handle,
  type Recovery,
  type Term,
  choose,
  handle,
  matchTest,
  recover,
  reraise,
  sequence,
} from "../forms/index.js";
import { binderFrameOf } from "../storage/index.js";
import { bindersOf } from "./binders.js";
import type { Context } from "./context.js";
import { directiveOf } from "./directives.js";
import { taskListOf, taskListsOf } from "./do.js";
import { errorTestsOf } from "./error-tests.js";
import { retryOf } from "./retry.js";

const noTests: readonly CatchTest[] = [];
const noSteps: readonly Term[] = [];
const always: readonly Expression[] = [];

export function tryBodyOf(
  task: ast.TaskCommon & ast.TryTask,
  context: Context,
): Handle {
  const id = context.termIdOf(task.pointer, "handle");
  const declared = handlingBindersOf(task.catch.pointer, task.catch.as);
  const binders = bindersOf(declared);
  const frame = binderFrameOf(binders);
  const caught = context.extended(frame);
  const body = taskListOf(task.try, context);
  const handler = catchOf(task.catch, binders, caught);
  const retry = retryOf(task.catch.retry, frame, context);

  return handle({ id, body, catch: handler, retry });
}

function catchOf(
  written: ast.Catch,
  binders: Binders,
  context: Context,
): Catch {
  const matches = matchesOf(written.errors);
  const conditions = errorTestsOf(written.when, written.exceptWhen, context);
  const tests = [...matches, ...conditions];
  const recovery = recoveryOf(written, context);

  return { tests, binders, recovery };
}

function matchesOf(errors: ast.ErrorFilter | null): readonly CatchTest[] {
  if (errors === null) {
    return noTests;
  }

  const filter = filterOf(errors);
  return [matchTest({ filter })];
}

function filterOf(errors: ast.ErrorFilter): JsonObject {
  const written = errorProperties.filter(
    (property) => errors[property] !== null,
  );
  const entries = written.map(
    (property) => [property, errors[property]] as const,
  );

  return Object.fromEntries(entries);
}

function recoveryOf(written: ast.Catch, context: Context): Recovery {
  const reraises =
    written.retry !== null && written.do === null && written.then === null;

  if (reraises) {
    return reraise;
  }

  const id = context.termIdOf(written.pointer, "recovery");
  const compensations = taskListsOf(written.do, context);
  const transitions = transitionsOf(written.then, context);
  const steps = [...compensations, ...transitions];
  const body = sequence({ id, steps });

  return recover({ body });
}

function transitionsOf(
  then: ast.Directive | null,
  context: Context,
): readonly Term[] {
  if (then === null) {
    return noSteps;
  }

  const id = context.termIdOf(then.pointer, "choose");
  const directive = directiveOf(then, context);
  const chosen: Case = { conditions: always, then: directive };
  const transition = choose({ id, cases: [chosen] });

  return [transition];
}
