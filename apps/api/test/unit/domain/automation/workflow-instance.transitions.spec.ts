import {
  InstanceEventKind,
  InstanceRefusal,
  Phase,
  RunDirective,
} from '../../../../src/domain/automation/instances/enums.js';
import { anInstanceIn, T0 } from '../../../support/qa-fakes.js';

const later = new Date('2026-11-03T10:05:00.000Z');
const ALL = [
  Phase.Pending,
  Phase.Running,
  Phase.Waiting,
  Phase.Suspended,
  Phase.Cancelled,
  Phase.Faulted,
  Phase.Completed,
];
const ENDED = [Phase.Cancelled, Phase.Faulted, Phase.Completed];
const OPEN = [Phase.Pending, Phase.Running, Phase.Waiting, Phase.Suspended];

function told(kind: InstanceEventKind) {
  return { kind, instanceId: 'instance-1' };
}

const startedEvent = told(InstanceEventKind.Started);

describe('WorkflowInstance transitions: the runtime facts', () => {
  it.each([
    [Phase.Pending, Phase.Running],
    [Phase.Running, Phase.Running],
    [Phase.Waiting, Phase.Waiting],
    [Phase.Suspended, Phase.Suspended],
    [Phase.Cancelled, Phase.Cancelled],
    [Phase.Faulted, Phase.Faulted],
    [Phase.Completed, Phase.Completed],
  ])('beginning_a_%s_instance_leaves_it_%s', (from, to) => {
    const instance = anInstanceIn(from);
    const startedBefore = instance.startedAt;

    instance.begin(later);

    const begun = from === Phase.Pending;
    const startedAt = begun ? later : startedBefore;
    const told = begun ? [startedEvent] : [];
    expect(instance.phase).toBe(to);
    expect(instance.startedAt).toBe(startedAt);
    expect(instance.events).toEqual(told);
  });

  it('beginning_twice_keeps_the_first_start_and_tells_it_once', () => {
    const instance = anInstanceIn(Phase.Pending);

    instance.begin(T0);
    instance.begin(later);

    expect(instance.phase).toBe(Phase.Running);
    expect(instance.startedAt).toBe(T0);
    expect(instance.events).toEqual([startedEvent]);
  });

  it.each([
    [Phase.Pending, Phase.Pending],
    [Phase.Running, Phase.Waiting],
    [Phase.Waiting, Phase.Waiting],
    [Phase.Suspended, Phase.Suspended],
    [Phase.Cancelled, Phase.Cancelled],
    [Phase.Faulted, Phase.Faulted],
    [Phase.Completed, Phase.Completed],
  ])('a_wait_that_begins_on_a_%s_instance_leaves_it_%s', (from, to) => {
    const instance = anInstanceIn(from);

    instance.beginWaiting();

    expect(instance.phase).toBe(to);
    expect(instance.events).toEqual([]);
  });

  it.each([
    [Phase.Pending, Phase.Pending],
    [Phase.Running, Phase.Running],
    [Phase.Waiting, Phase.Running],
    [Phase.Suspended, Phase.Suspended],
    [Phase.Cancelled, Phase.Cancelled],
    [Phase.Faulted, Phase.Faulted],
    [Phase.Completed, Phase.Completed],
  ])('a_wait_that_ends_on_a_%s_instance_leaves_it_%s', (from, to) => {
    const instance = anInstanceIn(from);

    instance.endWaiting();

    expect(instance.phase).toBe(to);
    expect(instance.events).toEqual([]);
  });

  it.each(OPEN)(
    'completing_a_%s_instance_ends_it_and_tells_it_once',
    (from) => {
      const instance = anInstanceIn(from);

      instance.complete({ routed: true }, later);

      expect(instance.phase).toBe(Phase.Completed);
      expect(instance.output).toEqual({ routed: true });
      expect(instance.error).toBeNull();
      expect(instance.endedAt).toBe(later);
      expect(instance.ended).toBe(true);
      expect(instance.events).toEqual([told(InstanceEventKind.Completed)]);
    },
  );

  it.each(ENDED)('completing_a_%s_instance_changes_nothing', (from) => {
    const instance = anInstanceIn(from);

    instance.complete({ late: true }, later);

    expect(instance.phase).toBe(from);
    expect(instance.output).toBeNull();
    expect(instance.endedAt).toBe(T0);
    expect(instance.events).toEqual([]);
  });

  it.each(OPEN)('faulting_a_%s_instance_ends_it_and_tells_it_once', (from) => {
    const instance = anInstanceIn(from);

    instance.fault({ type: 'runtime' }, later);

    expect(instance.phase).toBe(Phase.Faulted);
    expect(instance.error).toEqual({ type: 'runtime' });
    expect(instance.output).toBeNull();
    expect(instance.endedAt).toBe(later);
    expect(instance.events).toEqual([told(InstanceEventKind.Faulted)]);
  });

  it.each(ENDED)('faulting_a_%s_instance_changes_nothing', (from) => {
    const instance = anInstanceIn(from);

    instance.fault({ type: 'late' }, later);

    expect(instance.phase).toBe(from);
    expect(instance.error).toBeNull();
    expect(instance.endedAt).toBe(T0);
    expect(instance.events).toEqual([]);
  });

  it('a_fault_after_a_completion_is_ignored', () => {
    const instance = anInstanceIn(Phase.Running);
    instance.complete({ first: true }, T0);

    instance.fault({ type: 'late' }, later);

    expect(instance.phase).toBe(Phase.Completed);
    expect(instance.output).toEqual({ first: true });
    expect(instance.error).toBeNull();
    expect(instance.endedAt).toBe(T0);
    expect(instance.events).toEqual([told(InstanceEventKind.Completed)]);
  });

  it('a_second_completion_keeps_the_first_output', () => {
    const instance = anInstanceIn(Phase.Running);
    instance.complete({ first: true }, T0);

    instance.complete({ second: true }, later);

    expect(instance.output).toEqual({ first: true });
    expect(instance.endedAt).toBe(T0);
    expect(instance.events).toEqual([told(InstanceEventKind.Completed)]);
  });

  it('a_second_fault_keeps_the_first_error', () => {
    const instance = anInstanceIn(Phase.Running);
    instance.fault({ type: 'first' }, T0);

    instance.fault({ type: 'second' }, later);

    expect(instance.error).toEqual({ type: 'first' });
    expect(instance.endedAt).toBe(T0);
    expect(instance.events).toEqual([told(InstanceEventKind.Faulted)]);
  });

  it('a_completion_after_a_cancel_is_ignored', () => {
    const instance = anInstanceIn(Phase.Running);
    instance.cancel(T0);

    instance.complete({ late: true }, later);

    expect(instance.phase).toBe(Phase.Cancelled);
    expect(instance.output).toBeNull();
    expect(instance.endedAt).toBe(T0);
    expect(instance.events).toEqual([told(InstanceEventKind.Cancelled)]);
  });
});

