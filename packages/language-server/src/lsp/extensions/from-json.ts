import { RequestType, type ResponseError } from "vscode-languageserver/browser";
import { yamlOf } from "../../ide/yaml-text/index.js";
import {
  type FromJsonParams,
  type FromJsonResult,
  methods,
} from "../../protocol/index.js";
import { holdsFromJsonParams, invalidParamsOf } from "../shapes.js";

export const fromJsonRequest = new RequestType<
  FromJsonParams,
  FromJsonResult,
  void
>(methods.fromJson);

export function fromJsonAnswerOf(
  params: unknown,
): FromJsonResult | ResponseError {
  const isValid = holdsFromJsonParams(params);

  if (!isValid) {
    return invalidParamsOf(methods.fromJson);
  }

  const text = yamlOf(params.document);
  return { text };
}
