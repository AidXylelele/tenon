import type { HostProfile } from "interpreter/front-end";
import {
  ErrorCodes,
  ResponseError,
  TextDocumentIdentifier,
  VersionedTextDocumentIdentifier,
} from "vscode-languageserver/browser";
import { type Comparison, secondValues } from "../ide/conditions/index.js";
import { timeExpressions } from "../ide/jq-text/index.js";
import { isChosenResult, stepVariants } from "../ide/variants/index.js";
import type {
  DataAtParams,
  DidFetchImportsParams,
  EditParams,
  FromJsonParams,
  InitializationOptions,
  NewDocumentParams,
  RangesOfParams,
  ReadConditionParams,
  StepFormParams,
} from "../protocol/index.js";
import type { ActionKind } from "./interfaces.js";

const profileShapes: Record<keyof HostProfile, (member: unknown) => boolean> = {
  effects: isStringList,
  authentications: isStringList,
  processes: isStringList,
  scriptLanguages: isStringList,
  asyncApiProtocols: isStringList,
  mcpTransports: isStringList,
  mcpTransportOptions: isOptionalStringList,
  schedules: isStringList,
  triggers: isTriggers,
  grants: isStringList,
  secrets: isStringList,
};

const draftMembers: readonly string[] = ["namespace", "name"];

const variantsOfStep: ReadonlySet<unknown> = new Set(stepVariants);

const plainFailureKinds: ReadonlySet<string> = new Set([
  "stop",
  "continue",
  "handle",
]);

const actionShapes: Record<ActionKind, (action: unknown) => boolean> = {
  insertStep: holdsInsertion,
  insertStepOnBranch: holdsBranchInsertion,
  moveStep: holdsMove,
  removeStep: (action) => holdsStrings(action, ["step"]),
  renameStep: (action) => holdsStrings(action, ["step", "name"]),
  duplicateStep: (action) => holdsStrings(action, ["step"]),
  setField: holdsSetting,
  setCondition: holdsConditionSetting,
  clearField: (action) => holdsStrings(action, ["pointer"]),
  setFailure: holdsFailureSetting,
  setResult: holdsResultSetting,
  useData: holdsDataUse,
  wrapSteps: holdsWrapping,
};

export function invalidParamsOf(method: string): ResponseError {
  const message = `The params of ${method} are not of its shape.`;

  return new ResponseError(ErrorCodes.InvalidParams, message);
}

export function holdsInitializationOptions(
  options: unknown,
): options is InitializationOptions {
  const profile = memberOf(options, "profile");
  const draft = memberOf(options, "draft");
  const shapes = Object.entries(profileShapes);
  const isProfile = shapes.every(([name, holds]) => {
    const member = memberOf(profile, name);
    return holds(member);
  });
  const isDraft = draft === undefined || holdsStrings(draft, draftMembers);

  return isProfile && isDraft;
}

export function holdsVersionedDocument(
  params: unknown,
): params is { readonly textDocument: VersionedTextDocumentIdentifier } {
  const textDocument = memberOf(params, "textDocument");

  return VersionedTextDocumentIdentifier.is(textDocument);
}

export function holdsFromJsonParams(params: unknown): params is FromJsonParams {
  const document = memberOf(params, "document");

  return document !== undefined;
}

export function holdsNewDocumentParams(
  params: unknown,
): params is NewDocumentParams {
  return holdsStrings(params, ["namespace", "name", "version"]);
}

export function holdsRangesOfParams(params: unknown): params is RangesOfParams {
  const pointers = memberOf(params, "pointers");
  const isList = Array.isArray(pointers);

  return (
    holdsVersionedDocument(params) &&
    isList &&
    pointers.every((pointer) => typeof pointer === "string")
  );
}

export function holdsFetchedImports(
  params: unknown,
): params is DidFetchImportsParams {
  const textDocument = memberOf(params, "textDocument");
  const texts = memberOf(params, "texts");
  const failures = memberOf(params, "failures");
  const holdsTexts = holdsTextsByReference(texts);
  const holdsFailures =
    failures === undefined || holdsTextsByReference(failures);

  return TextDocumentIdentifier.is(textDocument) && holdsTexts && holdsFailures;
}

function isRecord(value: unknown): boolean {
  const isObject = typeof value === "object" && value !== null;

  return isObject && !Array.isArray(value);
}

function holdsTextsByReference(value: unknown): boolean {
  const isObject = typeof value === "object" && value !== null;

  return (
    isObject && Object.values(value).every((text) => typeof text === "string")
  );
}

export function holdsStepFormParams(params: unknown): params is StepFormParams {
  return holdsVersionedDocument(params) && holdsStrings(params, ["step"]);
}

export function holdsDataAtParams(params: unknown): params is DataAtParams {
  const samples = memberOf(params, "samples");
  const typed = memberOf(params, "typed");
  const holdsSamples = samples === undefined || isRecord(samples);
  const holdsTyped = typed === undefined || typeof typed === "string";

  return (
    holdsVersionedDocument(params) &&
    holdsStrings(params, ["step", "field"]) &&
    holdsSamples &&
    holdsTyped
  );
}

export function holdsReadConditionParams(
  params: unknown,
): params is ReadConditionParams {
  return holdsStrings(params, ["text"]);
}

