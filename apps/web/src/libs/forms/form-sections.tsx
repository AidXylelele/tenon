"use client";

import type { FormField, FormSection } from "language-server/protocol";
import { FieldLegend, FieldSet } from "@/libs/ui/components/field";
import { FieldControl } from "./field-control";
import type { FormSectionsProps } from "./interfaces";

const SECTIONS: readonly {
  readonly section: FormSection;
  readonly title: string;
}[] = [
  { section: "settings", title: "Settings" },
  { section: "data", title: "Data" },
  { section: "note", title: "Note" },
];

export function FormSections({ fields, onEdit }: FormSectionsProps) {
  return SECTIONS.map((each) => {
    const shown = fieldsIn(fields, each.section);

    if (shown.length === 0) return null;

    return (
      <FieldSet key={each.section} className="gap-4">
        <FieldLegend>{each.title}</FieldLegend>
        {shown.map((field) => (
          <FieldControl key={field.pointer} field={field} onEdit={onEdit} />
        ))}
      </FieldSet>
    );
  });
}

export function fieldsIn(
  fields: readonly FormField[],
  section: FormSection,
): FormField[] {
  return fields.filter((field) => field.section === section);
}
