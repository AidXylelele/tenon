import { DocumentReading } from '../../../../../src/domain/automation/language/document-reading.js';
import type { ParsedDocument } from '../../../../../src/domain/automation/language/interfaces.js';
import { Problem } from '../../../../../src/domain/automation/language/problem.js';
import { WorkflowName } from '../../../../../src/domain/automation/language/workflow-name.js';
import { SourceDocument } from '../../../../../src/domain/automation/workflows/source-document.js';
import { Workflow } from '../../../../../src/domain/automation/workflows/workflow.js';
import { WorkflowVersion } from '../../../../../src/domain/automation/workflows/workflow-version.js';
import {
  DefinitionRejectedError,
  VersionConflictError,
} from '../../../../../src/domain/errors.js';

const now = new Date('2026-06-01T00:00:00Z');

const noTargets = { workflows: [], versions: [] };

const parsed: ParsedDocument = {
  document: {
    dsl: '1.0.3',
    namespace: 'default',
    name: 'greet',
    version: '1.2.0',
  },
  do: [{ hello: { set: { greeting: 'hello' } } }],
};

function definitionOf(document: ParsedDocument) {
  const build = new DocumentReading(document, []).build();
  const report = build.report([], noTargets);
  return report.publishable();
}

describe('WorkflowVersion', () => {
  const source = SourceDocument.of('yaml', 'document: {}\n');

  it('a_clean_report_publishes_the_version_and_makes_it_current', () => {
    const workflow = Workflow.register(new WorkflowName('default', 'greet'));
    const definition = definitionOf(parsed);

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

  it('a_report_with_problems_refuses_publication_with_every_problem', () => {
    const build = new DocumentReading(parsed, []).build();
    const expressionProblems = [new Problem('/do/0/hello/set', 'syntax error')];
    const report = build.report(expressionProblems, noTargets);

    expect(() => report.publishable()).toThrow(DefinitionRejectedError);
    expect(() => report.publishable()).toThrow(
      expect.objectContaining({ problems: expressionProblems }) as Error,
    );
  });

  it('a_document_that_could_not_be_read_is_refused_with_the_reading_problems', () => {
    const problems = [new Problem('/do', 'must be array')];
    const build = new DocumentReading(null, problems).build();
    const report = build.report([], noTargets);

    expect(report.problems).toEqual(problems);
    expect(() => report.publishable()).toThrow(DefinitionRejectedError);
  });

  it('a_definition_of_another_workflow_cannot_become_its_version', () => {
    const workflow = Workflow.register(new WorkflowName('billing', 'invoice'));
    const definition = definitionOf(parsed);
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
    const workflow = Workflow.register(new WorkflowName('default', 'greet'));
    const definition = definitionOf(parsed);
    const version = WorkflowVersion.publish({
      workflow,
      definition,
      source,
      publisherId: 'author-1',
      now,
    });
    const same = SourceDocument.of('yaml', 'document: {}\n');
    const other = SourceDocument.of('yaml', 'document: { changed: true }\n');

    expect(() => version.confirmSame(same)).not.toThrow();
    expect(() => version.confirmSame(other)).toThrow(VersionConflictError);
  });
});
