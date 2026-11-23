import type {
  DataAtResult,
  TemplatePart,
  TemplateReading,
} from "language-server/protocol";
import type { Ref } from "react";
import type { DataSlot, DataUse } from "../step-form";

export interface DataPick {
  readonly label: string;
  readonly value: string;
  readonly expression: string;
  readonly export: string | null;
  readonly secret: boolean;
}

export interface DataPickerProps {
  readonly data: DataAtResult | null;
  readonly onlyPaths?: boolean;
  readonly label?: string;
  readonly describedBy?: string;
  readonly open?: boolean;
  readonly onOpenChange?: (open: boolean) => void;
  readonly onSearch?: (typed: string) => void;
  readonly onPick: (pick: DataPick) => void;
  readonly onWriteExpression?: () => void;
  readonly ref?: Ref<HTMLButtonElement>;
}

export interface DataFieldProps extends DataSlot {
  readonly data: DataAtResult | null;
  readonly template?: TemplateReading | null;
  readonly onOpenChange?: (open: boolean) => void;
  readonly onSearch?: (typed: string) => void;
}

export interface TemplateFieldProps {
  readonly parts: readonly TemplatePart[];
  readonly data: DataAtResult | null;
  readonly inputId: string;
  readonly labelId: string;
  readonly describedBy: string | undefined;
  readonly invalid: boolean;
  readonly onTemplate: (
    parts: readonly TemplatePart[],
    use: DataUse | null,
  ) => void;
  readonly onSearch?: (typed: string) => void;
}
