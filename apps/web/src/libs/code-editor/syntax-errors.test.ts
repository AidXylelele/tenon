import {
  diagnosticCount,
  forceLinting,
  forEachDiagnostic,
} from '@codemirror/lint';
import { EditorState, EditorView } from '@uiw/react-codemirror';
import { afterEach, describe, expect, it } from 'vitest';
import { type CodeLanguage, languageSupport } from './languages';
import { syntaxErrors } from './syntax-errors';

const views: EditorView[] = [];

// An editor over the code with the language and the syntax check, checked at once.
function checked(code: string, language: CodeLanguage): EditorView {
  const support = languageSupport(language);
  const state = EditorState.create({
    doc: code,
    extensions: [support, syntaxErrors],
  });
  const view = new EditorView({ state, parent: document.body });
  views.push(view);
  forceLinting(view);
  return view;
}

// The messages of the diagnostics the editor shows.
function messagesOf(view: EditorView): string[] {
  const messages: string[] = [];
  forEachDiagnostic(view.state, (diagnostic) => {
    messages.push(diagnostic.message);
  });
  return messages;
}

describe('the syntax check of a code field', () => {
  afterEach(() => {
    views.splice(0).forEach((view) => view.destroy());
  });

  it('marks_the_line_where_the_code_stops_making_sense', async () => {
    const view = checked('const a = 1;\nconst = ;\n', 'javascript');

    await expect.poll(() => diagnosticCount(view.state)).toBeGreaterThan(0);
    const messages = messagesOf(view);
    expect(messages[0]).toBe('Line 2 does not read as code here');
  });

  it('code_that_reads_has_no_marks', async () => {
    const view = checked(
      'def total(items):\n    return sum(items)\n',
      'python',
    );

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(diagnosticCount(view.state)).toBe(0);
  });

  it('an_empty_field_is_left_alone', async () => {
    const view = checked('   \n', 'json');

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(diagnosticCount(view.state)).toBe(0);
  });

  it('marks_no_more_than_twenty_places', async () => {
    const broken = Array.from({ length: 40 }, () => '{"a" 1}').join('\n');
    const view = checked(broken, 'json');

    await expect.poll(() => diagnosticCount(view.state)).toBe(20);
  });
});
