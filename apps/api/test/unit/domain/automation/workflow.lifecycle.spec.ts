import {
  InstanceRefusal,
  Phase,
  TriggerKind,
} from '../../../../src/domain/automation/instances/enums.js';
import type { WorkflowInstance } from '../../../../src/domain/automation/instances/workflow-instance.js';
import { CheckedDefinition } from '../../../../src/domain/automation/workflows/checked-definition.js';
import {
  WorkflowRefusal,
  WorkflowStatus,
} from '../../../../src/domain/automation/workflows/enums.js';
import { Workflow } from '../../../../src/domain/automation/workflows/workflow.js';
import { WorkflowName } from '../../../../src/domain/automation/workflows/workflow-name.js';
import { WorkflowVersion } from '../../../../src/domain/automation/workflows/workflow-version.js';
import { aDefinition, aDocument } from '../../../support/builders.js';
import { anInstanceIn } from '../../../support/qa-fakes.js';

const now = new Date('2026-11-03T10:00:00.000Z');
const later = new Date('2026-11-03T11:00:00.000Z');
const name = new WorkflowName('sales', 'route-lead');
const UUID = /^[0-9a-f-]{36}$/;

function definitionOf(version: string, content = `content-${version}`) {
  return aDefinition({ version }, content);
}

function publishNew(workflow: Workflow, version: string): WorkflowVersion {
  const header = {
    namespace: workflow.name.namespace,
    name: workflow.name.name,
    version,
  };
  const definition = aDefinition(header, `content-${version}`);
  const result = workflow.publish({
    definition,
    existing: null,
    publisherId: 'author-1',
    now,
  });

  if (!result.ok) throw new Error(result.failure);

  return result.value.version;
}

function startOn(
  workflow: Workflow,
  version: WorkflowVersion,
): WorkflowInstance {
  const result = workflow.startInstance({
    version,
    input: { amount: 7 },
    trigger: TriggerKind.Manual,
    starterId: 'author-1',
    originId: null,
    now,
  });

  if (!result.ok) throw new Error(result.failure);

  return result.value;
}

describe('WorkflowName', () => {
  it('names_with_the_same_namespace_and_name_are_equal', () => {
    const same = new WorkflowName('sales', 'route-lead');

    expect(name.equals(same)).toBe(true);
    expect(same.namespace).toBe('sales');
    expect(same.name).toBe('route-lead');
  });

  it.each([
    ['other', 'route-lead'],
    ['sales', 'other'],
    ['route-lead', 'sales'],
  ])('the_name_%s_%s_is_another_workflow', (namespace, local) => {
    const other = new WorkflowName(namespace, local);

    expect(name.equals(other)).toBe(false);
  });
});

describe('CheckedDefinition and WorkflowVersion', () => {
  it('a_checked_definition_keeps_what_the_checker_gave', () => {
    const document = aDocument();
    const definition = new CheckedDefinition({
      name,
      version: '1.0.0',
      dsl: '1.0.3',
      fingerprint: 'fp',
      document,
      eventTypes: null,
    });

    expect(definition.name).toBe(name);
    expect(definition.version).toBe('1.0.0');
    expect(definition.dsl).toBe('1.0.3');
    expect(definition.fingerprint).toBe('fp');
    expect(definition.document).toBe(document);
  });

  it('a_published_version_copies_the_definition_and_the_publication', () => {
    const definition = definitionOf('1.2.3');

    const version = WorkflowVersion.publish('workflow-1', {
      definition,
      existing: null,
      publisherId: 'author-9',
      now,
    });

    expect(version.id).toMatch(UUID);
    expect(version.workflowId).toBe('workflow-1');
    expect(version.semver).toBe('1.2.3');
    expect(version.dsl).toBe('1.0.3');
    expect(version.fingerprint).toBe('content-1.2.3');
    expect(version.document).toBe(definition.document);
    expect(version.publisherId).toBe('author-9');
    expect(version.publishedAt).toBe(now);
  });

  it('each_published_version_gets_its_own_id', () => {
    const definition = definitionOf('1.0.0');
    const input = { definition, existing: null, publisherId: 'a', now };

    const first = WorkflowVersion.publish('workflow-1', input);
    const second = WorkflowVersion.publish('workflow-1', input);

    expect(first.id).not.toBe(second.id);
  });

  it('republishing_the_same_fingerprint_answers_the_version_itself', () => {
    const version = WorkflowVersion.publish('workflow-1', {
      definition: definitionOf('1.0.0'),
      existing: null,
      publisherId: 'author-1',
      now,
    });

    const result = version.republish(definitionOf('1.0.0'));

    expect(result).toEqual({ ok: true, value: { version, created: false } });
    expect(result.ok && result.value.version).toBe(version);
  });

  it('republishing_other_content_is_refused_as_taken', () => {
    const version = WorkflowVersion.publish('workflow-1', {
      definition: definitionOf('1.0.0'),
      existing: null,
      publisherId: 'author-1',
      now,
    });

    const result = version.republish(definitionOf('1.0.0', 'changed'));

    expect(result).toEqual({
      ok: false,
      failure: WorkflowRefusal.VersionTaken,
    });
  });
});

