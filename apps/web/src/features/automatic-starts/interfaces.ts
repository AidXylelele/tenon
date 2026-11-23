import type { Outcome } from "@/libs/data-access/problem";

export interface AutomaticStartsProps {
  readonly workflow: string;
  readonly on: boolean;
  readonly disabled?: boolean;
  readonly labelled?: boolean;
  readonly turn: (on: boolean) => Promise<Outcome<void>>;
}
