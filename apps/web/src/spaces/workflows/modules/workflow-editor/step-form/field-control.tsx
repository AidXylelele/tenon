"use client";

import { PlusIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/libs/ui/components/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/libs/ui/components/select";
import {
  clearEditsOf,
  CONTINUE,
  dataUseOf,
  flowChoicesOf,
  textEditsOf,
  valueEditsOf,
} from "../form-fields";
import { useFormSettings } from "./form-settings";
import type { CodeSlot, ConditionSlot, DataSlot, DataUse } from "./interfaces";
import { Segmented } from "./segmented";
import {
  BooleanControl,
  ChoiceControl,
  type ControlProps,
  DurationControl,
  JsonControl,
  NumberControl,
  TextControl,
} from "./value-controls";

const HTTP_METHODS = [
  { value: "get", text: "Get data" },
  { value: "post", text: "Send data" },
];

export const OTHER_METHODS = [
  { value: "put", text: "PUT" },
  { value: "patch", text: "PATCH" },
  { value: "delete", text: "DELETE" },
];

const LANGUAGES = [
  { value: "js", text: "JavaScript" },
  { value: "python", text: "Python" },
];

export function FieldControl(props: ControlProps) {
  const { field, words, wiring } = props;

  switch (words.control) {
    case "data":
      return <DataControl {...props} />;
    case "condition":
      return <ConditionControl {...props} />;
    case "flow":
      return <FlowControl {...props} />;
    case "code":
      return <CodeControl {...props} />;
    case "httpMethod":
      return <Segmented field={field} options={HTTP_METHODS} wiring={wiring} />;
    case "language":
      return <Segmented field={field} options={LANGUAGES} wiring={wiring} />;
    case "value":
    case "values":
    case "cases":
    case "hidden":
      return <ValueControl {...props} />;
  }
}

function ValueControl(props: ControlProps) {
  switch (props.field.input) {
    case "text":
      return <TextControl {...props} />;
    case "number":
      return <NumberControl {...props} />;
    case "boolean":
      return <BooleanControl {...props} />;
    case "choice":
      return <ChoiceControl {...props} />;
    case "duration":
      return <DurationControl {...props} />;
    case "group":
    case "oneOf":
    case "structured":
      return <JsonControl {...props} />;
  }
}

function DataControl(props: ControlProps) {
  const { field, words, wiring } = props;
  const { renderData, onEdit } = useFormSettings();
  const holdsObject = typeof field.value === "object" && field.value !== null;

  if (holdsObject) return <JsonControl {...props} />;

  if (renderData === undefined) return <TextControl {...props} />;

  const slot: DataSlot = {
    pointer: field.pointer,
    value: field.value,
    inputId: wiring.id,
    describedBy: wiring.describedBy,
    invalid: wiring.invalid,
    placeholder: words.placeholder,
    onText: (text: string) => {
      const edits = textEditsOf(field, text);
      onEdit(edits);
    },
    onUse: (use: DataUse) => {
      const edits = dataUseOf(field.pointer, use.value, use.export);
      onEdit(edits);
    },
    onClear: () => {
      const edits = textEditsOf(field, "");
      onEdit(edits);
    },
  };

  return renderData(slot);
}

function ConditionControl(props: ControlProps) {
  const { field, wiring } = props;
  const { renderCondition } = useFormSettings();
  const [adding, setAdding] = useState(false);
  const text = typeof field.value === "string" ? field.value : "";
  const shown = field.written || adding;

  if (renderCondition === undefined) return <TextControl {...props} />;

  if (!shown)
    return (
      <Button
        type="button"
        variant="link"
        size="sm"
        className="self-start px-0"
        aria-describedby={wiring.describedBy}
        onClick={() => {
          setAdding(true);
        }}
      >
        <PlusIcon data-icon="inline-start" />
        Add a condition
      </Button>
    );

  const slot: ConditionSlot = {
    pointer: field.pointer,
    text,
    required: field.required,
    labelledBy: wiring.labelId,
    describedBy: wiring.describedBy,
    invalid: wiring.invalid,
  };

  return renderCondition(slot);
}

function FlowControl({ field, wiring }: ControlProps) {
  const { flowChoices, onEdit } = useFormSettings();
  const choices = flowChoicesOf(flowChoices);
  const value = typeof field.value === "string" ? field.value : CONTINUE;

  function choose(chosen: string) {
    const isUsual = chosen === CONTINUE;
    const edits = isUsual ? clearEditsOf(field) : valueEditsOf(field, chosen);

    onEdit(edits);
  }

  return (
    <Select value={value} onValueChange={choose}>
      <SelectTrigger
        id={wiring.id}
        className="w-full"
        aria-describedby={wiring.describedBy}
        aria-invalid={wiring.invalid}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {choices.map((choice) => (
          <SelectItem key={choice.value} value={choice.value}>
            {choice.text}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function CodeControl(props: ControlProps) {
  const { field, wiring } = props;
  const { renderCode, scriptLanguage } = useFormSettings();

  if (renderCode === undefined) return <TextControl {...props} multiline />;

  const slot: CodeSlot = {
    field,
    language: scriptLanguage,
    labelledBy: wiring.labelId,
    describedBy: wiring.describedBy,
  };

  return renderCode(slot);
}
