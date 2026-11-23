"use client";

import type {
  ConditionReading,
  DataAtResult,
  TemplateReading,
} from "language-server/protocol";
import dynamic from "next/dynamic";
import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import type { JsonValue } from "@/libs/json/json";
import type { WorkflowSession } from "@/operations/workflow-language";
import { ConditionBuilder, type PickerSlot } from "./condition-builder";
import { DataField, DataPicker } from "./data-picker";
import { textEditsOf } from "./form-fields";
import type { CodeSlot, ConditionSlot, DataSlot, Edit } from "./step-form";

const ScriptField = dynamic(
  () => import("./script-field").then((parts) => parts.ScriptField),
  {
    ssr: false,
    loading: () => (
      <p className="text-caption text-muted-foreground">
        Opening the code editor…
      </p>
    ),
  },
);

const COMMIT_PAUSE_MS = 600;

const NOTHING_TYPED = "";

export interface SlotSources {
  readonly session: WorkflowSession;
  readonly step: string;
  readonly samples: Readonly<Record<string, JsonValue>>;
  readonly wide: boolean;
  readonly onWide: (wide: boolean) => void;
  readonly onEdit: Edit;
}

interface Slotted<Slot> {
  readonly slot: Slot;
  readonly sources: SlotSources;
}

export function useFormSlots(sources: SlotSources) {
  return useMemo(
    () => ({
      renderData: (slot: DataSlot) => (
        <DataSlotField key={slot.pointer} slot={slot} sources={sources} />
      ),
      renderCondition: (slot: ConditionSlot) => (
        <ConditionSlotField key={slot.pointer} slot={slot} sources={sources} />
      ),
      renderCode: (slot: CodeSlot) => (
        <CodeSlotField key={slot.field.pointer} slot={slot} sources={sources} />
      ),
    }),
    [sources],
  );
}

function useDataAt(
  sources: SlotSources,
  field: string,
  typed: string,
  value: unknown,
): DataAtResult | null {
  const [data, setData] = useState<DataAtResult | null>(null);
  const { session, step, samples } = sources;

  useEffect(() => {
    let current = true;

    session.dataAt(step, field, samples, typed).then(
      (read) => {
        if (current) setData(read);
      },
      () => undefined,
    );

    return () => {
      current = false;
    };
  }, [session, step, field, samples, typed, value]);

  return data;
}

function useTemplate(
  session: WorkflowSession,
  pointer: string,
  value: JsonValue,
): TemplateReading | null {
  const [template, setTemplate] = useState<TemplateReading | null>(null);
  const isText = typeof value === "string";

  useEffect(() => {
    let current = true;

    if (!isText) return;

    session.readTemplate(pointer).then(
      (read) => {
        if (current) setTemplate(read);
      },
      () => undefined,
    );

    return () => {
      current = false;
    };
  }, [session, pointer, value, isText]);

  return isText ? template : null;
}

function useCondition(
  session: WorkflowSession,
  text: string,
): ConditionReading | null {
  const [reading, setReading] = useState<ConditionReading | null>(null);

  useEffect(() => {
    let current = true;

    session.readCondition(text).then(
      (read) => {
        if (current) setReading(read);
      },
      () => undefined,
    );

    return () => {
      current = false;
    };
  }, [session, text]);

  return reading;
}

function DataSlotField({ slot, sources }: Slotted<DataSlot>) {
  const [typed, setTyped] = useState(NOTHING_TYPED);
  const data = useDataAt(sources, slot.pointer, typed, slot.value);
  const template = useTemplate(sources.session, slot.pointer, slot.value);

  return (
    <DataField {...slot} data={data} template={template} onSearch={setTyped} />
  );
}

function ConditionSlotField({ slot, sources }: Slotted<ConditionSlot>) {
  const [typed, setTyped] = useState(NOTHING_TYPED);
  const reading = useCondition(sources.session, slot.text);
  const data = useDataAt(sources, slot.pointer, typed, slot.text);

  function picker({ label, describedBy, onPick }: PickerSlot) {
    return (
      <DataPicker
        data={data}
        onlyPaths
        label={label}
        describedBy={describedBy}
        onSearch={setTyped}
        onPick={(pick) => {
          const chosen = {
            value: pick.value,
            expression: pick.expression,
            export: pick.export,
          };
          onPick(chosen);
        }}
      />
    );
  }

  return (
    <ConditionBuilder
      {...slot}
      reading={reading}
      data={data}
      renderPicker={picker}
      onEdit={sources.onEdit}
    />
  );
}

function CodeSlotField({ slot, sources }: Slotted<CodeSlot>) {
  const field = slot.field;
  const written = typeof field.value === "string" ? field.value : "";
  const language = slot.language === "python" ? "python" : "js";
  const pending = useRef<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function send() {
    const code = pending.current;
    pending.current = null;

    if (code === null || code === written) return;

    const edits = textEditsOf(field, code);
    sources.onEdit(edits);
  }

  const sendOnLeaving = useEffectEvent(send);

  useEffect(
    () => () => {
      if (timer.current !== null) clearTimeout(timer.current);

      sendOnLeaving();
    },
    [],
  );

  function hold(code: string) {
    pending.current = code;

    if (timer.current !== null) clearTimeout(timer.current);

    timer.current = setTimeout(send, COMMIT_PAUSE_MS);
  }

  return (
    <ScriptField
      language={language}
      label="Code"
      value={written}
      expanded={sources.wide}
      onChange={hold}
      onExpandedChange={sources.onWide}
    />
  );
}
