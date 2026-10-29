import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createDslSchema } from '../../../src/frameworks/ajv/dsl-schema.js';
import { SourceDocument } from '../../../src/domain/automation/workflows/source-document.js';
import { DslDocumentReader } from '../../../src/interface-adapters/documents/dsl-document.reader.js';

const features = fileURLToPath(
  new URL('../../conformance/features', import.meta.url),
);

function ctkDocuments(): string[] {
  const documents: string[] = [];

  for (const file of readdirSync(features).filter((name) =>
    name.endsWith('.feature'),
  )) {
    const text = readFileSync(`${features}/${file}`, 'utf8');
    const blocks = text.split('Given a workflow with definition:').slice(1);

    for (const block of blocks) {
      const yaml = /"""yaml\n([\s\S]*?)\n\s*"""/.exec(block)?.[1] ?? '';
      const indent = /^(\s*)/.exec(yaml)?.[1]?.length ?? 0;
      documents.push(
        yaml
          .split('\n')
          .map((line) => line.slice(indent))
          .join('\n'),
      );
    }
  }

  return documents;
}

function header(tasks: string): string {
  return `document:\n  dsl: '1.0.3'\n  namespace: default\n  name: sample\n  version: '1.0.0'\ndo:\n${tasks}`;
}

describe('DslDocumentReader', () => {
  const reader = new DslDocumentReader(createDslSchema());

  function problemsOf(text: string): string[][] {
    const source = SourceDocument.of('yaml', text);
    const build = reader.read(source).build();
    return build.problems.map((problem) => [problem.pointer, problem.reason]);
  }

  it('every_ctk_document_is_read_without_schema_problems', () => {
    const documents = ctkDocuments();

    expect(documents).toHaveLength(21);

    for (const text of documents) {
      const source = SourceDocument.of('yaml', text);
      const build = reader.read(source).build();
      const schemaProblems = build.problems.filter(
        (problem) => !problem.reason.includes('outside the supported subset'),
      );
      expect(schemaProblems).toEqual([]);
    }
  });

  it('a_yaml_syntax_error_is_reported_at_the_root', () => {
    const problems = problemsOf('document: [unclosed');

    expect(problems).toHaveLength(1);
    expect(problems[0]?.[0]).toBe('');
    expect(problems[0]?.[1]).toMatch(/^The document cannot be parsed: /);
  });

  it('an_unknown_task_property_is_the_only_problem_reported', () => {
    const problems = problemsOf(
      header('  - a:\n      set:\n        x: 1\n      bogus: true\n'),
    );

    expect(problems).toEqual([
      ['/do/0/a', 'must NOT have unevaluated properties: bogus'],
    ]);
  });

  it('a_task_without_a_kind_says_which_kinds_exist', () => {
    const problems = problemsOf(header('  - a:\n      bogus: 1\n'));

    expect(problems).toContainEqual([
      '/do/0/a',
      'must define one task: call, do, emit, for, fork, listen, raise, run, set, switch, try, wait',
    ]);
  });

  it('an_http_call_without_an_endpoint_is_located_under_its_arguments', () => {
    const problems = problemsOf(
      header('  - a:\n      call: http\n      with:\n        method: get\n'),
    );

    expect(problems.length).toBeGreaterThan(0);
    expect(problems.length).toBeLessThanOrEqual(3);

    for (const [pointer] of problems)
      expect(pointer?.startsWith('/do/0/a')).toBe(true);
  });

  it('an_unknown_top_level_property_is_refused_where_it_stands', () => {
    const problems = problemsOf(
      `${header('  - a:\n      set:\n        x: 1\n')}surprise: 1\n`,
    );

    expect(problems).toEqual([
      ['/surprise', '"surprise" is not a property of a workflow'],
    ]);
  });
});