describe('Workflow publishing and archiving', () => {
  it('a_registered_workflow_has_an_id_no_archive_moment_and_no_version', () => {
    const workflow = Workflow.register(name);

    expect(workflow.id).toMatch(UUID);
    expect(workflow.name).toBe(name);
    expect(workflow.archivedAt).toBeNull();
    expect(workflow.currentVersionId).toBeNull();
  });

  it('each_registration_is_a_new_workflow', () => {
    const first = Workflow.register(name);
    const second = Workflow.register(name);

    expect(first.id).not.toBe(second.id);
  });

  it('a_published_version_belongs_to_the_workflow', () => {
    const workflow = Workflow.register(name);

    const version = publishNew(workflow, '1.0.0');

    expect(version.workflowId).toBe(workflow.id);
  });

  it('each_new_version_becomes_current', () => {
    const workflow = Workflow.register(name);

    const first = publishNew(workflow, '1.0.0');
    const afterFirst = workflow.currentVersionId;
    const second = publishNew(workflow, '2.0.0');

    expect(afterFirst).toBe(first.id);
    expect(workflow.currentVersionId).toBe(second.id);
  });

  it('a_newly_published_lower_version_also_becomes_current', () => {
    const workflow = Workflow.register(name);
    publishNew(workflow, '2.0.0');

    const lower = publishNew(workflow, '1.5.0');

    expect(workflow.currentVersionId).toBe(lower.id);
  });

  it('republishing_an_older_version_does_not_move_the_current_one', () => {
    const workflow = Workflow.register(name);
    const first = publishNew(workflow, '1.0.0');
    const second = publishNew(workflow, '2.0.0');

    const result = workflow.publish({
      definition: definitionOf('1.0.0'),
      existing: first,
      publisherId: 'author-2',
      now: later,
    });

    expect(result).toEqual({
      ok: true,
      value: { version: first, created: false },
    });
    expect(workflow.currentVersionId).toBe(second.id);
  });

  it('a_repeat_keeps_the_first_publisher_and_moment', () => {
    const workflow = Workflow.register(name);
    const first = publishNew(workflow, '1.0.0');

    const result = workflow.publish({
      definition: definitionOf('1.0.0'),
      existing: first,
      publisherId: 'author-2',
      now: later,
    });

    const version = result.ok ? result.value.version : null;
    expect(version?.publisherId).toBe('author-1');
    expect(version?.publishedAt).toBe(now);
  });

  it('other_content_under_a_taken_version_changes_nothing', () => {
    const workflow = Workflow.register(name);
    const first = publishNew(workflow, '1.0.0');
    const second = publishNew(workflow, '2.0.0');

    const result = workflow.publish({
      definition: definitionOf('1.0.0', 'changed'),
      existing: first,
      publisherId: 'author-1',
      now,
    });

    expect(result).toEqual({
      ok: false,
      failure: WorkflowRefusal.VersionTaken,
    });
    expect(workflow.currentVersionId).toBe(second.id);
  });

  it('a_definition_of_another_workflow_is_refused_even_as_a_repeat', () => {
    const workflow = Workflow.register(name);
    const first = publishNew(workflow, '1.0.0');
    const other = aDefinition({ name: 'other' }, 'content-1.0.0');

    expect(() =>
      workflow.publish({
        definition: other,
        existing: first,
        publisherId: 'author-1',
        now,
      }),
    ).toThrow(TypeError);
  });

  it('archiving_keeps_the_current_version', () => {
    const workflow = Workflow.register(name);
    const version = publishNew(workflow, '1.0.0');

    workflow.archive(later);

    expect(workflow.status).toBe(WorkflowStatus.Archived);
    expect(workflow.archivedAt).toBe(later);
    expect(workflow.currentVersionId).toBe(version.id);
  });

  it('a_workflow_without_versions_can_be_archived', () => {
    const workflow = Workflow.register(name);

    workflow.archive(now);

    expect(workflow.status).toBe(WorkflowStatus.Archived);
    expect(workflow.currentVersionId).toBeNull();
  });

  it('an_archived_workflow_answers_a_repeat_of_the_same_document', () => {
    const workflow = Workflow.register(name);
    const first = publishNew(workflow, '1.0.0');
    workflow.archive(now);

    const result = workflow.publish({
      definition: definitionOf('1.0.0'),
      existing: first,
      publisherId: 'author-1',
      now: later,
    });

    expect(result).toEqual({
      ok: true,
      value: { version: first, created: false },
    });
    expect(workflow.status).toBe(WorkflowStatus.Archived);
    expect(workflow.currentVersionId).toBe(first.id);
  });

  it('an_archived_workflow_refuses_a_new_version_and_keeps_its_current_one', () => {
    const workflow = Workflow.register(name);
    const first = publishNew(workflow, '1.0.0');
    workflow.archive(now);

    const result = workflow.publish({
      definition: definitionOf('2.0.0'),
      existing: null,
      publisherId: 'author-1',
      now: later,
    });

    expect(result).toEqual({ ok: false, failure: WorkflowRefusal.Archived });
    expect(workflow.currentVersionId).toBe(first.id);
  });

  it('an_archived_workflow_answers_other_content_under_a_taken_version_as_taken', () => {
    const workflow = Workflow.register(name);
    const first = publishNew(workflow, '1.0.0');
    workflow.archive(now);

    const result = workflow.publish({
      definition: definitionOf('1.0.0', 'changed'),
      existing: first,
      publisherId: 'author-1',
      now: later,
    });

    expect(result).toEqual({
      ok: false,
      failure: WorkflowRefusal.VersionTaken,
    });
  });

  it('a_registered_workflow_that_was_archived_refuses_its_first_version', () => {
    const workflow = Workflow.register(name);
    workflow.archive(now);

    const result = workflow.publish({
      definition: definitionOf('1.0.0'),
      existing: null,
      publisherId: 'author-1',
      now,
    });

    expect(result).toEqual({ ok: false, failure: WorkflowRefusal.Archived });
    expect(workflow.currentVersionId).toBeNull();
  });
});