describe('WorkflowInstance transitions: the user requests', () => {
  it.each([Phase.Running, Phase.Waiting])(
    'suspending_a_%s_instance_suspends_it_and_tells_it_once',
    (from) => {
      const instance = anInstanceIn(from);

      const result = instance.suspend();

      expect(result).toEqual({ ok: true, value: undefined });
      expect(instance.phase).toBe(Phase.Suspended);
      expect(instance.endedAt).toBeNull();
      expect(instance.events).toEqual([told(InstanceEventKind.Suspended)]);
    },
  );

  it.each([
    Phase.Pending,
    Phase.Suspended,
    Phase.Cancelled,
    Phase.Faulted,
    Phase.Completed,
  ])('a_%s_instance_refuses_a_suspend_and_stays_as_it_was', (from) => {
    const instance = anInstanceIn(from);

    const result = instance.suspend();

    expect(result).toEqual({ ok: false, failure: InstanceRefusal.NotRunning });
    expect(instance.phase).toBe(from);
    expect(instance.events).toEqual([]);
  });

  it('a_suspended_running_instance_resumes_running_and_tells_the_engine_once', () => {
    const instance = anInstanceIn(Phase.Running);
    instance.suspend();

    const result = instance.resume();

    expect(result).toEqual({ ok: true, value: undefined });
    expect(instance.phase).toBe(Phase.Running);
    expect(instance.events).toEqual([
      told(InstanceEventKind.Suspended),
      told(InstanceEventKind.Resumed),
    ]);
  });

  // DEFECT: data-model.md §8 says "suspended -> running or waiting | resume"; resume() always
  // answers running, so an instance suspended during a wait reads running while it still waits.
  it('an_instance_suspended_while_waiting_resumes_waiting', () => {
    const instance = anInstanceIn(Phase.Waiting);
    instance.suspend();

    instance.resume();

    expect(instance.phase).toBe(Phase.Waiting);
  });

  it.each([
    Phase.Pending,
    Phase.Running,
    Phase.Waiting,
    Phase.Cancelled,
    Phase.Faulted,
    Phase.Completed,
  ])('a_%s_instance_refuses_a_resume_and_stays_as_it_was', (from) => {
    const instance = anInstanceIn(from);

    const result = instance.resume();

    expect(result).toEqual({
      ok: false,
      failure: InstanceRefusal.NotSuspended,
    });
    expect(instance.phase).toBe(from);
    expect(instance.events).toEqual([]);
  });

  it('a_second_resume_is_refused_and_tells_nothing_more', () => {
    const instance = anInstanceIn(Phase.Suspended);
    instance.resume();

    const again = instance.resume();

    expect(again).toEqual({ ok: false, failure: InstanceRefusal.NotSuspended });
    expect(instance.events).toHaveLength(1);
  });

  it.each(OPEN)('cancelling_a_%s_instance_ends_it_and_tells_once', (from) => {
    const instance = anInstanceIn(from);

    const result = instance.cancel(later);

    expect(result).toEqual({ ok: true, value: undefined });
    expect(instance.phase).toBe(Phase.Cancelled);
    expect(instance.endedAt).toBe(later);
    expect(instance.output).toBeNull();
    expect(instance.error).toBeNull();
    expect(instance.events).toEqual([
      { kind: InstanceEventKind.Cancelled, instanceId: 'instance-1' },
    ]);
  });

  it.each(ENDED)(
    'a_%s_instance_refuses_a_cancel_and_stays_as_it_was',
    (from) => {
      const instance = anInstanceIn(from);

      const result = instance.cancel(later);

      expect(result).toEqual({ ok: false, failure: InstanceRefusal.Ended });
      expect(instance.phase).toBe(from);
      expect(instance.endedAt).toBe(T0);
      expect(instance.events).toEqual([]);
    },
  );

  it('a_second_cancel_is_refused_and_tells_nothing_more', () => {
    const instance = anInstanceIn(Phase.Running);
    instance.cancel(T0);

    const again = instance.cancel(later);

    expect(again).toEqual({ ok: false, failure: InstanceRefusal.Ended });
    expect(instance.endedAt).toBe(T0);
    expect(instance.events).toHaveLength(1);
  });

  it('a_cancelled_pending_instance_never_begins', () => {
    const instance = anInstanceIn(Phase.Pending);
    instance.cancel(T0);

    instance.begin(later);

    expect(instance.phase).toBe(Phase.Cancelled);
    expect(instance.startedAt).toBeNull();
    expect(instance.directive()).toBe(RunDirective.Stop);
  });

  it.each(ENDED)('a_%s_instance_is_deleted_and_tells_the_engine', (from) => {
    const instance = anInstanceIn(from);

    const result = instance.delete();

    expect(result).toEqual({ ok: true, value: undefined });
    expect(instance.phase).toBe(from);
    expect(instance.events).toEqual([
      { kind: InstanceEventKind.Deleted, instanceId: 'instance-1' },
    ]);
  });

  it.each(OPEN)('a_%s_instance_refuses_a_delete', (from) => {
    const instance = anInstanceIn(from);

    const result = instance.delete();

    expect(result).toEqual({ ok: false, failure: InstanceRefusal.NotEnded });
    expect(instance.events).toEqual([]);
  });

  // DEFECT (low): delete() is neither refused nor idempotent the second time; the same deletion
  // is told to the engine twice.
  it('deleting_twice_tells_the_engine_once', () => {
    const instance = anInstanceIn(Phase.Completed);
    instance.delete();

    instance.delete();

    expect(instance.events).toHaveLength(1);
  });
});

