import type { DataAtResult } from "language-server/protocol";
import type { Ref } from "react";
import type { Json } from "../form-fields";
import type { DataSlot } from "../step-form";

export interface DataPick {
  readonly label: string;
  readonly value: string;
  readonly expression: string;
  readonly export: string | null;
  readonly secret: boolean;
}

export interface DataPickerProps {
  readonly data: DataAtResult | null;
  readonly samples?: ReadonlyMap<string, Json>;
  readonly onlyPaths?: boolean;
  readonly label?: string;
  readonly describedBy?: string;
  readonly open?: boolean;
  readonly onOpenChange?: (open: boolean) => void;
  readonly onPick: (pick: DataPick) => void;
  readonly onWriteExpression?: () => void;
  readonly ref?: Ref<HTMLButtonElement>;
}

export interface DataFieldProps extends DataSlot {
  readonly data: DataAtResult | null;
  readonly samples?: ReadonlyMap<string, Json>;
  readonly onOpenChange?: (open: boolean) => void;
}