describe('Workflow starting and restarting instances', () => {
  it('a_started_instance_carries_everything_the_start_named', () => {
    const workflow = Workflow.register(name);
    const version = publishNew(workflow, '1.0.0');

    const result = workflow.startInstance({
      version,
      input: [1, 'two', null],
      trigger: TriggerKind.Event,
      starterId: null,
      originId: 'origin-1',
      now,
    });

    const instance = result.ok ? result.value : null;
    expect(instance?.id).toMatch(UUID);
    expect(instance?.workflowId).toBe(workflow.id);
    expect(instance?.versionId).toBe(version.id);
    expect(instance?.trigger).toBe(TriggerKind.Event);
    expect(instance?.starterId).toBeNull();
    expect(instance?.originId).toBe('origin-1');
    expect(instance?.input).toEqual([1, 'two', null]);
    expect(instance?.phase).toBe(Phase.Pending);
    expect(instance?.output).toBeNull();
    expect(instance?.error).toBeNull();
    expect(instance?.createdAt).toBe(now);
    expect(instance?.startedAt).toBeNull();
    expect(instance?.endedAt).toBeNull();
    expect(instance?.version).toBe(0);
    expect(instance?.ended).toBe(false);
    expect(instance?.events).toEqual([]);
  });

  it('each_start_is_a_new_instance', () => {
    const workflow = Workflow.register(name);
    const version = publishNew(workflow, '1.0.0');

    const first = startOn(workflow, version);
    const second = startOn(workflow, version);

    expect(first.id).not.toBe(second.id);
  });

  it('an_older_version_still_starts_after_a_newer_one_is_current', () => {
    const workflow = Workflow.register(name);
    const older = publishNew(workflow, '1.0.0');
    publishNew(workflow, '2.0.0');

    const instance = startOn(workflow, older);

    expect(instance.versionId).toBe(older.id);
  });

  it('a_version_of_another_workflow_is_a_defect_even_when_archived', () => {
    const workflow = Workflow.register(name);
    const other = Workflow.register(new WorkflowName('sales', 'other'));
    const version = publishNew(other, '1.0.0');
    workflow.archive(now);

    expect(() => startOn(workflow, version)).toThrow(TypeError);
  });

  it.each([Phase.Completed, Phase.Faulted, Phase.Cancelled])(
    'a_%s_instance_is_restarted_as_a_new_pending_one',
    (phase) => {
      const workflow = Workflow.register(name);
      const version = publishNew(workflow, '1.0.0');
      const previous = anInstanceIn(phase, {
        workflowId: workflow.id,
        versionId: version.id,
        input: { amount: 42 },
      });

      const result = workflow.restartInstance({
        previous,
        version,
        starterId: 'author-2',
        now: later,
      });

      const restarted = result.ok ? result.value : null;
      expect(restarted?.id).not.toBe(previous.id);
      expect(restarted?.phase).toBe(Phase.Pending);
      expect(restarted?.trigger).toBe(TriggerKind.Restart);
      expect(restarted?.originId).toBe(previous.id);
      expect(restarted?.starterId).toBe('author-2');
      expect(restarted?.versionId).toBe(version.id);
      expect(restarted?.workflowId).toBe(workflow.id);
      expect(restarted?.input).toEqual({ amount: 42 });
      expect(restarted?.createdAt).toBe(later);
      expect(previous.phase).toBe(phase);
      expect(previous.events).toEqual([]);
    },
  );

  it.each([Phase.Pending, Phase.Running, Phase.Waiting, Phase.Suspended])(
    'a_%s_instance_is_not_restarted',
    (phase) => {
      const workflow = Workflow.register(name);
      const version = publishNew(workflow, '1.0.0');
      const previous = anInstanceIn(phase, {
        workflowId: workflow.id,
        versionId: version.id,
      });

      const result = workflow.restartInstance({
        previous,
        version,
        starterId: 'author-1',
        now,
      });

      expect(result).toEqual({ ok: false, failure: InstanceRefusal.NotEnded });
      expect(previous.phase).toBe(phase);
    },
  );

  it('an_archived_workflow_restarts_no_ended_instance', () => {
    const workflow = Workflow.register(name);
    const version = publishNew(workflow, '1.0.0');
    const previous = anInstanceIn(Phase.Faulted, {
      workflowId: workflow.id,
      versionId: version.id,
    });
    workflow.archive(now);

    const result = workflow.restartInstance({
      previous,
      version,
      starterId: 'author-1',
      now,
    });

    expect(result).toEqual({ ok: false, failure: WorkflowRefusal.Archived });
  });

  it('an_unended_instance_of_an_archived_workflow_is_refused_as_not_ended', () => {
    const workflow = Workflow.register(name);
    const version = publishNew(workflow, '1.0.0');
    const previous = anInstanceIn(Phase.Running, {
      workflowId: workflow.id,
      versionId: version.id,
    });
    workflow.archive(now);

    const result = workflow.restartInstance({
      previous,
      version,
      starterId: 'author-1',
      now,
    });

    expect(result).toEqual({ ok: false, failure: InstanceRefusal.NotEnded });
  });

  it('a_restart_of_a_restart_comes_from_the_one_it_restarts', () => {
    const workflow = Workflow.register(name);
    const version = publishNew(workflow, '1.0.0');
    const first = anInstanceIn(Phase.Faulted, {
      workflowId: workflow.id,
      versionId: version.id,
    });
    const restarted = workflow.restartInstance({
      previous: first,
      version,
      starterId: 'author-1',
      now,
    });
    const second = restarted.ok ? restarted.value : null;
    second!.fault({ type: 'again' }, later);

    const again = workflow.restartInstance({
      previous: second!,
      version,
      starterId: 'author-1',
      now: later,
    });

    expect(again.ok && again.value.originId).toBe(second?.id);
  });

  it('a_restart_on_a_version_of_another_workflow_is_a_defect_of_the_caller', () => {
    const workflow = Workflow.register(name);
    const other = Workflow.register(new WorkflowName('sales', 'other'));
    const foreign = publishNew(other, '1.0.0');
    const previous = anInstanceIn(Phase.Completed, { workflowId: workflow.id });

    expect(() =>
      workflow.restartInstance({
        previous,
        version: foreign,
        starterId: 'author-1',
        now,
      }),
    ).toThrow(TypeError);
  });

  // DEFECT (low): publish() and startInstance() throw for another workflow's input, but
  // restartInstance() takes another workflow's ended instance (and any version, not only the
  // previous instance's own) and starts it here with that instance's input.
  it('a_previous_instance_of_another_workflow_is_a_defect_of_the_caller', () => {
    const workflow = Workflow.register(name);
    const version = publishNew(workflow, '1.0.0');
    const previous = anInstanceIn(Phase.Completed, {
      workflowId: 'another-workflow',
      versionId: 'another-version',
    });

    expect(() =>
      workflow.restartInstance({
        previous,
        version,
        starterId: 'author-1',
        now,
      }),
    ).toThrow(TypeError);
  });
});
