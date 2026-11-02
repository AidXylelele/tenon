import { WorkflowName } from '../../../../../src/domain/automation/language/workflow-name.js';
import { WorkflowTarget } from '../../../../../src/domain/automation/language/workflow-target.js';
import { RunnableVersion } from '../../../../../src/domain/automation/workflows/runnable-version.js';
import { published } from '../../../../support/instances.js';
import { definitionOf } from '../../../../support/progress.js';

describe('RunnableVersion', () => {
  const greet = published(definitionOf([], {}, null, 'default/greet'));
  const other = published(definitionOf([], {}, null, 'default/other'));

  it('a_version_of_another_workflow_is_refused', () => {
    const pair = () =>
      new RunnableVersion({ workflow: greet.workflow, version: other.version });

    expect(pair).toThrow('The version belongs to another workflow');
  });

  it('a_workflow_or_version_not_found_runs_nothing', () => {
    expect(RunnableVersion.found(null, greet.version)).toBeNull();
    expect(RunnableVersion.found(greet.workflow, null)).toBeNull();
  });

  it('is_named_by_a_target_of_its_workflow_only', () => {
    const runnable = new RunnableVersion(greet);
    const greetName = new WorkflowName('default', 'greet');
    const otherName = new WorkflowName('default', 'other');

    expect(runnable.isNamedBy(WorkflowTarget.of(greetName, null))).toBe(true);
    expect(runnable.isNamedBy(WorkflowTarget.of(otherName, '1.0.0'))).toBe(
      false,
    );
  });
});
