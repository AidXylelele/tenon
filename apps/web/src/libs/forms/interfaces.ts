import type { EditAction, FormField } from "language-server/protocol";

export type FieldValue = FormField["value"];

export interface FormSectionsProps {
  readonly fields: readonly FormField[];
  readonly onEdit: (action: EditAction) => void;
}

export interface FieldProps {
  readonly field: FormField;
  readonly onEdit: (action: EditAction) => void;
}
