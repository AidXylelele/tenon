import { ArmSchedules } from "../../../../../src/application/automation/schedules/arm-schedules.js";
import { ContinueSchedule } from "../../../../../src/application/automation/schedules/continue-schedule.js";
import { FireSchedule } from "../../../../../src/application/automation/schedules/fire-schedule.js";
import { StartScheduledInstance } from "../../../../../src/application/automation/schedules/start-scheduled-instance.js";
import type { WorkflowQueries } from "../../../../../src/application/automation/workflows/queries.js";
import { TurnWorkflowOff } from "../../../../../src/application/automation/workflows/turn-workflow-off.js";
import { TurnWorkflowOn } from "../../../../../src/application/automation/workflows/turn-workflow-on.js";
import {
  InstanceEventKind,
  Phase,
  TriggerKind,
} from "../../../../../src/domain/automation/instances/enums.js";
import {
  ScheduleKind,
  WorkflowEventKind,
} from "../../../../../src/domain/automation/workflows/enums.js";
import type { ScheduleSpec } from "../../../../../src/domain/automation/workflows/interfaces.js";
import { Schedule } from "../../../../../src/domain/automation/workflows/schedule.js";
import { Workflow } from "../../../../../src/domain/automation/workflows/workflow.js";
import { WorkflowName } from "../../../../../src/domain/automation/workflows/workflow-name.js";
import type { WorkflowVersion } from "../../../../../src/domain/automation/workflows/workflow-version.js";
import { aDefinition } from "../../../../support/builders.js";
import {
  anInstanceIn,
  FakeUnitOfWork,
  RecordingInstanceEvents,
  RecordingWorkflowEvents,
  StoredWorkflowInstanceRepository,
  StoredWorkflowRepository,
  T0,
} from "../../../../support/fakes.js";

const unitOfWork = new FakeUnitOfWork();
const name = new WorkflowName("sales", "route-lead");
const MINUTE = 60_000;
const EVERY_MINUTE: ScheduleSpec = {
  kind: ScheduleKind.Every,
  interval: MINUTE,
};
const AFTER_A_MINUTE: ScheduleSpec = {
  kind: ScheduleKind.After,
  delay: MINUTE,
};

function setUp(unarmed: string[] = []) {
  const workflows = new StoredWorkflowRepository();
  const instances = new StoredWorkflowInstanceRepository();
  const instanceEvents = new RecordingInstanceEvents(instances);
  const workflowEvents = new RecordingWorkflowEvents();
  const queries = {
    unarmedSchedules: () => Promise.resolve(unarmed.slice()),
  } as unknown as WorkflowQueries;
  return {
    workflows,
    instances,
    instanceEvents,
    workflowEvents,
    turnOn: new TurnWorkflowOn(workflows, workflowEvents, unitOfWork),
    turnOff: new TurnWorkflowOff(workflows, workflowEvents, unitOfWork),
    fire: new FireSchedule(workflows, workflowEvents, unitOfWork),
    start: new StartScheduledInstance(
      workflows,
      instances,
      instanceEvents,
      unitOfWork,
    ),
    continued: new ContinueSchedule(
      instances,
      workflows,
      workflowEvents,
      unitOfWork,
    ),
    arm: new ArmSchedules(queries, workflows, workflowEvents, unitOfWork),
  };
}

type Fixture = ReturnType<typeof setUp>;

async function aWorkflow(
  fixture: Fixture,
  on: boolean,
  spec: ScheduleSpec = EVERY_MINUTE,
): Promise<{ workflow: Workflow; version: WorkflowVersion }> {
  const workflow = Workflow.register(name);
  const schedule = new Schedule(spec);
  const definition = aDefinition({}, "content-1", schedule);
  const result = workflow.publish({
    definition,
    source: null,
    publisherId: "author-1",
    now: T0,
  });

  if (!result.ok) throw new Error(result.failure);

  if (on) workflow.turnOn(T0);

  workflow.clearEvents();
  await fixture.workflows.save(workflow);
  return { workflow, version: result.value.version };
}

describe("turning a workflow on and off", () => {
  it("turning_on_saves_and_dispatches_its_armed_schedule_once", async () => {
    const fixture = setUp();
    await aWorkflow(fixture, false);
    const before = fixture.workflows.saves;

    await fixture.turnOn.execute({ name });
    await fixture.turnOn.execute({ name });

    const kinds = fixture.workflowEvents.dispatched.map((event) => event.kind);
    expect(fixture.workflows.saves).toBe(before + 1);
    expect(kinds).toEqual([WorkflowEventKind.ScheduleArmed]);
  });

  it("turning_off_a_workflow_that_is_off_writes_nothing", async () => {
    const fixture = setUp();
    await aWorkflow(fixture, false);
    const before = fixture.workflows.saves;

    const result = await fixture.turnOff.execute({ name });

    expect(result.ok).toBe(true);
    expect(fixture.workflows.saves).toBe(before);
    expect(fixture.workflowEvents.calls).toEqual([]);
  });

  it("turning_off_a_workflow_that_is_on_saves_and_dispatches", async () => {
    const fixture = setUp();
    const { workflow } = await aWorkflow(fixture, true);

    await fixture.turnOff.execute({ name });

    expect(fixture.workflowEvents.calls).toEqual([workflow.id]);
  });
});

