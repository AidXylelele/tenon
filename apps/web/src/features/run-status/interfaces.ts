import type { Phase } from "@/libs/data-access/types";

export interface PhaseCountsProps {
  readonly id: string;
  readonly title: string;
  readonly counts: Readonly<Record<Phase, number>>;
  readonly hrefOf: (phase: Phase) => string;
}
