import { randomUUID } from "node:crypto";
import { WorkflowRepository } from "../../../src/application/automation/workflows/ports.js";
import { WorkflowQueries } from "../../../src/application/automation/workflows/queries.js";
import { WorkflowStatus } from "../../../src/domain/automation/workflows/enums.js";
import { Workflow } from "../../../src/domain/automation/workflows/workflow.js";
import { WorkflowName } from "../../../src/domain/automation/workflows/workflow-name.js";
import type { WorkflowVersion } from "../../../src/domain/automation/workflows/workflow-version.js";
import { StaleWriteError } from "../../../src/domain/errors.js";
import { Role } from "../../../src/domain/identity/users/enums.js";
import { createUser } from "../../support/auth-helpers.js";
import { aDefinition } from "../../support/builders.js";
import { createTestApp, type TestApp } from "../../support/create-test-app.js";
import { inTransaction, truncateAll } from "../../support/db.js";

const name = new WorkflowName("sales", "route-lead");
const now = new Date("2026-11-03T10:00:00.000Z");
const source = "document:\n  name: route-lead\n";

describe("workflow persistence", () => {
  let t: TestApp;
  let workflows: WorkflowRepository;
  let queries: WorkflowQueries;
  let publisherId: string;

  beforeAll(async () => {
    t = await createTestApp();
    workflows = t.app.get(WorkflowRepository);
    queries = t.app.get(WorkflowQueries);
  });

  afterAll(async () => {
    await t.close();
  });

  beforeEach(async () => {
    await truncateAll(t.db);
    const publisher = await createUser(t, {
      email: "editor@example.com",
      role: Role.Editor,
    });
    publisherId = publisher.id;
  });

  function published(
    workflow: Workflow,
    version: string,
    digest: string,
  ): WorkflowVersion {
    const definition = aDefinition({ version }, digest);
    const result = workflow.publish({
      definition,
      source: null,
      publisherId,
      now,
    });

    if (!result.ok) throw new Error(result.failure);

    return result.value.version;
  }

  async function saved(workflow: Workflow): Promise<void> {
    await inTransaction(t.app, () => workflows.save(workflow));
  }

  it("a_published_version_loads_back_in_the_workflows_catalogue", async () => {
    const workflow = Workflow.register(name);
    const version = published(workflow, "1.0.0", "d-1");
    await saved(workflow);

    const byName = await workflows.findByName(name);
    const byId = await workflows.findById(workflow.id);

    const loaded = byName?.versionToRun("1.0.0");
    expect(loaded?.id).toBe(version.id);
    expect(loaded?.semver).toBe("1.0.0");
    expect(loaded?.dsl).toBe("1.1.0");
    expect(loaded?.digest).toBe("d-1");
    expect(loaded?.programFingerprint).toBe("d-1");
    expect(loaded?.schedule).toBeNull();
    expect(loaded?.secrets).toEqual([]);
    expect(loaded?.publisherId).toBe(publisherId);
    expect(loaded?.publishedAt.toISOString()).toBe(now.toISOString());
    expect(byName?.versionToRun(null)?.id).toBe(version.id);
    expect(byName?.publications).toEqual([]);
    expect(byName?.version).toBe(1);
    expect(byId?.versionById(version.id)?.digest).toBe("d-1");
  });

  it("a_new_version_stores_its_document_for_the_run_and_no_source_from_json", async () => {
    const workflow = Workflow.register(name);
    const definition = aDefinition({}, "d-1");
    const result = workflow.publish({
      definition,
      source: null,
      publisherId,
      now,
    });
    assert.isTrue(result.ok);
    await saved(workflow);

    const version = workflow.versionToRun("1.0.0");
    assert.exists(version);
    const program = await queries.programById(version.id);
    const kept = await queries.source(name, "1.0.0");

    expect(program).toEqual({
      versionId: version.id,
      digest: "d-1",
      document: definition.document,
      imports: {},
      secrets: [],
    });
    expect(kept).toEqual({ source: null });
    expect(await queries.programById(randomUUID())).toBeNull();
  });

  it("a_version_names_its_workflow_for_the_endings_the_host_tells", async () => {
    const workflow = Workflow.register(name);
    const definition = aDefinition({}, "d-1");
    workflow.publish({ definition, source: null, publisherId, now });
    await saved(workflow);

    const version = workflow.versionToRun("1.0.0");
    assert.exists(version);
    const identity = await queries.identityById(version.id);

    expect(identity).toEqual({
      namespace: "sales",
      name: "route-lead",
      version: "1.0.0",
      dsl: "1.1.0",
    });
    expect(await queries.identityById(randomUUID())).toBeNull();
  });

  it("a_new_version_published_from_a_draft_stores_the_authors_source", async () => {
    const workflow = Workflow.register(name);
    const definition = aDefinition({}, "d-1");
    workflow.publish({ definition, source, publisherId, now });

    await saved(workflow);

    expect(await queries.source(name, "1.0.0")).toEqual({ source });
  });

  it("a_later_version_is_added_to_the_stored_catalogue", async () => {
    const workflow = Workflow.register(name);
    const first = published(workflow, "1.0.0", "d-1");
    await saved(workflow);
    const loaded = await workflows.findByName(name);
    assert.exists(loaded);

    const second = published(loaded, "2.0.0", "d-2");
    await saved(loaded);

    const reloaded = await workflows.findByName(name);
    expect(reloaded?.versionById(first.id)?.semver).toBe("1.0.0");
    expect(reloaded?.versionById(second.id)?.semver).toBe("2.0.0");
    expect(reloaded?.versionToRun(null)?.id).toBe(second.id);
    expect(reloaded?.version).toBe(2);
  });

  it("archiving_is_saved", async () => {
    const workflow = Workflow.register(name);
    const version = published(workflow, "1.0.0", "d-1");
    await saved(workflow);
    const loaded = await workflows.findByName(name);
    assert.exists(loaded);

    loaded.archive(now);
    await saved(loaded);

    const archived = await workflows.findByName(name);
    expect(archived?.status).toBe(WorkflowStatus.Archived);
    expect(archived?.archivedAt?.toISOString()).toBe(now.toISOString());
    expect(archived?.versionToRun(null)?.id).toBe(version.id);
  });

  it("a_stale_copy_of_a_workflow_is_refused", async () => {
    const workflow = Workflow.register(name);
    published(workflow, "1.0.0", "d-1");
    await saved(workflow);
    const first = await workflows.findByName(name);
    const second = await workflows.findByName(name);
    assert.exists(first);
    assert.exists(second);
    first.archive(now);
    await saved(first);

    second.archive(now);
    const stale = saved(second);

    await expect(stale).rejects.toThrow(StaleWriteError);
  });

  it("a_workflow_registered_twice_under_one_name_is_a_stale_write", async () => {
    const workflow = Workflow.register(name);
    published(workflow, "1.0.0", "d-1");
    await saved(workflow);
    const duplicate = Workflow.register(name);

    const raced = saved(duplicate);

    await expect(raced).rejects.toThrow(StaleWriteError);
  });

  it("two_copies_publishing_one_semver_race_and_only_the_first_version_is_stored", async () => {
    const workflow = Workflow.register(name);
    published(workflow, "1.0.0", "d-1");
    await saved(workflow);
    const first = await workflows.findByName(name);
    const second = await workflows.findByName(name);
    assert.exists(first);
    assert.exists(second);
    const kept = published(first, "2.0.0", "d-2");
    published(second, "2.0.0", "d-3");
    await saved(first);

    const raced = saved(second);

    await expect(raced).rejects.toThrow(StaleWriteError);
    const stored = await workflows.findByName(name);
    expect(stored?.versionToRun("2.0.0")?.id).toBe(kept.id);
    expect(stored?.versionToRun("2.0.0")?.digest).toBe("d-2");
  });
});
