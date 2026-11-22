import type { JsonValue } from "interpreter/front-end";
import { childPointerOf, valueAt } from "../pointers/index.js";
import type {
  ChosenResult,
  ResultMembers,
  ResultReading,
  StepResult,
  WrittenResult,
} from "./interfaces.js";
import type { StepVariant } from "./variants.js";

export const printedJsonAs = "${ fromjson }";

export const inputAndValuesAs = "${ $input + . }";

const printedReturn = "stdout";

const printedResults: readonly ChosenResult[] = [
  "printedJson",
  "printedText",
  "exitCode",
];

const setResults: readonly ChosenResult[] = ["inputAndValues", "valuesOnly"];

const resultChoices: ReadonlyMap<StepVariant, readonly ChosenResult[]> =
  new Map([
    ["script-js", printedResults],
    ["script-python", printedResults],
    ["set", setResults],
  ]);

const resultMembers: Readonly<Record<ChosenResult, ResultMembers>> = {
  printedJson: { as: printedJsonAs, return: null },
  printedText: { as: null, return: null },
  exitCode: { as: null, return: "code" },
  inputAndValues: { as: inputAndValuesAs, return: null },
  valuesOnly: { as: null, return: null },
};

export function resultChoicesOf(
  variant: StepVariant | null,
): readonly ChosenResult[] {
  if (variant === null) {
    return [];
  }

  return resultChoices.get(variant) ?? [];
}

export function resultReadingOf(
  choices: readonly ChosenResult[],
  written: WrittenResult,
): ResultReading | null {
  const isOffered = choices.length > 0;

  if (!isOffered) {
    return null;
  }

  const chosen = choices.find((choice) => isWrittenAs(written, choice));
  const value: StepResult = chosen ?? "written";

  return { value, choices };
}

export function resultMembersOf(result: ChosenResult): ResultMembers {
  return resultMembers[result];
}

export function isChosenResult(value: unknown): value is ChosenResult {
  return typeof value === "string" && Object.hasOwn(resultMembers, value);
}

export function isReturnedAs(
  written: unknown,
  returned: string | null,
): boolean {
  if (returned !== null) {
    return written === returned;
  }

  return written === undefined || written === printedReturn;
}

export function writtenResultOf(
  pointer: string,
  document: JsonValue,
): WrittenResult {
  const asPointer = outputAsPointerOf(pointer);
  const returnPointer = returnPointerOf(pointer);
  const as = valueAt(document, asPointer);
  const returned = valueAt(document, returnPointer);

  return { as, return: returned };
}

export function outputAsPointerOf(pointer: string): string {
  const output = childPointerOf(pointer, "output");

  return childPointerOf(output, "as");
}

export function returnPointerOf(pointer: string): string {
  const run = childPointerOf(pointer, "run");

  return childPointerOf(run, "return");
}

function isWrittenAs(written: WrittenResult, result: ChosenResult): boolean {
  const members = resultMembersOf(result);
  const isAs = isOutputAs(written.as, members.as);
  const isReturned = isReturnedAs(written.return, members.return);

  return isAs && isReturned;
}

function isOutputAs(written: unknown, as: string | null): boolean {
  if (as !== null) {
    return written === as;
  }

  return written === undefined;
}