describe('WorkflowInstance directive and events', () => {
  it.each([
    [Phase.Pending, RunDirective.Continue],
    [Phase.Running, RunDirective.Continue],
    [Phase.Waiting, RunDirective.Continue],
    [Phase.Suspended, RunDirective.Suspend],
    [Phase.Cancelled, RunDirective.Stop],
    [Phase.Faulted, RunDirective.Stop],
    [Phase.Completed, RunDirective.Stop],
  ])('a_%s_instance_tells_the_runtime_to_%s', (phase, directive) => {
    const instance = anInstanceIn(phase);

    expect(instance.directive()).toBe(directive);
  });

  it.each(ALL)('a_%s_instance_is_ended_only_when_terminal', (phase) => {
    const instance = anInstanceIn(phase);

    const terminal = ENDED.includes(phase);
    expect(instance.ended).toBe(terminal);
  });

  it('a_suspend_and_a_resume_take_the_runtime_from_suspend_back_to_continue', () => {
    const instance = anInstanceIn(Phase.Running);

    instance.suspend();
    const held = instance.directive();
    instance.resume();
    const released = instance.directive();

    expect(held).toBe(RunDirective.Suspend);
    expect(released).toBe(RunDirective.Continue);
  });

  it('a_cancel_of_a_suspended_instance_stops_the_runtime', () => {
    const instance = anInstanceIn(Phase.Suspended);

    instance.cancel(later);

    expect(instance.directive()).toBe(RunDirective.Stop);
  });

  it('each_change_of_the_instance_is_told_in_order', () => {
    const instance = anInstanceIn(Phase.Running);

    instance.suspend();
    instance.resume();
    instance.suspend();
    instance.resume();
    instance.cancel(later);
    instance.delete();

    const kinds = instance.events.map((event) => event.kind);
    expect(kinds).toEqual([
      InstanceEventKind.Suspended,
      InstanceEventKind.Resumed,
      InstanceEventKind.Suspended,
      InstanceEventKind.Resumed,
      InstanceEventKind.Cancelled,
      InstanceEventKind.Deleted,
    ]);
  });

  it('clearing_the_events_keeps_later_ones_apart', () => {
    const instance = anInstanceIn(Phase.Suspended);
    instance.resume();
    instance.clearEvents();

    instance.cancel(later);

    expect(instance.events).toEqual([
      { kind: InstanceEventKind.Cancelled, instanceId: 'instance-1' },
    ]);
  });

  it('a_refused_request_leaves_the_events_as_they_were', () => {
    const instance = anInstanceIn(Phase.Suspended);
    instance.resume();

    instance.resume();
    instance.delete();

    expect(instance.events).toHaveLength(1);
  });

  it('a_fresh_instance_tells_nothing', () => {
    const instance = anInstanceIn(Phase.Pending);

    expect(instance.events).toEqual([]);
  });
});
