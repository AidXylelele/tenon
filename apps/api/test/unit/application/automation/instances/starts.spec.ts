import { Missing } from "../../../../../src/application/automation/enums.js";
import type { InputProblem } from "../../../../../src/application/automation/instances/interfaces.js";
import type { WorkflowRuntime } from "../../../../../src/application/automation/instances/ports.js";
import { StartInstance } from "../../../../../src/application/automation/instances/start-instance.js";
import { StartSubWorkflow } from "../../../../../src/application/automation/instances/start-sub-workflow.js";
import {
  Phase,
  TriggerKind,
} from "../../../../../src/domain/automation/instances/enums.js";
import type { WorkflowInstance } from "../../../../../src/domain/automation/instances/workflow-instance.js";
import { WorkflowRefusal } from "../../../../../src/domain/automation/workflows/enums.js";
import { Workflow } from "../../../../../src/domain/automation/workflows/workflow.js";
import { WorkflowName } from "../../../../../src/domain/automation/workflows/workflow-name.js";
import { aDefinition } from "../../../../support/builders.js";
import {
  anInstanceIn,
  RecordingInstanceRuns,
  StoredWorkflowInstanceRepository,
  StoredWorkflowRepository,
  T0,
  FakeUnitOfWork,
} from "../../../../support/fakes.js";

const unitOfWork = new FakeUnitOfWork();

const name = new WorkflowName("sales", "route-lead");
const unknown = new WorkflowName("sales", "nobody");

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
  const runs = new RecordingInstanceRuns(instances);
  const workflow = Workflow.register(name);
  const definition = aDefinition({}, "content-1");
  workflow.publish({ definition, source: null, publisherId: "a-1", now: T0 });

  if (archived) workflow.archive(T0);

  await workflows.save(workflow);
  return {
    instances,
    runs,
    start: new StartInstance(
      workflows,
      instances,
      runs,
      inputsChecked(problems),
      unitOfWork,
    ),
    child: new StartSubWorkflow(workflows, instances, runs, unitOfWork),
  };
}

function childOf(workflow: WorkflowName, parentId = "parent-1") {
  return {
    parentId,
    effectId: "/do/0/child",
    name: workflow,
    version: null,
    input: {},
    trigger: TriggerKind.Parent,
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

    const ran = fixture.runs.started.map((run) => run.instance.id);
    expect(ran).toHaveLength(1);
    expect(started).toEqual({ ok: true, value: { instanceId: ran[0] } });
    expect(fixture.runs.started[0]?.stored).toBe(true);
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
    expect(fixture.runs.started).toHaveLength(0);
  });
});

describe("starting a sub-workflow", () => {
  it("a_repeat_answers_the_child_it_started_first", async () => {
    const fixture = await setUp();

    const first = await fixture.child.execute(childOf(name));
    const again = await fixture.child.execute(childOf(name));

    expect(again).toEqual(first);
    expect(fixture.runs.started).toHaveLength(1);
  });

  it("an_unknown_workflow_is_refused_as_missing", async () => {
    const fixture = await setUp();

    const started = await fixture.child.execute(childOf(unknown));

    expect(started).toEqual({ ok: false, failure: Missing.Workflow });
  });

  it("an_archived_workflow_is_refused_as_archived", async () => {
    const fixture = await setUp(true);

    const started = await fixture.child.execute(childOf(name));

    expect(started).toEqual({ ok: false, failure: WorkflowRefusal.Archived });
    expect(fixture.instances.rows.size).toBe(1);
  });

  it("a_child_of_a_parent_no_longer_kept_is_refused_as_missing", async () => {
    const fixture = await setUp();
    const orphan = childOf(name, "parent-gone");

    const started = await fixture.child.execute(orphan);

    expect(started).toEqual({ ok: false, failure: Missing.Instance });
    expect(fixture.runs.started).toHaveLength(0);
  });

  it("a_child_of_a_test_run_is_a_test_run", async () => {
    const parent = anInstanceIn(Phase.Running, { id: "parent-1", test: true });
    const fixture = await setUp(false, [], parent);

    await fixture.child.execute(childOf(name));

    const child = fixture.runs.started[0]?.instance;
    expect(child?.test).toBe(true);
    expect(child?.originId).toBe("parent-1");
  });
});
