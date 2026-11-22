import type { Step, StepFamily } from "language-server/protocol";

export type StepKind = Step["kind"];

export interface KindWords {
  readonly label: string;
  readonly description: string;
}

export interface KindInfo extends KindWords {
  readonly kind: StepKind;
}

export interface FamilyInfo {
  readonly family: StepFamily;
  readonly label: string;
  readonly kinds: readonly KindInfo[];
}
