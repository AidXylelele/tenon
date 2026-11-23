import {
  Phase,
  TriggerKind,
} from "../../../../../src/domain/automation/instances/enums.js";
import {
  ScheduleKind,
  WorkflowEventKind,
  WorkflowRefusal,
} from "../../../../../src/domain/automation/workflows/enums.js";
import type { ScheduleSpec } from "../../../../../src/domain/automation/workflows/interfaces.js";
import { Schedule } from "../../../../../src/domain/automation/workflows/schedule.js";
import { Workflow } from "../../../../../src/domain/automation/workflows/workflow.js";
import { WorkflowName } from "../../../../../src/domain/automation/workflows/workflow-name.js";
import type { WorkflowVersion } from "../../../../../src/domain/automation/workflows/workflow-version.js";
import { aDefinition } from "../../../../support/builders.js";
import { anInstanceIn } from "../../../../support/fakes.js";

const now = new Date("2026-11-03T10:00:00.000Z");
const later = new Date("2026-11-03T11:00:00.000Z");
const name = new WorkflowName("sales", "route-lead");

const MINUTE = 60_000;
const EVERY_MINUTE: ScheduleSpec = {
  kind: ScheduleKind.Every,
  interval: MINUTE,
};

function published(
  workflow: Workflow,
  version = "1.0.0",
  spec: ScheduleSpec | null = EVERY_MINUTE,
): WorkflowVersion {
  const header = {
    namespace: workflow.name.namespace,
    name: workflow.name.name,
    version,
  };
  const schedule = spec === null ? null : new Schedule(spec);
  const definition = aDefinition(header, `content-${version}`, schedule);
  const result = workflow.publish({
    definition,
    source: null,
    publisherId: "author-1",
    now,
  });

  if (!result.ok) throw new Error(result.failure);

  return result.value.version;
}

function armed(workflow: Workflow) {
  return workflow.events
    .filter((event) => event.kind === WorkflowEventKind.ScheduleArmed)
    .map((event) => [event.arming, event.at]);
}

describe("Workflow on and off", () => {
  it("a_registered_workflow_is_off", () => {
    const workflow = Workflow.register(name);

    expect(workflow.on).toBe(false);
  });

  it("turning_on_arms_its_schedule_at_its_next_slot_once", () => {
    const workflow = Workflow.register(name);
    published(workflow);

    const first = workflow.turnOn(now);
    const second = workflow.turnOn(later);

    expect(first).toEqual({ ok: true, value: true });
    expect(second).toEqual({ ok: true, value: false });
    expect(workflow.on).toBe(true);
    expect(workflow.scheduledSince).toEqual(now);
    expect(workflow.events).toEqual([
      {
        kind: WorkflowEventKind.ScheduleArmed,
        workflowId: workflow.id,
        arming: 1,
        at: now.getTime() + MINUTE,
      },
    ]);
  });

  it("a_workflow_never_published_refuses_to_turn_on", () => {
    const workflow = Workflow.register(name);

    const turned = workflow.turnOn(now);

    expect(turned).toEqual({ ok: false, failure: WorkflowRefusal.Unpublished });
    expect(workflow.on).toBe(false);
    expect(workflow.events).toEqual([]);
  });

  it("an_archived_workflow_refuses_to_turn_on", () => {
    const workflow = Workflow.register(name);
    published(workflow);
    workflow.archive(now);

    expect(workflow.turnOn(now)).toEqual({
      ok: false,
      failure: WorkflowRefusal.Archived,
    });
    expect(workflow.on).toBe(false);
  });

  it("archiving_turns_a_workflow_off_and_leaves_its_armed_slot_stale", () => {
    const workflow = Workflow.register(name);
    published(workflow);
    workflow.turnOn(now);
    workflow.clearEvents();

    workflow.archive(now);

    expect(workflow.on).toBe(false);
    expect(workflow.arming).toBe(2);
    expect(workflow.scheduledSince).toBeNull();
    expect(workflow.events).toEqual([]);
  });

  it("turning_off_a_workflow_that_is_off_changes_nothing", () => {
    const workflow = Workflow.register(name);

    expect(workflow.turnOff()).toBe(false);
    expect(workflow.arming).toBe(0);
  });

  it("a_new_version_of_a_workflow_that_is_on_arms_its_own_schedule", () => {
    const workflow = Workflow.register(name);
    published(workflow);
    workflow.turnOn(now);
    workflow.clearEvents();

    published(workflow, "2.0.0");

    expect(armed(workflow)).toEqual([[2, now.getTime() + MINUTE]]);
  });

  it("a_new_version_of_a_workflow_that_is_off_arms_nothing", () => {
    const workflow = Workflow.register(name);

    published(workflow);

    expect(workflow.events).toEqual([]);
  });

  it("a_version_without_a_schedule_arms_nothing_when_turned_on", () => {
    const workflow = Workflow.register(name);
    published(workflow, "1.0.0", null);

    workflow.turnOn(now);

    expect(workflow.events).toEqual([]);
  });
});

