"use client";

import type { FormField } from "language-server/protocol";
import {
  FieldDescription,
  FieldLegend,
  FieldSet,
} from "@/libs/ui/components/field";
import { type FieldWords, pathOf, wordsOf } from "@/operations/form-fields";
import { FieldControl } from "./field-control";
import { FieldShell, FieldTitle } from "./field-shell";
import { useFormSettings } from "./form-settings";
import { SwitchCases } from "./switch-cases";
import { ValueRows } from "./value-rows";

const UNLABELLED_CONTROLS: ReadonlySet<FieldWords["control"]> = new Set([
  "condition",
  "httpMethod",
  "language",
  "code",
]);

export function FieldView({ field }: { readonly field: FormField }) {
  const settings = useFormSettings();
  const path = pathOf(field, settings.base);
  const words = wordsOf(settings.kind, path, field);
  const labelsControl = !UNLABELLED_CONTROLS.has(words.control);

  if (words.control === "hidden") return null;

  if (words.control === "cases")
    return <SwitchCases field={field} words={words} />;

  if (words.control === "values")
    return <ValueRows field={field} words={words} path={path} />;

  if (field.input === "group")
    return <FieldGroup field={field} words={words} path={path} />;

  return (
    <FieldShell
      field={field}
      words={words}
      path={path}
      labelsControl={labelsControl}
    >
      {(wiring) => <FieldControl field={field} words={words} wiring={wiring} />}
    </FieldShell>
  );
}

function FieldGroup({
  field,
  words,
  path,
}: {
  readonly field: FormField;
  readonly words: FieldWords;
  readonly path: string;
}) {
  return (
    <FieldSet className="gap-4">
      <FieldLegend variant="label" className="mb-0">
        <FieldTitle field={field} words={words} path={path} />
      </FieldLegend>
      {words.help !== null && <FieldDescription>{words.help}</FieldDescription>}
      {field.fields.map((inner) => (
        <FieldView key={inner.pointer} field={inner} />
      ))}
    </FieldSet>
  );
}
