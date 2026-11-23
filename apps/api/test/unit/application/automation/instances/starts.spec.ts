import { Missing } from "../../../../../src/application/automation/enums.js";
import type { InputProblem } from "../../../../../src/application/automation/instances/interfaces.js";
import type { WorkflowRuntime } from "../../../../../src/application/automation/instances/ports.js";
import { RestartInstance } from "../../../../../src/application/automation/instances/restart-instance.js";
import { StartInstance } from "../../../../../src/application/automation/instances/start-instance.js";
import {
  InstanceEventKind,
  Phase,
} from "../../../../../src/domain/automation/instances/enums.js";
import type { WorkflowInstance } from "../../../../../src/domain/automation/instances/workflow-instance.js";
import { Workflow } from "../../../../../src/domain/automation/workflows/workflow.js";
import { WorkflowName } from "../../../../../src/domain/automation/workflows/workflow-name.js";
import { aDefinition } from "../../../../support/builders.js";
import {
  anInstanceIn,
  RecordingInstanceEvents,
  StoredWorkflowInstanceRepository,
  StoredWorkflowRepository,
  T0,
  FakeUnitOfWork,
} from "../../../../support/fakes.js";

const unitOfWork = new FakeUnitOfWork();

const name = new WorkflowName("sales", "route-lead");

function inputsChecked(problems: readonly InputProblem[]): WorkflowRuntime {
  const checker = { inputProblemsOf: () => Promise.resolve(problems) };
  return checker as unknown as WorkflowRuntime;
}

async function setUp(
  archived = false,
  problems: readonly InputProblem[] = [],
  parent: WorkflowInstance = anInstanceIn(Phase.Running, { id: "parent-1" }),
) {
  const workflows = new StoredWorkflowRepository();
  const instances = new StoredWorkflowInstanceRepository(parent);
  const events = new RecordingInstanceEvents(instances);
  const workflow = Workflow.register(name);
  const definition = aDefinition({}, "content-1");
  workflow.publish({ definition, source: null, publisherId: "a-1", now: T0 });

  if (archived) workflow.archive(T0);

  await workflows.save(workflow);
  return {
    workflows,
    instances,
    events,
    restart: new RestartInstance(workflows, instances, events, unitOfWork),
    start: new StartInstance(
      workflows,
      instances,
      events,
      inputsChecked(problems),
      unitOfWork,
    ),
  };
}

describe("starting an instance", () => {
  it("answers_the_id_of_the_instance_it_stored_and_ran", async () => {
    const fixture = await setUp();

    const started = await fixture.start.execute({
      name,
      version: null,
      input: {},
      starterId: "author-1",
    });

    const ran = fixture.events.started.map((run) => run.instance.id);
    expect(ran).toHaveLength(1);
    expect(started).toEqual({ ok: true, value: { instanceId: ran[0] } });
    expect(fixture.events.started[0]?.stored).toBe(true);
  });

  it("dispatches_the_start_of_its_run_with_the_stored_instance", async () => {
    const fixture = await setUp();

    const started = await fixture.start.execute({
      name,
      version: null,
      input: {},
      starterId: "author-1",
    });

    const instanceId = started.ok ? started.value.instanceId : "";
    expect(fixture.events.kindsOf(instanceId)).toEqual([
      InstanceEventKind.Started,
    ]);
  });

  it("an_unknown_version_is_refused_as_missing", async () => {
    const fixture = await setUp();

    const started = await fixture.start.execute({
      name,
      version: "9.9.9",
      input: {},
      starterId: "author-1",
    });

    expect(started).toEqual({ ok: false, failure: Missing.Version });
  });

  it("an_input_its_schema_refuses_is_answered_with_its_problems_and_starts_nothing", async () => {
    const problems = [
      { pointer: "/customer", detail: "Customer is required." },
    ];
    const fixture = await setUp(false, problems);

    const started = await fixture.start.execute({
      name,
      version: null,
      input: {},
      starterId: "author-1",
    });

    expect(started).toEqual({ ok: false, failure: problems });
    expect(fixture.instances.rows.size).toBe(1);
    expect(fixture.events.started).toHaveLength(0);
  });
});

describe("restarting an instance", () => {
  it("stores_a_new_instance_of_the_same_version_and_dispatches_its_start", async () => {
    const fixture = await setUp();
    const workflow = await fixture.workflows.findByName(name);
    const version = workflow?.versionToRun(null);
    const ended = anInstanceIn(Phase.Completed, {
      id: "ended-1",
      workflowId: workflow?.id ?? "",
      versionId: version?.id ?? "",
    });
    fixture.instances.put(ended);

    const restarted = await fixture.restart.execute({
      instanceId: "ended-1",
      starterId: "author-1",
    });

    const instanceId = restarted.ok ? restarted.value.instanceId : "";
    expect(fixture.events.kindsOf(instanceId)).toEqual([
      InstanceEventKind.Started,
    ]);
    expect(fixture.events.started[0]?.stored).toBe(true);
  });
});
