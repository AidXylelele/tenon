import { TriggerKind } from "../../../../../src/domain/automation/instances/enums.js";
import {
  WorkflowEventKind,
  WorkflowRefusal,
} from "../../../../../src/domain/automation/workflows/enums.js";
import { Workflow } from "../../../../../src/domain/automation/workflows/workflow.js";
import { WorkflowName } from "../../../../../src/domain/automation/workflows/workflow-name.js";
import type { WorkflowVersion } from "../../../../../src/domain/automation/workflows/workflow-version.js";
import { aDefinition } from "../../../../support/builders.js";

const now = new Date("2026-11-03T10:00:00.000Z");
const later = new Date("2026-11-03T11:00:00.000Z");
const name = new WorkflowName("sales", "route-lead");

function published(workflow: Workflow, version = "1.0.0"): WorkflowVersion {
  const header = {
    namespace: workflow.name.namespace,
    name: workflow.name.name,
    version,
  };
  const definition = aDefinition(header, `content-${version}`);
  const result = workflow.publish({
    definition,
    source: null,
    publisherId: "author-1",
    now,
  });

  if (!result.ok) throw new Error(result.failure);

  return result.value.version;
}

describe("Workflow on and off", () => {
  const changed = { kind: WorkflowEventKind.ScheduleChanged, workflowId: "" };

  function changes(workflow: Workflow) {
    return workflow.events.map((event) => event.kind);
  }

  it("a_registered_workflow_is_off", () => {
    const workflow = Workflow.register(name);

    expect(workflow.on).toBe(false);
  });

  it("turning_on_tells_the_engine_once_and_again_is_a_no_op", () => {
    const workflow = Workflow.register(name);
    published(workflow);

    const first = workflow.turnOn();
    const second = workflow.turnOn();

    expect(first).toEqual({ ok: true, value: true });
    expect(second).toEqual({ ok: true, value: false });
    expect(workflow.on).toBe(true);
    expect(changes(workflow)).toEqual([changed.kind]);
  });

  it("a_workflow_never_published_refuses_to_turn_on", () => {
    const workflow = Workflow.register(name);

    const turned = workflow.turnOn();

    expect(turned).toEqual({ ok: false, failure: WorkflowRefusal.Unpublished });
    expect(workflow.on).toBe(false);
    expect(workflow.events).toEqual([]);
  });

  it("an_archived_workflow_refuses_to_turn_on", () => {
    const workflow = Workflow.register(name);
    published(workflow);
    workflow.archive(now);

    expect(workflow.turnOn()).toEqual({
      ok: false,
      failure: WorkflowRefusal.Archived,
    });
    expect(workflow.on).toBe(false);
  });

  it("archiving_turns_a_workflow_off", () => {
    const workflow = Workflow.register(name);
    published(workflow);
    workflow.turnOn();
    workflow.clearEvents();

    workflow.archive(now);

    expect(workflow.on).toBe(false);
    expect(changes(workflow)).toEqual([changed.kind]);
  });

  it("turning_off_a_workflow_that_is_off_changes_nothing", () => {
    const workflow = Workflow.register(name);

    expect(workflow.turnOff()).toBe(false);
    expect(workflow.events).toEqual([]);
  });

  it("a_new_version_of_a_workflow_that_is_on_changes_its_schedule", () => {
    const workflow = Workflow.register(name);
    published(workflow);
    workflow.turnOn();
    workflow.clearEvents();

    published(workflow, "2.0.0");

    expect(changes(workflow)).toEqual([changed.kind]);
  });

  it("a_new_version_of_a_workflow_that_is_off_changes_no_schedule", () => {
    const workflow = Workflow.register(name);

    published(workflow);

    expect(workflow.events).toEqual([]);
  });

  it("a_schedule_starts_an_instance_of_the_current_version_named_by_its_occurrence", () => {
    const workflow = Workflow.register(name);
    const version = published(workflow);
    workflow.turnOn();

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

  it("a_link_of_an_after_chain_starts_none_while_the_schedules_instance_runs", () => {
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

    expect(started).toEqual({
      ok: false,
      failure: WorkflowRefusal.ChainRunning,
    });
  });

  it("only_a_workflow_that_is_on_has_a_scheduled_version", () => {
    const workflow = Workflow.register(name);
    const version = published(workflow);

    const off = workflow.scheduledVersion;
    workflow.turnOn();

    expect(off).toBeNull();
    expect(workflow.scheduledVersion).toBe(version);
  });

  it("a_lifecycle_event_of_its_own_instances_starts_nothing", () => {
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
      lifecycleOf: "another-workflow",
      now,
    });

    expect(own).toEqual({ ok: false, failure: WorkflowRefusal.OwnLifecycle });
    expect(other.ok && other.value.trigger).toBe(TriggerKind.Event);
  });
});
