import type { DataAtResult, FormField } from "language-server/protocol";
import type { Ref } from "react";

export type Json = FormField["value"];

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
  readonly open?: boolean;
  readonly onOpenChange?: (open: boolean) => void;
  readonly onPick: (pick: DataPick) => void;
  readonly onWriteExpression?: () => void;
  readonly ref?: Ref<HTMLButtonElement>;
}

export interface DataUse {
  readonly value: string;
  readonly export: string | null;
}

export interface DataFieldProps {
  readonly pointer: string;
  readonly value: Json;
  readonly inputId: string;
  readonly describedBy: string | undefined;
  readonly invalid: boolean;
  readonly placeholder: string;
  readonly onText: (text: string) => void;
  readonly onUse: (use: DataUse) => void;
  readonly onClear: () => void;
  readonly data: DataAtResult | null;
  readonly samples?: ReadonlyMap<string, Json>;
  readonly onOpenChange?: (open: boolean) => void;
}
