"use client";

import type { FormField } from "language-server/protocol";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/libs/ui/components/toggle-group";
import {
  fieldAt,
  type FieldState,
  type FieldWords,
  isObject,
  SEND_AS_CHOICES,
  sendAsEditsOf,
  sendAsOf,
} from "../form-fields";
import { DataControl } from "./field-control";
import { FieldShell } from "./field-shell";
import { useFormSettings } from "./form-settings";
import { ValueRows } from "./value-rows";

interface BodyFieldProps {
  readonly field: FormField;
  readonly words: FieldWords;
  readonly path: string;
}

const HEADERS = "headers";

const TEXT = "text";

export function BodyField({ field, words, path }: BodyFieldProps) {
  const { fields, onEdit } = useFormSettings();
  const end = field.pointer.lastIndexOf("/");
  const headersPointer = `${field.pointer.slice(0, end)}/${HEADERS}`;
  const written = fieldAt(fields, headersPointer);
  const headers: FieldState = written ?? {
    pointer: headersPointer,
    required: false,
    written: false,
    value: null,
  };
  const sendAs = sendAsOf(field, headers);
  const text = messageTextOf(field);
  const message: FormField = {
    ...field,
    pointer: `${field.pointer}/${TEXT}`,
    input: "text",
    required: true,
    written: field.written,
    value: text,
  };
  const messageWords: FieldWords = { ...words, control: "data" };
  const formWords: FieldWords = { ...words, title: "Form fields", help: null };

  function choose(chosen: string) {
    const picked = SEND_AS_CHOICES.find((each) => each.sendAs === chosen);

    if (picked === undefined) return;

    const edits = sendAsEditsOf(field, headers, picked.sendAs);
    onEdit(edits);
  }

  return (
    <div className="flex flex-col gap-3">
      <FieldShell field={field} words={words} path={path} labelsControl={false}>
        {(wiring) => (
          <>
            <div>
              <ToggleGroup
                type="single"
                value={sendAs}
                aria-label="Send as"
                onValueChange={choose}
              >
                {SEND_AS_CHOICES.map((each) => (
                  <ToggleGroupItem key={each.sendAs} value={each.sendAs}>
                    {each.text}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </div>
            {sendAs === "message" && (
              <DataControl
                field={message}
                words={messageWords}
                wiring={wiring}
              />
            )}
            {sendAs === "json" && (
              <DataControl field={field} words={words} wiring={wiring} />
            )}
          </>
        )}
      </FieldShell>
      {sendAs === "form" && (
        <ValueRows field={field} words={formWords} path={path} />
      )}
    </div>
  );
}

function messageTextOf(field: FormField): string {
  const text = isObject(field.value) ? field.value[TEXT] : null;

  return typeof text === "string" ? text : "";
}
