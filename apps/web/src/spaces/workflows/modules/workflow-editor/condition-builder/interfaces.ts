import type {
  ConditionReading,
  DataAtResult,
  EditAction,
  FormField,
} from "language-server/protocol";
import type { ReactNode } from "react";

export type Json = FormField["value"];

export interface PickedData {
  readonly value: string;
  readonly expression: string;
  readonly export: string | null;
}

export interface PickerSlot {
  readonly label: string;
  readonly onPick: (pick: PickedData) => void;
}

export interface ConditionBuilderProps {
  readonly pointer: string;
  readonly text: string;
  readonly required: boolean;
  readonly labelledBy: string;
  readonly reading: ConditionReading | null;
  readonly data: DataAtResult | null;
  readonly samples?: ReadonlyMap<string, Json>;
  readonly renderPicker: (slot: PickerSlot) => ReactNode;
  readonly onEdit: (actions: readonly EditAction[]) => void;
}
