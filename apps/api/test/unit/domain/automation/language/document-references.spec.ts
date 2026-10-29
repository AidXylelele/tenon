import { DocumentReferences } from '../../../../../src/domain/automation/language/document-references.js';
import { ReferenceFacts } from '../../../../../src/domain/automation/language/reference-facts.js';
import { WorkflowName } from '../../../../../src/domain/automation/language/workflow-name.js';
import { WorkflowReference } from '../../../../../src/domain/automation/language/workflow-reference.js';
import { WorkflowTarget } from '../../../../../src/domain/automation/language/workflow-target.js';

function reference(
  pointer: string,
  name: string,
  version: string,
): WorkflowReference {
  const workflow = new WorkflowName('billing', name);
  const target = new WorkflowTarget(workflow, version);
  return new WorkflowReference(pointer, target);
}

describe('DocumentReferences', () => {
  const references = new DocumentReferences([
    reference('/do/0/a/run/workflow', 'invoice', 'latest'),
    reference('/do/1/b/run/workflow', 'invoice', '2.0.0'),
    reference('/do/2/c/run/workflow', 'refund', 'latest'),
  ]);

  it('a_missing_workflow_and_an_unpublished_version_are_refused_where_they_are_named', () => {
    const facts = ReferenceFacts.of({
      workflows: [{ namespace: 'billing', name: 'invoice' }],
      versions: [{ namespace: 'billing', name: 'invoice', version: '1.0.0' }],
    });

    const problems = references.check(facts);

    expect(
      problems.map((problem) => [problem.pointer, problem.reason]),
    ).toEqual([
      [
        '/do/1/b/run/workflow',
        'Version 2.0.0 of billing/invoice is not published',
      ],
      ['/do/2/c/run/workflow', 'No workflow billing/refund exists'],
    ]);
  });

  it('published_targets_raise_no_problem', () => {
    const facts = ReferenceFacts.of({
      workflows: [
        { namespace: 'billing', name: 'invoice' },
        { namespace: 'billing', name: 'refund' },
      ],
      versions: [{ namespace: 'billing', name: 'invoice', version: '2.0.0' }],
    });

    const problems = references.check(facts);

    expect(problems).toEqual([]);
  });
});
