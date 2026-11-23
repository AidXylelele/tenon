import type { DataShape } from "language-server/protocol";

export type { Json } from "../../form-fields";

export type ChoiceKind = "data" | "time" | "secret";

export interface DataChoice {
  readonly id: string;
  readonly label: string;
  readonly value: string;
  readonly expression: string;
  readonly export: string | null;
  readonly kind: ChoiceKind;
  readonly shape: string;
  readonly isPath: boolean;
}

export interface ChoiceGroup {
  readonly id: string;
  readonly title: string;
  readonly choices: readonly DataChoice[];
  readonly note: string | null;
}

export interface DataChoices {
  readonly groups: readonly ChoiceGroup[];
  readonly count: number;
  readonly notes: readonly string[];
}

export interface SampleMember {
  readonly name: string;
  readonly expression: string;
  readonly value: string;
  readonly shape: DataShape;
  readonly size: number | null;
  readonly members: readonly SampleMember[];
}
