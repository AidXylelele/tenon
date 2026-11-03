import { language } from '@codemirror/language';
import { EditorState } from '@uiw/react-codemirror';
import { describe, expect, it } from 'vitest';
import { type CodeLanguage, languageName, languageSupport } from './languages';

describe('the languages a code field speaks', () => {
  it.each([
    ['javascript', 'JavaScript'],
    ['python', 'Python'],
    ['json', 'JSON'],
    ['yaml', 'YAML'],
  ] as const)('%s_is_named_%s', (code, name) => {
    expect(languageName(code)).toBe(name);
  });

  it.each<CodeLanguage>(['javascript', 'python', 'json', 'yaml'])(
    '%s_highlights_and_indents_as_itself',
    (code) => {
      const support = languageSupport(code);
      const state = EditorState.create({ extensions: support });

      expect(state.facet(language)?.name).toBe(code);
    },
  );
});
