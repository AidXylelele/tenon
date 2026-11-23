"use client";

import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { EditorView, keymap } from "@codemirror/view";
import type { TemplatePart } from "language-server/protocol";
import { useEffect, useEffectEvent, useRef } from "react";
import { cn } from "@/libs/ui/tokens/cn";
import { choiceOfExpression } from "./data-choices";
import { DataPicker } from "./data-picker";
import type { DataPick, TemplateFieldProps } from "./interfaces";
import {
  insertChip,
  partsOfState,
  templateDocOf,
  templateEditing,
} from "./template-text";

const HOST =
  "min-h-8 min-w-0 grow basis-40 rounded-md border border-control bg-surface px-2.5 py-1 text-sm has-[.cm-focused]:ring-2 has-[.cm-focused]:ring-focus-ring";

const LOOK = EditorView.theme({
  "&": { fontFamily: "inherit" },
  "&.cm-focused": { outline: "none" },
  ".cm-scroller": { fontFamily: "inherit", lineHeight: "inherit" },
  ".cm-content": { padding: "2px 0", fontFamily: "inherit" },
  ".cm-line": { padding: "0" },
});

type DataPart = Extract<TemplatePart, { readonly kind: "data" }>;

export function TemplateField({
  parts,
  data,
  inputId,
  labelId,
  describedBy,
  invalid,
  onTemplate,
  onSearch,
}: TemplateFieldProps) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);

  const wordsOf = useEffectEvent((part: DataPart) => {
    const choice =
      data === null ? null : choiceOfExpression(part.expression, data);
    return choice?.label ?? part.label;
  });
  const commit = useEffectEvent(() => {
    const editor = view.current;

    if (editor === null) return;

    const typed = partsOfState(editor.state);
    const isSame = JSON.stringify(typed) === JSON.stringify(parts);

    if (!isSame) onTemplate(typed, null);
  });
  const create = useEffectEvent(() => {
    const doc = templateDocOf(parts);
    const described: Record<string, string> =
      describedBy === undefined ? {} : { "aria-describedby": describedBy };
    const leaveOnEnter = {
      key: "Enter",
      run: (editor: EditorView) => {
        editor.contentDOM.blur();
        return true;
      },
    };
    return new EditorView({
      doc,
      extensions: [
        templateEditing(parts, wordsOf),
        history(),
        keymap.of([leaveOnEnter, ...historyKeymap, ...defaultKeymap]),
        LOOK,
        EditorView.contentAttributes.of({
          id: inputId,
          "aria-labelledby": labelId,
          "aria-multiline": "false",
          "aria-invalid": String(invalid),
          ...described,
        }),
        EditorView.domEventHandlers({
          blur: () => {
            commit();
          },
        }),
      ],
    });
  });

  useEffect(() => {
    const created = create();
    host.current?.append(created.dom);
    view.current = created;
    return () => {
      created.destroy();
      view.current = null;
    };
  }, []);

  function insert(pick: DataPick) {
    const editor = view.current;

    if (editor === null) return;

    const part: DataPart = {
      kind: "data",
      expression: pick.expression,
      label: pick.label,
    };
    insertChip(editor, part, pick.label);
    const typed = partsOfState(editor.state);
    const use = { value: pick.value, export: pick.export };
    onTemplate(typed, use);
  }

  return (
    <div className="flex flex-wrap items-start gap-2">
      <div ref={host} className={cn(HOST, invalid && "border-destructive")} />
      <DataPicker
        data={data}
        onlyPaths
        describedBy={labelId}
        onSearch={onSearch}
        onPick={insert}
      />
    </div>
  );
}
