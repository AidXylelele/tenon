'use client';

import { indentWithTab } from '@codemirror/commands';
import { lintGutter } from '@codemirror/lint';
import CodeMirror, { keymap } from '@uiw/react-codemirror';
import { useMemo } from 'react';
import { usePrefersDark } from '@/libs/ui/hooks/use-prefers-dark';
import { type CodeLanguage, languageSupport } from './languages';
import { syntaxErrors } from './syntax-errors';

interface CodeSurfaceProps {
  readonly id?: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly language: CodeLanguage;
  readonly label: string;
  readonly placeholder?: string;
}

// The editing surface: the language's highlighting and indentation, its syntax errors in the
// gutter, Tab to indent, and the console's light or dark colours.
export default function CodeSurface({
  id,
  value,
  onChange,
  language,
  label,
  placeholder,
}: CodeSurfaceProps) {
  const dark = usePrefersDark();
  const extensions = useMemo(
    () => [
      languageSupport(language),
      syntaxErrors,
      lintGutter(),
      keymap.of([indentWithTab]),
    ],
    [language],
  );

  return (
    <CodeMirror
      id={id}
      value={value}
      onChange={onChange}
      extensions={extensions}
      theme={dark ? 'dark' : 'light'}
      height="100%"
      className="h-full"
      placeholder={placeholder}
      basicSetup={{
        foldGutter: true,
        highlightActiveLine: true,
        tabSize: 2,
      }}
      aria-label={label}
    />
  );
}
