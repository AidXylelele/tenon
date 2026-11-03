import { javascript } from '@codemirror/lang-javascript';
import { json } from '@codemirror/lang-json';
import { python } from '@codemirror/lang-python';
import { yaml } from '@codemirror/lang-yaml';
import type { Extension } from '@uiw/react-codemirror';

export type CodeLanguage = 'javascript' | 'python' | 'json' | 'yaml';

const NAME: Record<CodeLanguage, string> = {
  javascript: 'JavaScript',
  python: 'Python',
  json: 'JSON',
  yaml: 'YAML',
};

export function languageName(language: CodeLanguage): string {
  return NAME[language];
}

export function languageSupport(language: CodeLanguage): Extension {
  if (language === 'python') return python();

  if (language === 'json') return json();

  if (language === 'yaml') return yaml();

  return javascript();
}
