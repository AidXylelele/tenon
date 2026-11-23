import {
  InstanceRefusal,
  Phase,
  TriggerKind,
} from "../../../../../src/domain/automation/instances/enums.js";
import type { WorkflowInstance } from "../../../../../src/domain/automation/instances/workflow-instance.js";
import {
  WorkflowRefusal,
  WorkflowStatus,
} from "../../../../../src/domain/automation/workflows/enums.js";
import { Workflow } from "../../../../../src/domain/automation/workflows/workflow.js";
import { WorkflowName } from "../../../../../src/domain/automation/workflows/workflow-name.js";
import { WorkflowVersion } from "../../../../../src/domain/automation/workflows/workflow-version.js";
import { aDefinition, aFaultedEnding } from "../../../../support/builders.js";
import { anInstanceIn } from "../../../../support/fakes.js";

const now = new Date("2026-11-03T10:00:00.000Z");
const later = new Date("2026-11-03T11:00:00.000Z");
const name = new WorkflowName("sales", "route-lead");
const UUID = /^[0-9a-f-]{36}$/;

function definitionOf(version: string, content = `content-${version}`) {
  return aDefinition({ version }, content);
}

function publishNew(workflow: Workflow, version: string): WorkflowVersion {
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

function startOn(
  workflow: Workflow,
  version: WorkflowVersion,
): WorkflowInstance {
  const result = workflow.startInstance({
    instanceId: null,
    version,
    input: { amount: 7 },
    trigger: TriggerKind.Manual,
    starterId: "author-1",
    origin: null,
    originEffectId: null,
    now,
  });

  if (!result.ok) throw new Error(result.failure);

  return result.value;
}

describe("WorkflowName", () => {
  it.each([
    ["other", "route-lead"],
    ["sales", "other"],
    ["route-lead", "sales"],
  ])("the_name_%s_%s_is_another_workflow", (namespace, local) => {
    const other = new WorkflowName(namespace, local);

    expect(name.equals(other)).toBe(false);
  });
});

describe("WorkflowVersion", () => {
  it("a_published_version_copies_the_definition_and_the_publication", () => {
    const definition = definitionOf("1.2.3");

    const version = WorkflowVersion.publish({
      definition,
      source: null,
      publisherId: "author-9",
      now,
    });

    expect(version.id).toMatch(UUID);
    expect(version.semver).toBe("1.2.3");
    expect(version.dsl).toBe("1.1.0");
    expect(version.digest).toBe("content-1.2.3");
    expect(version.programFingerprint).toBe("content-1.2.3");
    expect(version.schedule).toBeNull();
    expect(version.secrets).toEqual([]);
    expect(version.publisherId).toBe("author-9");
    expect(version.publishedAt).toBe(now);
  });

  it("republishing_the_same_digest_answers_the_version_itself", () => {
    const version = WorkflowVersion.publish({
      definition: definitionOf("1.0.0"),
      source: null,
      publisherId: "author-1",
      now,
    });

    const result = version.republish(definitionOf("1.0.0"));

    expect(result).toEqual({ ok: true, value: { version, created: false } });
    expect(result.ok && result.value.version).toBe(version);
  });

  it("republishing_other_content_is_refused_as_taken", () => {
    const version = WorkflowVersion.publish({
      definition: definitionOf("1.0.0"),
      source: null,
      publisherId: "author-1",
      now,
    });

    const result = version.republish(definitionOf("1.0.0", "changed"));

    expect(result).toEqual({
      ok: false,
      failure: WorkflowRefusal.VersionTaken,
    });
  });
});

describe("Workflow publishing and archiving", () => {
  it("a_published_version_belongs_to_the_workflow", () => {
    const workflow = Workflow.register(name);

    const version = publishNew(workflow, "1.0.0");

    expect(workflow.versionById(version.id)).toBe(version);
  });

  it("a_new_version_keeps_its_document_and_the_authors_source_for_the_save", () => {
    const workflow = Workflow.register(name);
    const definition = definitionOf("1.0.0");

    const result = workflow.publish({
      definition,
      source: "document:\n  name: route-lead\n",
      publisherId: "author-1",
      now,
    });

    const version = result.ok ? result.value.version : null;
    expect(workflow.publications).toEqual([
      {
        version,
        document: definition.document,
        imports: {},
        source: "document:\n  name: route-lead\n",
      },
    ]);
  });

  it("a_new_version_published_as_json_keeps_no_source", () => {
    const workflow = Workflow.register(name);

    publishNew(workflow, "1.0.0");

    expect(workflow.publications.map((item) => item.source)).toEqual([null]);
  });

  it("a_repeat_keeps_nothing_for_the_save", () => {
    const workflow = Workflow.register(name);
    publishNew(workflow, "1.0.0");
    workflow.clearPublications();

    workflow.publish({
      definition: definitionOf("1.0.0"),
      source: "changed comments",
      publisherId: "author-2",
      now: later,
    });

    expect(workflow.publications).toEqual([]);
  });

  it("a_repeat_keeps_the_first_publisher_and_moment", () => {
    const workflow = Workflow.register(name);
    publishNew(workflow, "1.0.0");

    const result = workflow.publish({
      definition: definitionOf("1.0.0"),
      source: null,
      publisherId: "author-2",
      now: later,
    });

    const version = result.ok ? result.value.version : null;
    expect(version?.publisherId).toBe("author-1");
    expect(version?.publishedAt).toBe(now);
  });

  it("other_content_under_a_taken_version_changes_nothing", () => {
    const workflow = Workflow.register(name);
    publishNew(workflow, "1.0.0");
    const second = publishNew(workflow, "2.0.0");

    const result = workflow.publish({
      definition: definitionOf("1.0.0", "changed"),
      source: null,
      publisherId: "author-1",
      now,
    });

    expect(result).toEqual({
      ok: false,
      failure: WorkflowRefusal.VersionTaken,
    });
    expect(workflow.currentVersionId).toBe(second.id);
    expect(workflow.publications).toHaveLength(2);
  });

  it("a_definition_of_another_workflow_is_refused_even_as_a_repeat", () => {
    const workflow = Workflow.register(name);
    publishNew(workflow, "1.0.0");
    const other = aDefinition({ name: "other" }, "content-1.0.0");

    expect(() =>
      workflow.publish({
        definition: other,
        source: null,
        publisherId: "author-1",
        now,
      }),
    ).toThrow(TypeError);
  });

  it("archiving_records_the_moment_once", () => {
    const workflow = Workflow.register(name);
    publishNew(workflow, "1.0.0");

    const first = workflow.archive(now);
    const again = workflow.archive(later);

    expect(first).toEqual({ ok: true, value: true });
    expect(again).toEqual({ ok: true, value: false });
    expect(workflow.status).toBe(WorkflowStatus.Archived);
    expect(workflow.archivedAt).toBe(now);
  });

  it("a_workflow_never_published_is_not_archived", () => {
    const workflow = Workflow.register(name);

    const result = workflow.archive(now);

    expect(result).toEqual({ ok: false, failure: WorkflowRefusal.Unpublished });
    expect(workflow.status).toBe(WorkflowStatus.Active);
    expect(workflow.archivedAt).toBeNull();
  });

  it("an_archived_workflow_refuses_a_new_version", () => {
    const workflow = Workflow.register(name);
    const current = publishNew(workflow, "1.0.0");
    workflow.archive(now);

    const result = workflow.publish({
      definition: definitionOf("2.0.0"),
      source: null,
      publisherId: "author-1",
      now,
    });

    expect(result).toEqual({ ok: false, failure: WorkflowRefusal.Archived });
    expect(workflow.currentVersionId).toBe(current.id);
  });
});

describe("Workflow finding its versions", () => {
  it("a_start_without_a_version_runs_the_current_one", () => {
    const workflow = Workflow.register(name);
    publishNew(workflow, "1.0.0");
    const current = publishNew(workflow, "2.0.0");

    expect(workflow.versionToRun(null)).toBe(current);
  });

  it("a_start_with_a_version_runs_that_one", () => {
    const workflow = Workflow.register(name);
    const older = publishNew(workflow, "1.0.0");
    publishNew(workflow, "2.0.0");

    expect(workflow.versionToRun("1.0.0")).toBe(older);
  });

  it("an_unpublished_version_is_none_to_run", () => {
    const workflow = Workflow.register(name);

    const none = workflow.versionToRun(null);
    publishNew(workflow, "1.0.0");

    expect(none).toBeNull();
    expect(workflow.versionToRun("9.9.9")).toBeNull();
    expect(workflow.versionById("another-version")).toBeNull();
  });

  it("a_loaded_workflow_knows_its_catalogue_and_keeps_nothing_for_the_save", () => {
    const published = Workflow.register(name);
    const version = publishNew(published, "1.0.0");

    const loaded = new Workflow({
      id: published.id,
      name,
      status: WorkflowStatus.Active,
      on: false,
      currentVersionId: version.id,
      archivedAt: null,
      version: 1,
      versions: [version],
    });

    expect(loaded.versionToRun(null)).toBe(version);
    expect(loaded.versionById(version.id)).toBe(version);
    expect(loaded.publications).toEqual([]);
  });

  it("a_taken_version_of_a_loaded_workflow_is_answered_from_its_catalogue", () => {
    const published = Workflow.register(name);
    const version = publishNew(published, "1.0.0");
    const loaded = new Workflow({
      id: published.id,
      name,
      status: WorkflowStatus.Active,
      on: false,
      currentVersionId: version.id,
      archivedAt: null,
      version: 1,
      versions: [version],
    });

    const repeat = loaded.publish({
      definition: definitionOf("1.0.0"),
      source: null,
      publisherId: "author-2",
      now: later,
    });
    const changed = loaded.publish({
      definition: definitionOf("1.0.0", "changed"),
      source: null,
      publisherId: "author-2",
      now: later,
    });

    expect(repeat).toEqual({ ok: true, value: { version, created: false } });
    expect(changed).toEqual({
      ok: false,
      failure: WorkflowRefusal.VersionTaken,
    });
    expect(loaded.publications).toEqual([]);
  });
});

describe("Workflow starting and restarting instances", () => {
  it("a_started_instance_carries_everything_the_start_named", () => {
    const workflow = Workflow.register(name);
    const version = publishNew(workflow, "1.0.0");

    const result = workflow.startInstance({
      instanceId: null,
      version,
      input: [1, "two", null],
      trigger: TriggerKind.Event,
      starterId: null,
      origin: anInstanceIn(Phase.Completed, { id: "origin-1" }),
      originEffectId: null,
      now,
    });

    const instance = result.ok ? result.value : null;
    expect(instance?.id).toMatch(UUID);
    expect(instance?.workflowId).toBe(workflow.id);
    expect(instance?.versionId).toBe(version.id);
    expect(instance?.trigger).toBe(TriggerKind.Event);
    expect(instance?.starterId).toBeNull();
    expect(instance?.originId).toBe("origin-1");
    expect(instance?.input).toEqual([1, "two", null]);
    expect(instance?.phase).toBe(Phase.Pending);
    expect(instance?.output).toBeNull();
    expect(instance?.error).toBeNull();
    expect(instance?.createdAt).toBe(now);
    expect(instance?.startedAt).toBeNull();
    expect(instance?.endedAt).toBeNull();
    expect(instance?.version).toBe(0);
    expect(instance?.ended).toBe(false);
    expect(instance?.events).toEqual([]);
  });

  it("an_older_version_still_starts_after_a_newer_one_is_current", () => {
    const workflow = Workflow.register(name);
    const older = publishNew(workflow, "1.0.0");
    publishNew(workflow, "2.0.0");

    const instance = startOn(workflow, older);

    expect(instance.versionId).toBe(older.id);
  });

  it("an_archived_workflow_starts_no_instance", () => {
    const workflow = Workflow.register(name);
    const version = publishNew(workflow, "1.0.0");
    workflow.archive(now);

    const result = workflow.startInstance({
      instanceId: null,
      version,
      input: null,
      trigger: TriggerKind.Manual,
      starterId: "author-1",
      origin: null,
      originEffectId: null,
      now,
    });

    expect(result).toEqual({ ok: false, failure: WorkflowRefusal.Archived });
  });

  it("a_version_of_another_workflow_is_a_defect_even_when_archived", () => {
    const workflow = Workflow.register(name);
    const other = Workflow.register(new WorkflowName("sales", "other"));
    const version = publishNew(other, "1.0.0");
    workflow.archive(now);

    expect(() => startOn(workflow, version)).toThrow(TypeError);
  });

  it.each([Phase.Completed, Phase.Faulted, Phase.Cancelled])(
    "a_%s_instance_is_restarted_as_a_new_pending_one",
    (phase) => {
      const workflow = Workflow.register(name);
      const version = publishNew(workflow, "1.0.0");
      const previous = anInstanceIn(phase, {
        workflowId: workflow.id,
        versionId: version.id,
        input: { amount: 42 },
      });

      const result = workflow.restartInstance({
        previous,
        version,
        starterId: "author-2",
        now: later,
      });

      const restarted = result.ok ? result.value : null;
      expect(restarted?.id).not.toBe(previous.id);
      expect(restarted?.phase).toBe(Phase.Pending);
      expect(restarted?.trigger).toBe(TriggerKind.Restart);
      expect(restarted?.originId).toBe(previous.id);
      expect(restarted?.starterId).toBe("author-2");
      expect(restarted?.versionId).toBe(version.id);
      expect(restarted?.workflowId).toBe(workflow.id);
      expect(restarted?.input).toEqual({ amount: 42 });
      expect(restarted?.createdAt).toBe(later);
      expect(previous.phase).toBe(phase);
      expect(previous.events).toEqual([]);
    },
  );

  it.each([Phase.Pending, Phase.Running, Phase.Waiting, Phase.Suspended])(
    "a_%s_instance_is_not_restarted",
    (phase) => {
      const workflow = Workflow.register(name);
      const version = publishNew(workflow, "1.0.0");
      const previous = anInstanceIn(phase, {
        workflowId: workflow.id,
        versionId: version.id,
      });

      const result = workflow.restartInstance({
        previous,
        version,
        starterId: "author-1",
        now,
      });

      expect(result).toEqual({ ok: false, failure: InstanceRefusal.NotEnded });
      expect(previous.phase).toBe(phase);
    },
  );

  it("an_archived_workflow_restarts_no_ended_instance", () => {
    const workflow = Workflow.register(name);
    const version = publishNew(workflow, "1.0.0");
    const previous = anInstanceIn(Phase.Faulted, {
      workflowId: workflow.id,
      versionId: version.id,
    });
    workflow.archive(now);

    const result = workflow.restartInstance({
      previous,
      version,
      starterId: "author-1",
      now,
    });

    expect(result).toEqual({ ok: false, failure: WorkflowRefusal.Archived });
  });

  it("an_unended_instance_of_an_archived_workflow_is_refused_as_not_ended", () => {
    const workflow = Workflow.register(name);
    const version = publishNew(workflow, "1.0.0");
    const previous = anInstanceIn(Phase.Running, {
      workflowId: workflow.id,
      versionId: version.id,
    });
    workflow.archive(now);

    const result = workflow.restartInstance({
      previous,
      version,
      starterId: "author-1",
      now,
    });

    expect(result).toEqual({ ok: false, failure: InstanceRefusal.NotEnded });
  });

  it("a_restart_of_a_restart_comes_from_the_one_it_restarts", () => {
    const workflow = Workflow.register(name);
    const version = publishNew(workflow, "1.0.0");
    const first = anInstanceIn(Phase.Faulted, {
      workflowId: workflow.id,
      versionId: version.id,
    });
    const restarted = workflow.restartInstance({
      previous: first,
      version,
      starterId: "author-1",
      now,
    });
    const second = restarted.ok ? restarted.value : null;
    assert.exists(second);
    second.fail(aFaultedEnding(), later);

    const again = workflow.restartInstance({
      previous: second,
      version,
      starterId: "author-1",
      now: later,
    });

    expect(again.ok && again.value.originId).toBe(second.id);
  });

  it("a_restart_on_a_version_of_another_workflow_is_a_defect_of_the_caller", () => {
    const workflow = Workflow.register(name);
    const other = Workflow.register(new WorkflowName("sales", "other"));
    const foreign = publishNew(other, "1.0.0");
    const previous = anInstanceIn(Phase.Completed, { workflowId: workflow.id });

    expect(() =>
      workflow.restartInstance({
        previous,
        version: foreign,
        starterId: "author-1",
        now,
      }),
    ).toThrow(TypeError);
  });

  it("a_previous_instance_of_another_workflow_is_a_defect_of_the_caller", () => {
    const workflow = Workflow.register(name);
    const version = publishNew(workflow, "1.0.0");
    const previous = anInstanceIn(Phase.Completed, {
      workflowId: "another-workflow",
      versionId: "another-version",
    });

    expect(() =>
      workflow.restartInstance({
        previous,
        version,
        starterId: "author-1",
        now,
      }),
    ).toThrow(TypeError);
  });
});