describe("Workflow firing its schedule", () => {
  function scheduled(spec: ScheduleSpec = EVERY_MINUTE): Workflow {
    const workflow = Workflow.register(name);
    published(workflow, "1.0.0", spec);
    workflow.turnOn(now);
    workflow.clearEvents();
    return workflow;
  }

  function fireOf(arming: number, at: Date) {
    return { arming, at: at.getTime(), now: at };
  }

  it("a_fire_records_the_fired_slot_and_arms_the_next", () => {
    const workflow = scheduled();
    const slot = new Date(now.getTime() + MINUTE);
    const fire = fireOf(1, slot);

    const fired = workflow.fireSchedule(fire);

    expect(fired).toEqual({ ok: true, value: undefined });
    expect(workflow.events).toEqual([
      {
        kind: WorkflowEventKind.ScheduleFired,
        workflowId: workflow.id,
        arming: 1,
        at: slot.getTime(),
      },
      {
        kind: WorkflowEventKind.ScheduleArmed,
        workflowId: workflow.id,
        arming: 2,
        at: slot.getTime() + MINUTE,
      },
    ]);
  });

  it("a_fire_repeated_after_it_fired_is_stale", () => {
    const workflow = scheduled();
    const slot = new Date(now.getTime() + MINUTE);
    const fire = fireOf(1, slot);
    workflow.fireSchedule(fire);

    const again = workflow.fireSchedule(fire);

    expect(again).toEqual({
      ok: false,
      failure: WorkflowRefusal.ScheduleStale,
    });
  });

  it("a_late_fire_records_its_slot_once_and_arms_the_first_slot_after_now", () => {
    const workflow = scheduled();
    const slot = new Date(now.getTime() + MINUTE);
    const late = new Date(now.getTime() + 10 * MINUTE + 1);
    const fire = { arming: 1, at: slot.getTime(), now: late };

    workflow.fireSchedule(fire);

    expect(armed(workflow)).toEqual([[2, now.getTime() + 11 * MINUTE]]);
  });

  it("a_fire_of_a_workflow_turned_off_is_stale", () => {
    const workflow = scheduled();
    workflow.turnOff();
    const fire = fireOf(1, now);

    const fired = workflow.fireSchedule(fire);

    expect(fired).toEqual({
      ok: false,
      failure: WorkflowRefusal.ScheduleStale,
    });
  });

  it("a_fired_slot_starts_a_scheduled_instance_of_the_current_version", () => {
    const workflow = scheduled();
    const start = { instanceId: "slot-1", chainRunning: false, now };

    const started = workflow.startFiredInstance(start);

    expect(started.ok && started.value.id).toBe("slot-1");
    expect(started.ok && started.value.trigger).toBe(TriggerKind.Schedule);
  });

  it("an_after_chain_fires_at_once_and_continues_its_delay_after_a_completed_link", () => {
    const after: ScheduleSpec = { kind: ScheduleKind.After, delay: MINUTE };
    const workflow = Workflow.register(name);
    published(workflow, "1.0.0", after);
    workflow.turnOn(now);
    const first = armed(workflow);
    workflow.clearEvents();
    const fire = fireOf(1, now);
    workflow.fireSchedule(fire);
    const refired = armed(workflow);
    workflow.clearEvents();
    const link = anInstanceIn(Phase.Completed, {
      workflowId: workflow.id,
      trigger: TriggerKind.Schedule,
    });

    const continued = workflow.continueSchedule(link, later);

    expect(first).toEqual([[1, now.getTime()]]);
    expect(refired).toEqual([]);
    expect(continued).toBe(true);
    expect(armed(workflow)).toEqual([[3, later.getTime() + MINUTE]]);
  });

  it("an_after_chain_starts_no_second_link_while_one_runs", () => {
    const after: ScheduleSpec = { kind: ScheduleKind.After, delay: MINUTE };
    const workflow = scheduled(after);
    const start = { instanceId: "slot-1", chainRunning: true, now };

    const started = workflow.startFiredInstance(start);

    expect(started).toEqual({
      ok: false,
      failure: WorkflowRefusal.ChainRunning,
    });
  });

  it("a_workflow_turned_off_starts_no_fired_slot", () => {
    const workflow = scheduled();
    workflow.turnOff();
    const start = { instanceId: "slot-1", chainRunning: false, now };

    const started = workflow.startFiredInstance(start);

    expect(started).toEqual({ ok: false, failure: WorkflowRefusal.Off });
  });

  it("a_repeating_schedule_is_not_continued_by_its_instances", () => {
    const workflow = scheduled();
    const link = anInstanceIn(Phase.Completed, {
      workflowId: workflow.id,
      trigger: TriggerKind.Schedule,
    });

    const continued = workflow.continueSchedule(link, later);

    expect(continued).toBe(false);
    expect(workflow.arming).toBe(1);
  });

  it("an_unarmed_schedule_is_armed_again_on_start_up", () => {
    const workflow = scheduled();

    const rearmed = workflow.armSchedule(later);

    expect(rearmed).toBe(true);
    expect(armed(workflow)).toEqual([[2, later.getTime() + MINUTE]]);
  });
});

