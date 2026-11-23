"use client";

import type { EditAction, FormField, Step } from "language-server/protocol";
import { useId, useState } from "react";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/libs/ui/components/field";
import { Input } from "@/libs/ui/components/input";
import { Disclosure } from "@/libs/ui/composites/disclosure";
import { formKindOf, layoutOf, pathOf, summaryOf } from "../form-fields";
import { FailureBox } from "./failure-box";
import { OTHER_METHODS } from "./field-control";
import { blurOnEnter } from "./field-shell";
import { FieldView } from "./field-view";
import {
  type FormSettings,
  FormSettingsContext,
  skippingEmpty,
} from "./form-settings";
import type { Edit, StepFormProps } from "./interfaces";
import { ResultChoice } from "./result-choice";
import { Segmented } from "./segmented";

const METHOD_PATH = "with/method";
const LANGUAGE_PATH = "run/script/language";
const USUAL = "Usual settings";
const EXPRESSIONS = "Expressions";

export function StepForm({
  step,
  form,
  protection,
  revealProblems,
  languageTerms,
  renderData,
  renderCondition,
  renderCode,
  onEdit,
}: StepFormProps) {
  const send = skippingEmpty(onEdit);
  const kind = formKindOf(step.kind, form.fields);
  const layout = layoutOf(form.fields, step);
  const then = form.fields.find((field) => field.key === "then");
  const flowChoices = then?.choices ?? [];
  const pathed = layout.essentials.map((field) => ({
    field,
    path: pathOf(field, step.pointer),
  }));
  const method = pathed.find((each) => each.path === METHOD_PATH)?.field;
  const language = pathed.find((each) => each.path === LANGUAGE_PATH)?.field;
  const scriptLanguage =
    typeof language?.value === "string" ? language.value : "";
  const otherMethods = kind === "http" ? method : undefined;
  const hasMore = otherMethods !== undefined || layout.more.length > 0;
  const moreSummary = summaryOf(layout.more, kind, step.pointer, USUAL);
  const dataSummary = summaryOf(layout.data, kind, step.pointer, EXPRESSIONS);
  const settings: FormSettings = {
    kind,
    base: step.pointer,
    revealProblems,
    languageTerms,
    flowChoices,
    scriptLanguage,
    renderData,
    renderCondition,
    renderCode,
    onEdit: send,
  };

  return (
    <FormSettingsContext value={settings}>
      <div className="flex flex-col gap-4">
        <NameField step={step} onEdit={onEdit} />
        {layout.essentials.map((field) => (
          <FieldView key={field.pointer} field={field} />
        ))}
        {form.result !== null && (
          <ResultChoice step={form.step} result={form.result} />
        )}
        {hasMore && (
          <Disclosure title="More options" summary={moreSummary}>
            {otherMethods !== undefined && (
              <OtherMethods field={otherMethods} />
            )}
            {layout.more.map((field) => (
              <FieldView key={field.pointer} field={field} />
            ))}
          </Disclosure>
        )}
        {layout.data.length > 0 && (
          <Disclosure title="Data in and out" summary={dataSummary}>
            {layout.data.map((field) => (
              <FieldView key={field.pointer} field={field} />
            ))}
          </Disclosure>
        )}
        <FailureBox
          step={step}
          form={form}
          protection={protection}
          fields={layout.failure}
        />
      </div>
    </FormSettingsContext>
  );
}

function OtherMethods({ field }: { readonly field: FormField }) {
  const id = useId();
  const labelId = `${id}-label`;
  const helpId = `${id}-help`;
  const wiring = {
    id,
    labelId,
    describedBy: helpId,
    invalid: false,
    onRefuse: () => undefined,
  };

  return (
    <Field>
      <FieldLabel id={labelId}>
        Other methods
        <span className="font-normal text-muted-foreground">optional</span>
      </FieldLabel>
      <FieldDescription id={helpId}>
        For APIs that ask for them.
      </FieldDescription>
      <Segmented field={field} options={OTHER_METHODS} wiring={wiring} />
    </Field>
  );
}

function NameField({
  step,
  onEdit,
}: {
  readonly step: Step;
  readonly onEdit: Edit;
}) {
  const id = useId();
  const errorId = `${id}-error`;
  const [refusal, setRefusal] = useState<string | null>(null);
  const invalid = refusal !== null;
  const describedBy = invalid ? errorId : undefined;

  function rename(typed: string) {
    const name = typed.trim();

    if (name === "") {
      setRefusal("Give the step a name.");
      return;
    }

    setRefusal(null);

    if (name === step.name) return;

    const action: EditAction = { kind: "renameStep", step: step.id, name };
    onEdit([action]);
  }

  return (
    <Field data-invalid={invalid}>
      <FieldLabel htmlFor={id}>Name</FieldLabel>
      <Input
        key={step.name}
        id={id}
        defaultValue={step.name}
        aria-describedby={describedBy}
        aria-invalid={invalid}
        onBlur={(event) => {
          rename(event.currentTarget.value);
        }}
        onKeyDown={blurOnEnter}
      />
      {invalid && <FieldError id={errorId}>{refusal}</FieldError>}
    </Field>
  );
}
