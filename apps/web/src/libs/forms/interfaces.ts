import type { EditAction, FormField } from "language-server/protocol";

export type FieldValue = FormField["value"];

export interface FieldProps {
  readonly field: FormField;
  readonly onEdit: (action: EditAction) => void;
}
