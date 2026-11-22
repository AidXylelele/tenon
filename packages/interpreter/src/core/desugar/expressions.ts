import { InterpreterError } from "../../runtime/index.js";
import {
  type Binding,
  type ExpressionResolution,
  readsAsExpression,
} from "../../semantics/index.js";
import type * as ast from "../../syntax/index.js";
import {
  type Argument,
  type Expression,
  type Literal,
  expression,
  literal,
} from "../forms/index.js";
import { accessOf } from "../storage/index.js";
import type { Context } from "./context.js";

interface ResolvedSite {
  readonly id: string;
  readonly resolution: ExpressionResolution;
}

const noConditions: readonly Expression[] = [];

export function expressionOf(
  written: ast.Expression,
  context: Context,
): Expression | Literal {
  const site = resolvedSiteOf(written, context);
  const isExpression = readsAsExpression(site.resolution, context.expressions);

  if (!isExpression) {
    return literal({ value: written.source });
  }

  return addressedOf(written, site, context);
}

export function conditionsOf(
  written: ast.Expression | null,
  context: Context,
): readonly Expression[] {
  if (written === null) {
    return noConditions;
  }

  const condition = addressedExpressionOf(written, context);
  return [condition];
}

export function addressedExpressionOf(
  written: ast.Expression,
  context: Context,
): Expression {
  const site = resolvedSiteOf(written, context);
  return addressedOf(written, site, context);
}

function resolvedSiteOf(
  written: ast.Expression,
  context: Context,
): ResolvedSite {
  const id = context.siteOf(written.pointer);
  const resolution = context.model.resolutions.get(id);

  if (resolution === undefined) {
    throw new InterpreterError(`The expression '${id}' has no resolution.`);
  }

  return { id, resolution };
}

function addressedOf(
  written: ast.Expression,
  site: ResolvedSite,
  context: Context,
): Expression {
  const bindings = [...site.resolution.bindings];
  const accessed = bindings.map(([name, binding]) =>
    argumentOf(name, binding, context),
  );

  return expression({
    id: site.id,
    source: written.source,
    mode: written.mode,
    arguments: accessed,
  });
}

function argumentOf(
  name: string,
  binding: Binding,
  context: Context,
): Argument {
  const access = accessOf(binding, context);
  return { name, access };
}
