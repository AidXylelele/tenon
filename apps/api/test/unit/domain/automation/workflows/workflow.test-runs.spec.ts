import { TriggerKind } from "../../../../../src/domain/automation/instances/enums.js";
import type { WorkflowInstance } from "../../../../../src/domain/automation/instances/workflow-instance.js";
import { WorkflowRefusal } from "../../../../../src/domain/automation/workflows/enums.js";
import { Workflow } from "../../../../../src/domain/automation/workflows/workflow.js";
import { WorkflowName } from "../../../../../src/domain/automation/workflows/workflow-name.js";
import type { WorkflowVersion } from "../../../../../src/domain/automation/workflows/workflow-version.js";
import { aDefinition } from "../../../../support/builders.js";

const now = new Date("2026-11-03T10:00:00.000Z");
const name = new WorkflowName("sales", "route-lead");

function definitionOf(version: string, content: string) {
  return aDefinition({ version }, content);
}

function published(workflow: Workflow, version: string): WorkflowVersion {
  const definition = definitionOf(version, `published-${version}`);
  const result = workflow.publish({
    definition,
    source: null,
    publisherId: "author-1",
    now,
  });

  if (!result.ok) throw new Error(result.failure);

  return result.value.version;
}

function tested(workflow: Workflow, content: string): WorkflowVersion {
  const definition = definitionOf("1.0.0", content);
  const result = workflow.testDraft({
    definition,
    source: "draft text",
    publisherId: "tester-1",
    now,
  });

  if (!result.ok) throw new Error(result.failure);

  return result.value.version;
}

function startedOn(
  workflow: Workflow,
  version: WorkflowVersion,
): WorkflowInstance {
  const result = workflow.startInstance({
    instanceId: null,
    version,
    input: {},
    trigger: TriggerKind.Manual,
    starterId: "tester-1",
    originId: null,
    originEffectId: null,
    now,
  });

  if (!result.ok) throw new Error(result.failure);

  return result.value;
}

describe("Workflow testing its draft", () => {
  it("a_tested_draft_is_a_test_version_kept_for_the_save_but_never_current", () => {
    const workflow = Workflow.register(name);
    const current = published(workflow, "1.0.0");

    const version = tested(workflow, "draft-1");

    const kept = workflow.publications.map((entry) => entry.version);
    expect(version.test).toBe(true);
    expect(version.semver).toBe("1.0.0");
    expect(version.publisherId).toBe("tester-1");
    expect(kept).toEqual([current, version]);
    expect(workflow.publications[1]?.source).toBe("draft text");
    expect(workflow.currentVersionId).toBe(current.id);
    expect(workflow.versionToRun(null)).toBe(current);
  });

  it("a_draft_of_a_workflow_never_published_is_tested_without_a_current_version", () => {
    const workflow = Workflow.register(name);

    const version = tested(workflow, "draft-1");

    expect(version.test).toBe(true);
    expect(workflow.currentVersionId).toBeNull();
    expect(workflow.versionToRun(null)).toBeNull();
  });

  it("the_same_draft_tested_again_reuses_its_test_version", () => {
    const workflow = Workflow.register(name);
    const first = tested(workflow, "draft-1");
    workflow.clearPublications();
    const definition = definitionOf("1.0.0", "draft-1");

    const again = workflow.testDraft({
      definition,
      source: "draft text",
      publisherId: "tester-2",
      now,
    });
    const changed = tested(workflow, "draft-2");

    const kept = workflow.publications.map((entry) => entry.version);
    expect(again).toEqual({
      ok: true,
      value: { version: first, created: false },
    });
    expect(changed).not.toBe(first);
    expect(kept).toEqual([changed]);
  });

  it("a_test_version_is_neither_run_by_its_number_nor_taken_by_a_publish", () => {
    const workflow = Workflow.register(name);
    tested(workflow, "draft-1");

    const byNumber = workflow.versionToRun("1.0.0");
    const publication = published(workflow, "1.0.0");

    expect(byNumber).toBeNull();
    expect(publication.test).toBe(false);
    expect(workflow.currentVersionId).toBe(publication.id);
  });

  it("a_testing_raises_no_schedule_change_even_when_the_workflow_is_on", () => {
    const workflow = Workflow.register(name);
    published(workflow, "1.0.0");
    workflow.turnOn();
    workflow.clearEvents();

    tested(workflow, "draft-1");

    expect(workflow.events).toEqual([]);
  });

  it("an_archived_workflow_tests_no_draft", () => {
    const workflow = Workflow.register(name);
    published(workflow, "1.0.0");
    workflow.archive(now);
    workflow.clearPublications();
    const definition = definitionOf("1.0.0", "draft-1");

    const result = workflow.testDraft({
      definition,
      source: null,
      publisherId: "tester-1",
      now,
    });

    expect(result).toEqual({ ok: false, failure: WorkflowRefusal.Archived });
    expect(workflow.publications).toEqual([]);
  });

  it("a_draft_of_another_workflow_is_a_defect_of_the_caller", () => {
    const workflow = Workflow.register(name);
    const definition = aDefinition({ name: "other" }, "draft-1");

    const testing = () =>
      workflow.testDraft({
        definition,
        source: null,
        publisherId: "tester-1",
        now,
      });

    expect(testing).toThrow(TypeError);
  });

  it("a_run_of_a_test_version_is_a_test_run_and_a_run_of_a_published_one_is_not", () => {
    const workflow = Workflow.register(name);
    const current = published(workflow, "1.0.0");
    const version = tested(workflow, "draft-1");

    const test = startedOn(workflow, version);
    const real = startedOn(workflow, current);

    expect(test.test).toBe(true);
    expect(test.versionId).toBe(version.id);
    expect(real.test).toBe(false);
  });
});
