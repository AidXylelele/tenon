"use client";

import { yaml } from "@codemirror/lang-yaml";
import { lintGutter, lintKeymap } from "@codemirror/lint";
import {
  findReferencesKeymap,
  hoverTooltips,
  jumpToDefinitionKeymap,
  type LSPClient,
  type LSPClientExtension,
  renameKeymap,
  serverCompletion,
  serverDiagnostics,
} from "@codemirror/lsp-client";
import type { Extension } from "@codemirror/state";
import { type EditorView, keymap, type ViewUpdate } from "@codemirror/view";
import { useMemo } from "react";
import { CodeMirrorView } from "@/libs/codemirror/codemirror-view";
import { tokenTheme } from "@/libs/codemirror/theme";

interface CodeViewProps {
  readonly client: LSPClient;
  readonly uri: string;
  readonly text: string;
  readonly onView: (view: EditorView) => void;
  readonly onUpdate: (update: ViewUpdate) => void;
}

const LANGUAGE = "yaml";

const QUICK_FIXES: LSPClientExtension = {
  clientCapabilities: {
    textDocument: {
      codeAction: {
        dataSupport: true,
        resolveSupport: { properties: ["edit"] },
        codeActionLiteralSupport: {
          codeActionKind: { valueSet: ["quickfix"] },
        },
      },
    },
  },
};

export const LANGUAGE_FEATURES: readonly (Extension | LSPClientExtension)[] = [
  serverCompletion(),
  hoverTooltips(),
  serverDiagnostics(),
  QUICK_FIXES,
];

export function CodeView({
  client,
  uri,
  text,
  onView,
  onUpdate,
}: CodeViewProps) {
  const extensions = useMemo<Extension>(
    () => [
      yaml(),
      tokenTheme(),
      lintGutter(),
      keymap.of([
        ...renameKeymap,
        ...jumpToDefinitionKeymap,
        ...findReferencesKeymap,
        ...lintKeymap,
      ]),
      client.plugin(uri, LANGUAGE),
    ],
    [client, uri],
  );

  return (
    <CodeMirrorView
      doc={text}
      extensions={extensions}
      label="Code view (YAML); select a step's lines to open its form"
      className="h-full min-h-0 [&_.cm-editor]:h-full"
      onView={onView}
      onUpdate={onUpdate}
    />
  );
}
