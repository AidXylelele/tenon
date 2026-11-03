'use client';

import { yaml } from '@codemirror/lang-yaml';
import { type Diagnostic, lintGutter, setDiagnostics } from '@codemirror/lint';
import CodeMirror, { EditorView } from '@uiw/react-codemirror';
import { useEffect, useState } from 'react';
import { usePrefersDark } from '@/libs/code-editor/color-scheme';

interface CodeViewProps {
  readonly text: string;
  readonly onText: (text: string) => void;
  readonly diagnostics: readonly Diagnostic[];
  // A range to bring into view and select, as when "Show the problem" is pressed.
  readonly focus: { readonly from: number; readonly to: number } | null;
}

const EXTENSIONS = [yaml(), lintGutter(), EditorView.lineWrapping];

// The document as text, in CodeMirror 6 (research R4): YAML highlighting, and the parse error
// or the check's problem marked at its range.
export default function CodeView({
  text,
  onText,
  diagnostics,
  focus,
}: CodeViewProps) {
  const [view, setView] = useState<EditorView | null>(null);
  const dark = usePrefersDark();

  useEffect(() => {
    if (view === null) return;

    const length = view.state.doc.length;
    const bounded = diagnostics.map((each) => ({
      ...each,
      from: Math.min(each.from, length),
      to: Math.min(Math.max(each.to, each.from), length),
    }));
    view.dispatch(setDiagnostics(view.state, bounded));
  }, [view, diagnostics, text]);

  useEffect(() => {
    if (view === null || focus === null) return;

    const length = view.state.doc.length;
    const anchor = Math.min(focus.from, length);
    const head = Math.min(focus.to, length);
    view.dispatch({ selection: { anchor, head }, scrollIntoView: true });
    view.focus();
  }, [view, focus]);

  return (
    <div className="overflow-hidden rounded-xl border text-[13px]">
      <CodeMirror
        onCreateEditor={setView}
        value={text}
        onChange={onText}
        extensions={EXTENSIONS}
        theme={dark ? 'dark' : 'light'}
        minHeight="28rem"
        maxHeight="70vh"
        basicSetup={{
          foldGutter: true,
          highlightActiveLine: true,
          autocompletion: false,
        }}
        aria-label="Workflow document"
      />
    </div>
  );
}
