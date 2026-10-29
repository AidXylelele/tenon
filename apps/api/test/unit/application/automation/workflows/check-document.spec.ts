import { CheckDocument } from '../../../../../src/application/automation/workflows/check-document.js';
import {
  FakeExpressionEvaluator,
  InMemoryWorkflowQueries,
  InMemoryWorkflowVersionRepository,
  JsonDocumentReader,
} from '../../../../support/fakes.js';

const valid = JSON.stringify({
  document: {
    dsl: '1.0.3',
    namespace: 'default',
    name: 'greet',
    version: '1.0.0',
  },
  do: [{ hello: { set: { greeting: '${ .name }' } } }],
});

function checker(refused: ReadonlySet<string> = new Set()): CheckDocument {
  const versions = new InMemoryWorkflowVersionRepository();
  const queries = new InMemoryWorkflowQueries(versions);
  const expressions = new FakeExpressionEvaluator(refused);
  return new CheckDocument(new JsonDocumentReader(), expressions, queries);
}

describe('CheckDocument', () => {
  it('a_valid_document_gives_a_clean_report', async () => {
    const report = await checker().execute({ format: 'json', text: valid });

    expect(report.isClean()).toBe(true);
    expect(report.problems).toEqual([]);
  });

  it('subset_expression_and_reference_problems_come_in_one_report', async () => {
    const text = JSON.stringify({
      document: {
        dsl: '1.0.3',
        namespace: 'default',
        name: 'broken',
        version: '1.0.0',
      },
      do: [
        { pause: { wait: 'PT1S' } },
        { compute: { set: { value: '${ .a + }' } } },
        {
          child: {
            run: { workflow: { namespace: 'billing', name: 'invoice' } },
          },
        },
      ],
    });
    const refused = new Set(['.a +']);

    const report = await checker(refused).execute({ format: 'json', text });
    const located = report.problems.map((problem) => [
      problem.pointer,
      problem.reason,
    ]);

    expect(report.isClean()).toBe(false);
    expect(located).toEqual([
      ['/do/0/pause/wait', 'the wait task is outside the supported subset'],
      ['/do/1/compute/set/value', 'syntax error'],
      ['/do/2/child/run/workflow', 'No workflow billing/invoice exists'],
    ]);
  });

  it('an_unreadable_document_reports_why_it_cannot_be_read', async () => {
    const report = await checker().execute({
      format: 'json',
      text: 'not json',
    });

    expect(report.problems.map((problem) => problem.reason)).toEqual([
      'The document is not JSON',
    ]);
  });
});
