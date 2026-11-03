import {
  InstanceRefusal,
  Phase,
  TriggerKind,
} from '../../../../src/domain/automation/instances/enums.js';
import {
  WorkflowEventKind,
  WorkflowRefusal,
  WorkflowStatus,
} from '../../../../src/domain/automation/workflows/enums.js';
import { Workflow } from '../../../../src/domain/automation/workflows/workflow.js';
import { WorkflowName } from '../../../../src/domain/automation/workflows/workflow-name.js';
import type { WorkflowVersion } from '../../../../src/domain/automation/workflows/workflow-version.js';
import { aDefinition } from '../../../support/builders.js';

const now = new Date('2026-11-03T10:00:00.000Z');
const later = new Date('2026-11-03T11:00:00.000Z');
const name = new WorkflowName('sales', 'route-lead');

function published(workflow: Workflow, version = '1.0.0'): WorkflowVersion {
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

describe('Workflow', () => {
  it('a_registered_workflow_is_active_and_has_no_current_version', () => {
    const workflow = Workflow.register(name);
    expect(workflow.status).toBe(WorkflowStatus.Active);
    expect(workflow.currentVersionId).toBeNull();
    expect(workflow.version).toBe(0);
  });

  it('publishing_creates_a_version_that_becomes_current', () => {
    const workflow = Workflow.register(name);
    const definition = aDefinition({ version: '1.2.0' });

    const result = workflow.publish({
      definition,
      existing: null,
      publisherId: 'author-1',
      now,
    });

    expect(result.ok).toBe(true);
    const publication = result.ok ? result.value : null;
    expect(publication?.created).toBe(true);
    expect(publication?.version.semver).toBe('1.2.0');
    expect(publication?.version.dsl).toBe('1.0.3');
    expect(publication?.version.publisherId).toBe('author-1');
    expect(publication?.version.publishedAt).toBe(now);
    expect(workflow.currentVersionId).toBe(publication?.version.id);
  });

  it('the_same_document_again_is_the_version_already_published', () => {
    const workflow = Workflow.register(name);
    const first = published(workflow);
    const again = aDefinition({ version: '1.0.0' }, 'content-1.0.0');

    const result = workflow.publish({
      definition: again,
      existing: first,
      publisherId: 'author-2',
      now: later,
    });

    expect(result).toEqual({
      ok: true,
      value: { version: first, created: false },
    });
  });

  it('other_content_under_a_published_identity_is_refused', () => {
    const workflow = Workflow.register(name);
    const first = published(workflow);
    const changed = aDefinition({ version: '1.0.0' }, 'other-content');

    const result = workflow.publish({
      definition: changed,
      existing: first,
      publisherId: 'author-1',
      now,
    });

    expect(result).toEqual({
      ok: false,
      failure: WorkflowRefusal.VersionTaken,
    });
    expect(workflow.currentVersionId).toBe(first.id);
  });

  it('a_definition_of_another_workflow_is_a_defect_of_the_caller', () => {
    const workflow = Workflow.register(name);
    const other = aDefinition({ name: 'other' });

    expect(() =>
      workflow.publish({
        definition: other,
        existing: null,
        publisherId: 'author-1',
        now,
      }),
    ).toThrow(TypeError);
  });

  it('archiving_records_the_moment_once', () => {
    const workflow = Workflow.register(name);

    workflow.archive(now);
    workflow.archive(later);

    expect(workflow.status).toBe(WorkflowStatus.Archived);
    expect(workflow.archivedAt).toBe(now);
  });

  it('an_archived_workflow_refuses_a_new_version_but_answers_a_repeat', () => {
    const workflow = Workflow.register(name);
    const first = published(workflow);
    workflow.archive(now);
    const next = aDefinition({ version: '2.0.0' }, 'content-2');
    const repeat = aDefinition({ version: '1.0.0' }, 'content-1.0.0');

    const refused = workflow.publish({
      definition: next,
      existing: null,
      publisherId: 'author-1',
      now,
    });
    const repeated = workflow.publish({
      definition: repeat,
      existing: first,
      publisherId: 'author-1',
      now,
    });

    expect(refused).toEqual({ ok: false, failure: WorkflowRefusal.Archived });
    expect(repeated.ok).toBe(true);
  });

  it('an_instance_starts_pending_on_the_version_with_its_input', () => {
    const workflow = Workflow.register(name);
    const version = published(workflow);

    const result = workflow.startInstance({
      version,
      input: { amount: 120 },
      trigger: TriggerKind.Manual,
      starterId: 'author-1',
      originId: null,
      now,
    });

    const instance = result.ok ? result.value : null;
    expect(instance?.phase).toBe(Phase.Pending);
    expect(instance?.workflowId).toBe(workflow.id);
    expect(instance?.versionId).toBe(version.id);
    expect(instance?.input).toEqual({ amount: 120 });
    expect(instance?.createdAt).toBe(now);
  });

  it('an_archived_workflow_starts_no_instance', () => {
    const workflow = Workflow.register(name);
    const version = published(workflow);
    workflow.archive(now);

    const result = workflow.startInstance({
      version,
      input: null,
      trigger: TriggerKind.Manual,
      starterId: 'author-1',
      originId: null,
      now,
    });

    expect(result).toEqual({ ok: false, failure: WorkflowRefusal.Archived });
  });

  it('a_version_of_another_workflow_is_a_defect_of_the_caller', () => {
    const workflow = Workflow.register(name);
    const other = Workflow.register(new WorkflowName('sales', 'other'));
    const version = published(other);

    expect(() =>
      workflow.startInstance({
        version,
        input: null,
        trigger: TriggerKind.Manual,
        starterId: null,
        originId: null,
        now,
      }),
    ).toThrow(TypeError);
  });

  it('restarting_an_ended_instance_starts_a_new_one_with_its_input', () => {
    const workflow = Workflow.register(name);
    const version = published(workflow);
    const started = workflow.startInstance({
      version,
      input: { amount: 7 },
      trigger: TriggerKind.Manual,
      starterId: 'author-1',
      originId: null,
      now,
    });
    const previous = started.ok ? started.value : null;
    previous?.fault({ type: 'runtime' }, now);

    const result = workflow.restartInstance({
      previous: previous!,
      version,
      starterId: 'author-2',
      now: later,
    });

    const restarted = result.ok ? result.value : null;
    expect(restarted?.trigger).toBe(TriggerKind.Restart);
    expect(restarted?.originId).toBe(previous?.id);
    expect(restarted?.input).toEqual({ amount: 7 });
    expect(restarted?.starterId).toBe('author-2');
    expect(previous?.phase).toBe(Phase.Faulted);
  });

  it('an_instance_that_has_not_ended_is_not_restarted', () => {
    const workflow = Workflow.register(name);
    const version = published(workflow);
    const started = workflow.startInstance({
      version,
      input: null,
      trigger: TriggerKind.Manual,
      starterId: null,
      originId: null,
      now,
    });
    const previous = started.ok ? started.value : null;

    const result = workflow.restartInstance({
      previous: previous!,
      version,
      starterId: 'author-1',
      now,
    });

    expect(result).toEqual({ ok: false, failure: InstanceRefusal.NotEnded });
  });
});

describe('Workflow on and off', () => {
  const changed = { kind: WorkflowEventKind.ScheduleChanged, workflowId: '' };

  function changes(workflow: Workflow) {
    return workflow.events.map((event) => event.kind);
  }

  it('a_registered_workflow_is_off', () => {
    const workflow = Workflow.register(name);

    expect(workflow.on).toBe(false);
  });

  it('turning_on_tells_the_engine_once_and_again_is_a_no_op', () => {
    const workflow = Workflow.register(name);
    published(workflow);

    const first = workflow.turnOn();
    const second = workflow.turnOn();

    expect(first).toEqual({ ok: true, value: true });
    expect(second).toEqual({ ok: true, value: false });
    expect(workflow.on).toBe(true);
    expect(changes(workflow)).toEqual([changed.kind]);
  });

  it('an_archived_workflow_refuses_to_turn_on', () => {
    const workflow = Workflow.register(name);
    published(workflow);
    workflow.archive(now);

    expect(workflow.turnOn()).toEqual({
      ok: false,
      failure: WorkflowRefusal.Archived,
    });
    expect(workflow.on).toBe(false);
  });

  it('archiving_turns_a_workflow_off', () => {
    const workflow = Workflow.register(name);
    published(workflow);
    workflow.turnOn();
    workflow.clearEvents();

    workflow.archive(now);

    expect(workflow.on).toBe(false);
    expect(changes(workflow)).toEqual([changed.kind]);
  });

  it('turning_off_a_workflow_that_is_off_changes_nothing', () => {
    const workflow = Workflow.register(name);

    expect(workflow.turnOff()).toBe(false);
    expect(workflow.events).toEqual([]);
  });

  it('a_new_version_of_a_workflow_that_is_on_changes_its_schedule', () => {
    const workflow = Workflow.register(name);
    published(workflow);
    workflow.turnOn();
    workflow.clearEvents();

    published(workflow, '2.0.0');

    expect(changes(workflow)).toEqual([changed.kind]);
  });

  it('a_new_version_of_a_workflow_that_is_off_changes_no_schedule', () => {
    const workflow = Workflow.register(name);

    published(workflow);

    expect(workflow.events).toEqual([]);
  });

  it('a_schedule_starts_an_instance_of_the_current_version_named_by_its_occurrence', () => {
    const workflow = Workflow.register(name);
    const version = published(workflow);
    workflow.turnOn();

    const started = workflow.startScheduledInstance({
      instanceId: 'occurrence-1',
      version,
      input: {},
      trigger: TriggerKind.Schedule,
      chained: false,
      chainRunning: false,
      lifecycleOf: null,
      now,
    });

    expect(started.ok && started.value?.id).toBe('occurrence-1');
    expect(started.ok && started.value?.trigger).toBe(TriggerKind.Schedule);
  });

  it('a_workflow_that_is_off_starts_nothing_by_itself', () => {
    const workflow = Workflow.register(name);
    const version = published(workflow);

    const started = workflow.startScheduledInstance({
      instanceId: null,
      version,
      input: {},
      trigger: TriggerKind.Event,
      chained: false,
      chainRunning: false,
      lifecycleOf: null,
      now,
    });

    expect(started).toEqual({ ok: false, failure: WorkflowRefusal.Off });
  });

  it('an_occurrence_of_an_earlier_versions_schedule_starts_nothing', () => {
    const workflow = Workflow.register(name);
    const earlier = published(workflow);
    published(workflow, '2.0.0');
    workflow.turnOn();

    const started = workflow.startScheduledInstance({
      instanceId: null,
      version: earlier,
      input: {},
      trigger: TriggerKind.Schedule,
      chained: false,
      chainRunning: false,
      lifecycleOf: null,
      now: later,
    });

    expect(started).toEqual({ ok: false, failure: WorkflowRefusal.Off });
  });

  it('a_link_of_an_after_chain_starts_none_while_the_schedules_instance_runs', () => {
    const workflow = Workflow.register(name);
    const version = published(workflow);
    workflow.turnOn();

    const started = workflow.startScheduledInstance({
      instanceId: null,
      version,
      input: {},
      trigger: TriggerKind.Schedule,
      chained: true,
      chainRunning: true,
      lifecycleOf: null,
      now,
    });

    expect(started).toEqual({ ok: true, value: null });
  });

  it('only_a_workflow_that_is_on_has_a_scheduled_version', () => {
    const workflow = Workflow.register(name);
    const version = published(workflow);

    const off = workflow.scheduledVersionId;
    workflow.turnOn();

    expect(off).toBeNull();
    expect(workflow.scheduledVersionId).toBe(version.id);
  });

  it('a_lifecycle_event_of_its_own_instances_starts_nothing', () => {
    const workflow = Workflow.register(name);
    const version = published(workflow);
    workflow.turnOn();

    const own = workflow.startScheduledInstance({
      instanceId: null,
      version,
      input: [],
      trigger: TriggerKind.Event,
      chained: false,
      chainRunning: false,
      lifecycleOf: workflow.id,
      now,
    });
    const other = workflow.startScheduledInstance({
      instanceId: null,
      version,
      input: [],
      trigger: TriggerKind.Event,
      chained: false,
      chainRunning: false,
      lifecycleOf: 'another-workflow',
      now,
    });

    expect(own).toEqual({ ok: true, value: null });
    expect(other.ok && other.value?.trigger).toBe(TriggerKind.Event);
  });
});
