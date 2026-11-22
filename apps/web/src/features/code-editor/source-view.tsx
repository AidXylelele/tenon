"use client";

import { yaml } from "@codemirror/lang-yaml";
import type { Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { useMemo } from "react";
import { CodeMirrorView } from "@/libs/codemirror/codemirror-view";
import { tokenTheme } from "@/libs/codemirror/theme";

export function SourceView({
  text,
  label,
}: {
  readonly text: string;
  readonly label: string;
}) {
  const extensions = useMemo<Extension>(
    () => [yaml(), tokenTheme(), EditorView.lineWrapping],
    [],
  );

  return (
    <CodeMirrorView
      doc={text}
      readOnly
      extensions={extensions}
      label={label}
      className="overflow-hidden rounded-xl border"
    />
  );
}