describe("Workflow starting instances by itself", () => {
  it("a_schedule_starts_an_instance_of_the_current_version_named_by_its_occurrence", () => {
    const workflow = Workflow.register(name);
    const version = published(workflow);
    workflow.turnOn(now);

    const started = workflow.startScheduledInstance({
      instanceId: "occurrence-1",
      version,
      input: {},
      trigger: TriggerKind.Schedule,
      chained: false,
      chainRunning: false,
      lifecycleOf: null,
      now,
    });

    expect(started.ok && started.value.id).toBe("occurrence-1");
    expect(started.ok && started.value.trigger).toBe(TriggerKind.Schedule);
  });

  it("a_workflow_that_is_off_starts_nothing_by_itself", () => {
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

  it("an_occurrence_of_an_earlier_versions_schedule_starts_nothing", () => {
    const workflow = Workflow.register(name);
    const earlier = published(workflow);
    published(workflow, "2.0.0");
    workflow.turnOn(now);

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

  it("a_link_of_an_after_chain_starts_none_while_the_schedules_instance_runs", () => {
    const workflow = Workflow.register(name);
    const version = published(workflow);
    workflow.turnOn(now);

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

    expect(started).toEqual({
      ok: false,
      failure: WorkflowRefusal.ChainRunning,
    });
  });

  it("only_a_workflow_that_is_on_has_a_scheduled_version", () => {
    const workflow = Workflow.register(name);
    const version = published(workflow);

    const off = workflow.scheduledVersion;
    workflow.turnOn(now);

    expect(off).toBeNull();
    expect(workflow.scheduledVersion).toBe(version);
  });

  it("a_lifecycle_event_of_its_own_instances_starts_nothing", () => {
    const workflow = Workflow.register(name);
    const version = published(workflow);
    workflow.turnOn(now);

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
      lifecycleOf: "another-workflow",
      now,
    });

    expect(own).toEqual({ ok: false, failure: WorkflowRefusal.OwnLifecycle });
    expect(other.ok && other.value.trigger).toBe(TriggerKind.Event);
  });
});
