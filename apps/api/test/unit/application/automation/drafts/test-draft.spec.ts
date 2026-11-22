import { TestDraft } from "../../../../../src/application/automation/drafts/test-draft.js";
import { Missing } from "../../../../../src/application/automation/enums.js";
import type { InputProblem } from "../../../../../src/application/automation/instances/interfaces.js";
import type { WorkflowRuntime } from "../../../../../src/application/automation/instances/ports.js";
import { Draft } from "../../../../../src/domain/automation/drafts/draft.js";
import { DraftRefusal } from "../../../../../src/domain/automation/drafts/enums.js";
import { WorkflowName } from "../../../../../src/domain/automation/workflows/workflow-name.js";
import { aDocument } from "../../../../support/builders.js";
import {
  FakeDefinitionCompiler,
  RecordingInstanceRuns,
  StoredDrafts,
  StoredSecrets,
  StoredWorkflowInstanceRepository,
  StoredWorkflowRepository,
  T0,
} from "../../../../support/fakes.js";

const name = new WorkflowName("sales", "route-lead");
const tester = { id: "tester-1", name: "Tess" };

function inputsChecked(problems: readonly InputProblem[]): WorkflowRuntime {
  const checker = { inputProblemsOf: () => Promise.resolve(problems) };
  return checker as unknown as WorkflowRuntime;
}

async function setUp(problems: readonly InputProblem[] = []) {
  const drafts = new StoredDrafts();
  const compiler = new FakeDefinitionCompiler();
  const workflows = new StoredWorkflowRepository();
  const instances = new StoredWorkflowInstanceRepository();
  const runs = new RecordingInstanceRuns(instances);
  const source = JSON.stringify(aDocument());
  const draft = Draft.create({
    name,
    source,
    layout: {},
    author: tester,
    now: T0,
  });
  await drafts.save(draft);
  const runtime = inputsChecked(problems);
  const testDraft = new TestDraft(
    drafts,
    compiler,
    new StoredSecrets(),
    workflows,
    instances,
    runs,
    runtime,
  );
  return { draft, compiler, workflows, instances, runs, testDraft };
}

describe("testing a draft", () => {
  it("runs_the_draft_once_as_a_test_of_a_workflow_it_does_not_publish", async () => {
    const fixture = await setUp();

    const tested = await fixture.testDraft.execute({
      name,
      expected: fixture.draft.revision,
      input: { amount: 3 },
      starterId: tester.id,
    });

    const ran = fixture.runs.started.map((run) => run.instance);
    const workflow = await fixture.workflows.findByName(name);
    expect(tested).toEqual({ ok: true, value: { instanceId: ran[0]?.id } });
    expect(ran).toHaveLength(1);
    expect(ran[0]?.test).toBe(true);
    expect(ran[0]?.input).toEqual({ amount: 3 });
    expect(fixture.runs.started[0]?.stored).toBe(true);
    expect(workflow?.currentVersionId).toBeNull();
    expect(workflow?.versionToRun(null)).toBeNull();
  });

  it("a_second_test_of_the_same_draft_writes_no_new_version", async () => {
    const fixture = await setUp();
    const command = {
      name,
      expected: fixture.draft.revision,
      input: {},
      starterId: tester.id,
    };
    await fixture.testDraft.execute(command);
    const savesAfterFirst = fixture.workflows.saves;

    await fixture.testDraft.execute(command);

    const versions = fixture.runs.started.map((run) => run.instance.versionId);
    expect(fixture.workflows.saves).toBe(savesAfterFirst);
    expect(fixture.workflows.versions.size).toBe(1);
    expect(versions[0]).toBe(versions[1]);
  });

  it("a_stale_revision_is_refused_with_the_current_draft_and_runs_nothing", async () => {
    const fixture = await setUp();

    const tested = await fixture.testDraft.execute({
      name,
      expected: "an-old-revision",
      input: {},
      starterId: tester.id,
    });

    expect(tested).toEqual({
      ok: false,
      failure: { refusal: DraftRefusal.Stale, current: fixture.draft.snapshot },
    });
    expect(fixture.runs.started).toHaveLength(0);
  });

  it("a_workflow_without_a_draft_is_refused_as_missing", async () => {
    const fixture = await setUp();
    const other = new WorkflowName("sales", "nobody");

    const tested = await fixture.testDraft.execute({
      name: other,
      expected: fixture.draft.revision,
      input: {},
      starterId: tester.id,
    });

    expect(tested).toEqual({ ok: false, failure: Missing.Draft });
  });

  it("a_draft_the_compiler_refuses_is_answered_with_its_problems", async () => {
    const fixture = await setUp();
    const problems = [
      {
        code: "schema",
        pointer: "/do",
        detail: "do is required",
        line: null,
        column: null,
      },
    ];
    fixture.compiler.refused.set(name.name, problems);

    const tested = await fixture.testDraft.execute({
      name,
      expected: fixture.draft.revision,
      input: {},
      starterId: tester.id,
    });

    expect(tested).toEqual({ ok: false, failure: problems });
    expect(fixture.workflows.rows.size).toBe(0);
  });

  it("an_input_the_draft_refuses_is_answered_with_its_problems_and_runs_nothing", async () => {
    const problems = [{ pointer: "/amount", detail: "amount is required" }];
    const fixture = await setUp(problems);

    const tested = await fixture.testDraft.execute({
      name,
      expected: fixture.draft.revision,
      input: {},
      starterId: tester.id,
    });

    expect(tested).toEqual({
      ok: false,
      failure: { inputProblems: problems },
    });
    expect(fixture.instances.rows.size).toBe(0);
    expect(fixture.runs.started).toHaveLength(0);
  });
});
