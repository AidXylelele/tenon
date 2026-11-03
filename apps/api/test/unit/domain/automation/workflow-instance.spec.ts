import {
  InstanceEventKind,
  InstanceRefusal,
  Phase,
  RunDirective,
  TriggerKind,
} from '../../../../src/domain/automation/instances/enums.js';
import type { WorkflowInstanceProps } from '../../../../src/domain/automation/instances/interfaces.js';
import { WorkflowInstance } from '../../../../src/domain/automation/instances/workflow-instance.js';

const now = new Date('2026-11-03T10:00:00.000Z');
const later = new Date('2026-11-03T10:05:00.000Z');

function anInstance(phase: Phase = Phase.Pending): WorkflowInstance {
  const props: WorkflowInstanceProps = {
    id: 'instance-1',
    workflowId: 'workflow-1',
    versionId: 'version-1',
    trigger: TriggerKind.Manual,
    starterId: 'author-1',
    originId: null,
    input: { amount: 1 },
    phase,
    output: null,
    error: null,
    createdAt: now,
    startedAt: null,
    endedAt: null,
    waiting: false,
    version: 3,
  };
  return new WorkflowInstance(props);
}

describe('WorkflowInstance', () => {
  it('beginning_runs_a_pending_instance_once', () => {
    const instance = anInstance();

    instance.begin(now);
    instance.begin(later);

    expect(instance.phase).toBe(Phase.Running);
    expect(instance.startedAt).toBe(now);
  });

  it('a_wait_takes_a_running_instance_to_waiting_and_back', () => {
    const instance = anInstance(Phase.Running);

    instance.beginWaiting();
    expect(instance.phase).toBe(Phase.Waiting);

    instance.endWaiting();
    expect(instance.phase).toBe(Phase.Running);
  });

  it('completing_keeps_the_output_and_the_end', () => {
    const instance = anInstance(Phase.Running);

    instance.complete({ routed: true }, later);

    expect(instance.phase).toBe(Phase.Completed);
    expect(instance.output).toEqual({ routed: true });
    expect(instance.endedAt).toBe(later);
    expect(instance.ended).toBe(true);
  });

  it('an_outcome_after_the_end_is_ignored_so_the_first_one_wins', () => {
    const instance = anInstance(Phase.Running);
    instance.cancel(now);

    instance.complete({ late: true }, later);
    instance.fault({ type: 'late' }, later);

    expect(instance.phase).toBe(Phase.Cancelled);
    expect(instance.output).toBeNull();
    expect(instance.error).toBeNull();
    expect(instance.endedAt).toBe(now);
  });

  it('faulting_keeps_the_error', () => {
    const instance = anInstance(Phase.Running);

    instance.fault({ type: 'communication', status: 503 }, later);

    expect(instance.phase).toBe(Phase.Faulted);
    expect(instance.error).toEqual({ type: 'communication', status: 503 });
  });

  it.each([Phase.Pending, Phase.Running, Phase.Waiting, Phase.Suspended])(
    'cancelling_a_%s_instance_ends_it_and_tells_the_engine',
    (phase) => {
      const instance = anInstance(phase);

      const result = instance.cancel(later);

      expect(result.ok).toBe(true);
      expect(instance.phase).toBe(Phase.Cancelled);
      expect(instance.endedAt).toBe(later);
      expect(instance.events).toEqual([
        { kind: InstanceEventKind.Cancelled, instanceId: 'instance-1' },
      ]);
    },
  );

  it.each([Phase.Completed, Phase.Faulted, Phase.Cancelled])(
    'a_%s_instance_refuses_a_cancel',
    (phase) => {
      const instance = anInstance(phase);

      const result = instance.cancel(later);

      expect(result).toEqual({ ok: false, failure: InstanceRefusal.Ended });
      expect(instance.phase).toBe(phase);
      expect(instance.events).toEqual([]);
    },
  );

  it.each([Phase.Running, Phase.Waiting])(
    'a_%s_instance_is_suspended_and_the_runtime_is_told_to_wait',
    (phase) => {
      const instance = anInstance(phase);

      const result = instance.suspend();

      expect(result.ok).toBe(true);
      expect(instance.phase).toBe(Phase.Suspended);
      expect(instance.directive()).toBe(RunDirective.Suspend);
    },
  );

  it.each([Phase.Pending, Phase.Suspended, Phase.Completed])(
    'a_%s_instance_refuses_a_suspend',
    (phase) => {
      const instance = anInstance(phase);

      expect(instance.suspend()).toEqual({
        ok: false,
        failure: InstanceRefusal.NotRunning,
      });
    },
  );

  it('resuming_runs_a_suspended_instance_and_tells_the_engine', () => {
    const instance = anInstance(Phase.Suspended);

    const result = instance.resume();

    expect(result.ok).toBe(true);
    expect(instance.phase).toBe(Phase.Running);
    expect(instance.events).toEqual([
      { kind: InstanceEventKind.Resumed, instanceId: 'instance-1' },
    ]);
  });

  it('only_a_suspended_instance_resumes', () => {
    const instance = anInstance(Phase.Running);

    expect(instance.resume()).toEqual({
      ok: false,
      failure: InstanceRefusal.NotSuspended,
    });
  });

  it('the_runtime_goes_on_until_the_instance_ends', () => {
    const running = anInstance(Phase.Running);
    const ended = anInstance(Phase.Completed);

    expect(running.directive()).toBe(RunDirective.Continue);
    expect(ended.directive()).toBe(RunDirective.Stop);
  });

  it('only_an_ended_instance_is_deleted', () => {
    const running = anInstance(Phase.Running);
    const ended = anInstance(Phase.Faulted);

    expect(running.delete()).toEqual({
      ok: false,
      failure: InstanceRefusal.NotEnded,
    });
    expect(ended.delete().ok).toBe(true);
    expect(ended.events).toEqual([
      { kind: InstanceEventKind.Deleted, instanceId: 'instance-1' },
    ]);
  });

  it('clearing_the_events_forgets_what_was_told', () => {
    const instance = anInstance(Phase.Running);
    instance.cancel(now);

    instance.clearEvents();

    expect(instance.events).toEqual([]);
  });
});
