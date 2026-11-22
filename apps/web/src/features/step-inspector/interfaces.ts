import type { StepPlace } from "@/operations/workflow-graph";
import type {
  EditAction,
  Step,
  StepFormResult,
} from "language-server/protocol";

export interface StepInspectorProps {
  readonly step: Step;
  readonly form: StepFormResult | null;
  readonly formless: boolean;
  readonly place: StepPlace | null;
  readonly onEdit: (action: EditAction) => void;
  readonly onClose: () => void;
}
