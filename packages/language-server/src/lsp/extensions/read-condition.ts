import { RequestType, type ResponseError } from "vscode-languageserver/browser";
import { conditionOf } from "../../ide/conditions/index.js";
import {
  methods,
  type ReadConditionParams,
  type ReadConditionResult,
} from "../../protocol/index.js";
import { holdsReadConditionParams, invalidParamsOf } from "../shapes.js";

export const readConditionRequest = new RequestType<
  ReadConditionParams,
  ReadConditionResult,
  void
>(methods.readCondition);

export function readConditionAnswerOf(
  params: unknown,
): ReadConditionResult | ResponseError {
  const isValid = holdsReadConditionParams(params);

  if (!isValid) {
    return invalidParamsOf(methods.readCondition);
  }

  return conditionOf(params.text);
}
