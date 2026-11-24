import type * as ast from "../../syntax/index.js";
import {
  type ExceptWhenTest,
  type WhenTest,
  exceptWhenTest,
  whenTest,
} from "../forms/index.js";
import type { Context } from "./context.js";
import { conditionsOf } from "./expressions.js";

export function errorTestsOf(
  when: ast.Expression | null,
  exceptWhen: ast.Expression | null,
  context: Context,
): readonly (WhenTest | ExceptWhenTest)[] {
  const holding = conditionsOf(when, context);
  const excepting = conditionsOf(exceptWhen, context);
  const whens = holding.map((condition) => whenTest({ condition }));
  const exceptions = excepting.map((condition) =>
    exceptWhenTest({ condition }),
  );

  return [...whens, ...exceptions];
}
