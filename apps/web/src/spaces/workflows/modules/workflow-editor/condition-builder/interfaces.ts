import type {
  ConditionReading,
  DataAtResult,
  EditAction,
} from "language-server/protocol";
import type { ReactNode } from "react";
import type { ConditionSlot } from "../step-form";

export interface PickedData {
  readonly value: string;
  readonly expression: string;
  readonly export: string | null;
}

export interface PickerSlot {
  readonly label: string;
  readonly describedBy: string;
  readonly onPick: (pick: PickedData) => void;
}

export interface ConditionBuilderProps extends ConditionSlot {
  readonly reading: ConditionReading | null;
  readonly data: DataAtResult | null;
  readonly renderPicker: (slot: PickerSlot) => ReactNode;
  readonly onEdit: (actions: readonly EditAction[]) => void;
}
