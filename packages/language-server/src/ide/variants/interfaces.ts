import type { ast, JsonValue } from "interpreter/front-end";

export type ChosenResult =
  "printedJson" | "printedText" | "exitCode" | "inputAndValues" | "valuesOnly";

export type StepResult = ChosenResult | "written";

export interface ResultReading {
  readonly value: StepResult;
  readonly choices: readonly ChosenResult[];
}

export type ReturnMode = ast.RunTask["return"];

export interface ResultMembers {
  readonly as: string | null;
  readonly return: ReturnMode | null;
}

export interface WrittenResult {
  readonly as: JsonValue | undefined;
  readonly return: ReturnMode | null;
}
