export type ChosenResult =
  "printedJson" | "printedText" | "exitCode" | "inputAndValues" | "valuesOnly";

export type StepResult = ChosenResult | "written";

export interface ResultReading {
  readonly value: StepResult;
  readonly choices: readonly ChosenResult[];
}

export interface ResultMembers {
  readonly as: string | null;
  readonly return: string | null;
}

export interface WrittenResult {
  readonly as: unknown;
  readonly return: unknown;
}
