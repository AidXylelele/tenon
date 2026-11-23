import type {
  EditAction,
  FormField,
  Step,
  StepFormResult,
  WorkflowFormResult,
} from "language-server/protocol";
import type { ReactNode } from "react";
import type { Json } from "../form-fields";

export type Edit = (actions: readonly EditAction[]) => void;

export interface DataUse {
  readonly value: string;
  readonly export: string | null;
}

export interface DataSlot {
  readonly pointer: string;
  readonly value: Json;
  readonly inputId: string;
  readonly labelId: string;
  readonly describedBy: string | undefined;
  readonly invalid: boolean;
  readonly placeholder: string;
  readonly onText: (text: string) => void;
  readonly onUse: (use: DataUse) => void;
  readonly onClear: () => void;
}

export interface ConditionSlot {
  readonly pointer: string;
  readonly text: string;
  readonly required: boolean;
  readonly labelledBy: string;
  readonly describedBy: string | undefined;
  readonly invalid: boolean;
}

export interface CodeSlot {
  readonly field: FormField;
  readonly language: string;
  readonly labelledBy: string;
  readonly describedBy: string | undefined;
}

export interface FormSlots {
  readonly renderData?: (slot: DataSlot) => ReactNode;
  readonly renderCondition?: (slot: ConditionSlot) => ReactNode;
  readonly renderCode?: (slot: CodeSlot) => ReactNode;
}

export interface StepFormProps extends FormSlots {
  readonly step: Step;
  readonly form: StepFormResult;
  readonly protection: StepFormResult | null;
  readonly revealProblems: boolean;
  readonly languageTerms: boolean;
  readonly onEdit: Edit;
}

export interface Webhook {
  readonly name: string;
  readonly eventType: string;
  readonly address: string;
}

export interface StartFormProps {
  readonly form: WorkflowFormResult;
  readonly webhooks: readonly Webhook[];
  readonly now: string;
  readonly zone: string;
  readonly revealProblems: boolean;
  readonly languageTerms: boolean;
  readonly onEdit: Edit;
}
