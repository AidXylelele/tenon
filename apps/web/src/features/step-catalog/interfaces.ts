import type { StepVariant } from "language-server/protocol";
import type { EntryAction } from "@/operations/step-catalog";

export interface StepCatalogProps {
  readonly variants: readonly StepVariant[];
  readonly stepAbove: string | null;
  readonly languageTerms: boolean;
  readonly onChoose: (action: EntryAction) => void;
}
