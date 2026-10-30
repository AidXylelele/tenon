import { Definition } from '../../../../../src/domain/automation/language/definition.js';
import { Input } from '../../../../../src/domain/automation/language/input.js';
import { JsonPointer } from '../../../../../src/domain/automation/language/json-pointer.js';
import { Output } from '../../../../../src/domain/automation/language/output.js';
import { ReusableComponents } from '../../../../../src/domain/automation/language/reusable-components.js';
import { WorkflowName } from '../../../../../src/domain/automation/language/workflow-name.js';
import { DocumentFormat } from '../../../../../src/domain/automation/workflows/enums.js';
import { SourceDocument } from '../../../../../src/domain/automation/workflows/source-document.js';
import { Workflow } from '../../../../../src/domain/automation/workflows/workflow.js';
import { WorkflowVersion } from '../../../../../src/domain/automation/workflows/workflow-version.js';
import { VersionConflictError } from '../../../../../src/domain/errors.js';
import { setTask, taskList } from '../../../../support/language.js';

const now = new Date('2026-06-01T00:00:00Z');

function definitionOf(workflow: WorkflowName): Definition {
  const body = JsonPointer.root().at('do');
  return new Definition({
    workflow,
    version: '1.2.0',
    dslVersion: '1.0.3',
    input: Input.none(),
    output: Output.none(),
    timeout: null,
    body: taskList(body, [setTask(body, 0, 'hello')]),
    components: ReusableComponents.none(),
  });
}

describe('WorkflowVersion', () => {
  const greet = new WorkflowName('default', 'greet');
  const source = SourceDocument.of(DocumentFormat.Yaml, 'document: {}\n');

  it('a_definition_publishes_a_version_with_its_semver_and_dsl_version', () => {
    const workflow = Workflow.register(greet);
    const definition = definitionOf(greet);

    const version = WorkflowVersion.publish({
      workflow,
      definition,
      source,
      publisherId: 'author-1',
      now,
    });
    workflow.publish(version);

    expect(version.semver).toBe('1.2.0');
    expect(version.dslVersion).toBe('1.0.3');
    expect(version.publishedAt).toBe(now);
    expect(workflow.currentVersionId).toBe(version.id);
  });

  it('a_definition_of_another_workflow_cannot_become_its_version', () => {
    const workflow = Workflow.register(new WorkflowName('billing', 'invoice'));
    const definition = definitionOf(greet);
    const publish = () =>
      WorkflowVersion.publish({
        workflow,
        definition,
        source,
        publisherId: 'author-1',
        now,
      });

    expect(publish).toThrow('The definition belongs to another workflow');
  });

  it('the_same_text_is_the_same_document_and_other_text_is_a_conflict', () => {
    const workflow = Workflow.register(greet);
    const version = WorkflowVersion.publish({
      workflow,
      definition: definitionOf(greet),
      source,
      publisherId: 'author-1',
      now,
    });
    const same = SourceDocument.of(DocumentFormat.Yaml, 'document: {}\n');
    const other = SourceDocument.of(
      DocumentFormat.Yaml,
      'document: { changed: true }\n',
    );

    expect(() => {
      version.confirmSame(same);
    }).not.toThrow();
    expect(() => {
      version.confirmSame(other);
    }).toThrow(VersionConflictError);
  });
});