export function holdsEditParams(params: unknown): params is EditParams {
  const action = memberOf(params, "action");
  const kind = memberOf(action, "kind");
  const isKnown = isActionKind(kind);
  const isAction = isKnown && actionShapes[kind](action);

  return holdsVersionedDocument(params) && isAction;
}

function holdsInsertion(action: unknown): boolean {
  return (
    holdsStrings(action, ["list"]) && holdsIndex(action) && holdsNewStep(action)
  );
}

function holdsBranchInsertion(action: unknown): boolean {
  return holdsStrings(action, ["switch", "case"]) && holdsNewStep(action);
}

function holdsNewStep(action: unknown): boolean {
  const name = memberOf(action, "name");
  const step = memberOf(action, "step");
  const isNamed = name === null || typeof name === "string";

  return variantsOfStep.has(step) && isNamed;
}

function holdsMove(action: unknown): boolean {
  return holdsStrings(action, ["step", "list"]) && holdsIndex(action);
}

function holdsSetting(action: unknown): boolean {
  const value = memberOf(action, "value");

  return holdsStrings(action, ["pointer"]) && value !== undefined;
}

function holdsFailureSetting(action: unknown): boolean {
  const failure = memberOf(action, "failure");
  const kind = memberOf(failure, "kind");
  const isRetry = kind === "retry";
  const isChoice = typeof kind === "string" && plainFailureKinds.has(kind);

  if (isRetry) {
    return holdsStrings(action, ["step"]) && holdsRetry(failure);
  }

  return holdsStrings(action, ["step"]) && isChoice;
}

function holdsConditionSetting(action: unknown): boolean {
  const condition = memberOf(action, "condition");
  const join = memberOf(condition, "join");
  const rows = memberOf(condition, "rows");
  const isJoin = join === "all" || join === "any";
  const isList = Array.isArray(rows);
  const isConditional = isJoin && isList && rows.every(holdsRow);

  return holdsStrings(action, ["pointer"]) && isConditional;
}

function holdsRow(row: unknown): boolean {
  const comparison = memberOf(row, "comparison");
  const right = memberOf(row, "right");
  const isLeft = holdsStrings(row, ["left"]);

  if (!isComparison(comparison) || !isLeft) {
    return false;
  }

  switch (secondValues[comparison]) {
    case "none":
      return right === null;
    case "value":
      return holdsValueOperand(right);
    case "operand":
      return holdsOperand(right);
  }
}

function holdsOperand(operand: unknown): boolean {
  const kind = memberOf(operand, "kind");
  const time = memberOf(operand, "time");
  const isTime =
    typeof time === "string" && Object.hasOwn(timeExpressions, time);

  if (kind === "data") {
    return holdsStrings(operand, ["path"]);
  }

  if (kind === "time") {
    return isTime;
  }

  return holdsValueOperand(operand);
}

function isComparison(value: unknown): value is Comparison {
  return typeof value === "string" && Object.hasOwn(secondValues, value);
}

function holdsValueOperand(operand: unknown): boolean {
  const kind = memberOf(operand, "kind");
  const value = memberOf(operand, "value");
  const isLiteral =
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean" ||
    Number.isFinite(value);

  return kind === "value" && isLiteral;
}

function holdsWrapping(action: unknown): boolean {
  const steps = memberOf(action, "steps");
  const block = memberOf(action, "block");
  const name = memberOf(action, "name");
  const isNamed = name === null || typeof name === "string";
  const isBlock = block === "try" || block === "for" || block === "do";
  const isList = Array.isArray(steps);
  const areSteps = isList && steps.every((step) => typeof step === "string");

  return areSteps && isBlock && isNamed;
}

function holdsDataUse(action: unknown): boolean {
  const exported = memberOf(action, "export");
  const isExport = exported === null || typeof exported === "string";

  return holdsStrings(action, ["pointer", "value"]) && isExport;
}

function holdsResultSetting(action: unknown): boolean {
  const result = memberOf(action, "result");

  return holdsStrings(action, ["step"]) && isChosenResult(result);
}

function holdsRetry(failure: unknown): boolean {
  const retries = memberOf(failure, "retries");
  const seconds = memberOf(failure, "seconds");
  const growing = memberOf(failure, "growing");

  return (
    Number.isInteger(retries) &&
    typeof seconds === "number" &&
    typeof growing === "boolean"
  );
}

function holdsIndex(action: unknown): boolean {
  const index = memberOf(action, "index");

  return Number.isInteger(index);
}

function isActionKind(kind: unknown): kind is ActionKind {
  return typeof kind === "string" && Object.hasOwn(actionShapes, kind);
}

function isStringList(member: unknown): boolean {
  const isList = Array.isArray(member);

  if (!isList) {
    return false;
  }

  return member.every((item) => typeof item === "string");
}

function isOptionalStringList(member: unknown): boolean {
  return member === undefined || isStringList(member);
}

function isTriggers(member: unknown): boolean {
  return member === undefined || member === "one" || member === "many";
}

function holdsStrings(value: unknown, names: readonly string[]): boolean {
  return names.every((name) => {
    const member = memberOf(value, name);
    return typeof member === "string";
  });
}

function memberOf(value: unknown, name: string): unknown {
  const isObject = typeof value === "object" && value !== null;

  if (!isObject) {
    return undefined;
  }

  return Reflect.get(value, name);
}