describe("a fired schedule", () => {
  it("saves_the_workflow_alone_and_dispatches_the_fired_slot_and_the_next_arming", async () => {
    const fixture = setUp();
    const { workflow } = await aWorkflow(fixture, true);
    const command = { workflowId: workflow.id, arming: 1, at: T0.getTime() };

    await fixture.fire.execute(command);
    await fixture.fire.execute(command);

    const kinds = fixture.workflowEvents.dispatched.map((event) => event.kind);
    const stored = await fixture.workflows.findById(workflow.id);
    expect(kinds).toEqual([
      WorkflowEventKind.ScheduleFired,
      WorkflowEventKind.ScheduleArmed,
    ]);
    expect(stored?.arming).toBe(2);
    expect(fixture.instances.rows.size).toBe(0);
  });

  it("a_fire_of_a_workflow_turned_off_writes_nothing", async () => {
    const fixture = setUp();
    const { workflow } = await aWorkflow(fixture, false);
    const before = fixture.workflows.saves;

    await fixture.fire.execute({
      workflowId: workflow.id,
      arming: 0,
      at: T0.getTime(),
    });

    expect(fixture.workflows.saves).toBe(before);
  });
});

describe("the instance of a fired slot", () => {
  const SLOT = "0b7c2f7e-0000-4000-8000-000000000001";

  it("starts_once_per_slot_and_dispatches_its_run", async () => {
    const fixture = setUp();
    const { workflow } = await aWorkflow(fixture, true);
    const command = { workflowId: workflow.id, instanceId: SLOT };

    await fixture.start.execute(command);
    await fixture.start.execute(command);

    expect(fixture.instances.rows.size).toBe(1);
    expect(fixture.instanceEvents.started[0]?.stored).toBe(true);
    expect(fixture.instanceEvents.kindsOf(SLOT)).toEqual([
      InstanceEventKind.Started,
    ]);
    expect(fixture.workflowEvents.calls).toEqual([]);
  });

  it("starts_nothing_once_the_workflow_is_off", async () => {
    const fixture = setUp();
    const { workflow } = await aWorkflow(fixture, false);

    await fixture.start.execute({ workflowId: workflow.id, instanceId: SLOT });

    expect(fixture.instances.rows.size).toBe(0);
  });

  it("an_after_chain_starts_nothing_while_the_schedules_instance_runs", async () => {
    const fixture = setUp();
    const { workflow, version } = await aWorkflow(
      fixture,
      true,
      AFTER_A_MINUTE,
    );
    const running = anInstanceIn(Phase.Running, {
      id: "running-1",
      workflowId: workflow.id,
      versionId: version.id,
      trigger: TriggerKind.Schedule,
    });
    fixture.instances.put(running);

    await fixture.start.execute({ workflowId: workflow.id, instanceId: SLOT });

    expect(fixture.instances.rows.size).toBe(1);
    expect(fixture.instanceEvents.started).toEqual([]);
  });
});

describe("the next link of an after chain", () => {
  it("a_completed_instance_its_schedule_started_arms_the_next_after_its_delay", async () => {
    const fixture = setUp();
    const { workflow, version } = await aWorkflow(
      fixture,
      true,
      AFTER_A_MINUTE,
    );
    fixture.instances.put(
      anInstanceIn(Phase.Completed, {
        workflowId: workflow.id,
        versionId: version.id,
        trigger: TriggerKind.Schedule,
      }),
    );

    await fixture.continued.execute({ instanceId: "instance-1" });

    expect(fixture.workflowEvents.dispatched).toHaveLength(1);
  });

  it("a_manual_instance_arms_nothing", async () => {
    const fixture = setUp();
    const { workflow, version } = await aWorkflow(
      fixture,
      true,
      AFTER_A_MINUTE,
    );
    fixture.instances.put(
      anInstanceIn(Phase.Completed, {
        workflowId: workflow.id,
        versionId: version.id,
      }),
    );

    await fixture.continued.execute({ instanceId: "instance-1" });

    expect(fixture.workflowEvents.dispatched).toEqual([]);
  });
});

describe("arming the schedules on start-up", () => {
  it("arms_each_scheduled_workflow_nothing_armed_and_skips_one_turned_off", async () => {
    const unarmed: string[] = [];
    const fixture = setUp(unarmed);
    const { workflow } = await aWorkflow(fixture, true);
    unarmed.push(workflow.id, "gone");

    await fixture.arm.execute();

    expect(fixture.workflowEvents.calls).toEqual([workflow.id]);
    expect(fixture.instanceEvents.dispatched).toEqual([]);
  });
});
