import { Missing } from "../../../../../src/application/automation/enums.js";
import { ArchiveWorkflow } from "../../../../../src/application/automation/workflows/archive-workflow.js";
import { CheckDefinition } from "../../../../../src/application/automation/workflows/check-definition.js";
import { DefinitionRefusal } from "../../../../../src/application/automation/workflows/enums.js";
import { DraftCompilation } from "../../../../../src/application/automation/drafts/draft-compilation.js";
import { PublishDraft } from "../../../../../src/application/automation/drafts/publish-draft.js";
import {
  WorkflowRefusal,
  WorkflowStatus,
} from "../../../../../src/domain/automation/workflows/enums.js";
import { Draft } from "../../../../../src/domain/automation/drafts/draft.js";
import { WorkflowName } from "../../../../../src/domain/automation/workflows/workflow-name.js";
import { aDocument } from "../../../../support/builders.js";
import {
  FakeDefinitionCompiler,
  StoredDrafts,
  StoredSecrets,
  RecordingWorkflowEvents,
  StoredWorkflowRepository,
  T0,
  FakeUnitOfWork,
} from "../../../../support/fakes.js";

const unitOfWork = new FakeUnitOfWork();

const later = new Date("2026-11-03T12:00:00.000Z");
const name = new WorkflowName("sales", "route-lead");
const changedTasks = [{ other: { set: { x: 1 } } }];

function setUp() {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(T0);
  const compiler = new FakeDefinitionCompiler();
  const workflows = new StoredWorkflowRepository();
  const secrets = new StoredSecrets();
  const events = new RecordingWorkflowEvents();
  const drafts = new StoredDrafts();
  const check = new CheckDefinition(compiler, workflows, secrets);
  const compilation = new DraftCompilation(drafts, secrets, compiler);
  const publishDraft = new PublishDraft(
    compilation,
    workflows,
    events,
    unitOfWork,
  );
  const publish = {
    execute: async (command: DraftPublication) => {
      const author = { id: command.publisherId, name: "Author" };
      const draft = Draft.create({
        name: command.workflow,
        source: command.source,
        layout: {},
        author,
        now: new Date(),
      });
      await drafts.save(draft);
      return publishDraft.execute({
        name: command.workflow,
        expected: draft.revision,
        publisherId: command.publisherId,
      });
    },
  };
  const archive = new ArchiveWorkflow(workflows, events, unitOfWork);
  return { compiler, workflows, check, publish, archive };
}

interface DraftPublication {
  readonly source: string;
  readonly publisherId: string;
  readonly workflow: WorkflowName;
}

type Fixture = ReturnType<typeof setUp>;

async function publishOf(fixture: Fixture, version: string) {
  const source = JSON.stringify(aDocument({ version }));
  return fixture.publish.execute({
    source,
    publisherId: "author-1",
    workflow: name,
  });
}

async function currentOf(fixture: Fixture): Promise<string | null> {
  const workflow = await fixture.workflows.findByName(name);
  const current = workflow?.versionToRun(null) ?? null;
  return current?.semver ?? null;
}

function storedOf(fixture: Fixture, semver: string) {
  const stored = [...fixture.workflows.versions.values()];
  return stored.find((item) => item.publication.version.semver === semver);
}

describe("checking a definition", () => {
  it("a_new_version_of_a_stored_workflow_passes_and_nothing_is_written", async () => {
    const fixture = setUp();
    await publishOf(fixture, "1.0.0");
    const savesBefore = fixture.workflows.saves;

    const result = await fixture.check.execute({
      document: aDocument({ version: "2.0.0" }),
      publisherId: "author-1",
    });

    expect(result).toEqual({ ok: true, value: undefined });
    expect(await currentOf(fixture)).toBe("1.0.0");
    expect(fixture.workflows.saves).toBe(savesBefore);
    expect(fixture.workflows.versions.size).toBe(1);
  });

  it("a_repeat_passes", async () => {
    const fixture = setUp();
    await publishOf(fixture, "1.0.0");

    const result = await fixture.check.execute({
      document: aDocument(),
      publisherId: "author-2",
    });

    expect(result).toEqual({ ok: true, value: undefined });
  });

  it("other_content_under_a_published_version_is_answered_as_taken", async () => {
    const fixture = setUp();
    await publishOf(fixture, "1.0.0");

    const result = await fixture.check.execute({
      document: aDocument({}, changedTasks),
      publisherId: "author-1",
    });

    expect(result).toEqual({
      ok: false,
      failure: WorkflowRefusal.VersionTaken,
    });
  });

  it("a_new_version_of_an_archived_workflow_is_answered_as_archived", async () => {
    const fixture = setUp();
    await publishOf(fixture, "1.0.0");
    await fixture.archive.execute({ name });

    const result = await fixture.check.execute({
      document: aDocument({ version: "2.0.0" }),
      publisherId: "author-1",
    });

    expect(result).toEqual({ ok: false, failure: WorkflowRefusal.Archived });
  });

  it("a_refused_document_is_answered_with_its_problems", async () => {
    const fixture = setUp();
    const problems = [
      { code: "schema", pointer: "/do", detail: "empty", line: 3, column: 5 },
    ];
    fixture.compiler.refused.set("route-lead", problems);

    const result = await fixture.check.execute({
      document: aDocument(),
      publisherId: "author-1",
    });

    expect(result).toEqual({ ok: false, failure: problems });
  });
});

describe("publishing versions", () => {
  it("a_new_version_is_answered_as_created_with_its_name", async () => {
    const fixture = setUp();

    const result = await publishOf(fixture, "1.0.0");

    expect(result).toEqual({
      ok: true,
      value: {
        namespace: "sales",
        name: "route-lead",
        version: "1.0.0",
        created: true,
      },
    });
  });

  it("the_version_carries_its_publisher_and_the_clock", async () => {
    const fixture = setUp();

    await publishOf(fixture, "1.0.0");

    const version = storedOf(fixture, "1.0.0")?.publication.version;
    expect(version?.publisherId).toBe("author-1");
    expect(version?.publishedAt).toEqual(T0);
    expect(version?.dsl).toBe("1.1.0");
  });

  it("the_version_keeps_the_document_and_the_source_it_was_published_with", async () => {
    const fixture = setUp();
    const document = aDocument();
    const source = JSON.stringify(document);

    await fixture.publish.execute({
      source,
      publisherId: "author-1",
      workflow: name,
    });

    const publication = storedOf(fixture, "1.0.0")?.publication;
    expect(publication?.document).toEqual(document);
    expect(publication?.source).toBe(source);
  });

  it("a_document_that_names_another_workflow_than_the_draft_is_refused", async () => {
    const fixture = setUp();
    const draft = new WorkflowName("sales", "other");

    const result = await fixture.publish.execute({
      source: JSON.stringify(aDocument()),
      publisherId: "author-1",
      workflow: draft,
    });

    expect(result).toEqual({
      ok: false,
      failure: DefinitionRefusal.OtherWorkflow,
    });
    expect(fixture.workflows.saves).toBe(0);
  });

  it("each_new_version_becomes_current", async () => {
    const fixture = setUp();

    await publishOf(fixture, "1.0.0");
    const afterFirst = await currentOf(fixture);
    await publishOf(fixture, "2.0.0");

    expect(afterFirst).toBe("1.0.0");
    expect(await currentOf(fixture)).toBe("2.0.0");
    expect(fixture.workflows.versions.size).toBe(2);
  });

  it("a_lower_version_published_later_becomes_current", async () => {
    const fixture = setUp();
    await publishOf(fixture, "2.0.0");

    await publishOf(fixture, "1.0.0");

    expect(await currentOf(fixture)).toBe("1.0.0");
  });

  it("a_repeat_of_an_older_version_leaves_the_current_one", async () => {
    const fixture = setUp();
    await publishOf(fixture, "1.0.0");
    await publishOf(fixture, "2.0.0");

    const repeat = await publishOf(fixture, "1.0.0");

    expect(repeat.ok && repeat.value.created).toBe(false);
    expect(repeat.ok && repeat.value.version).toBe("1.0.0");
    expect(await currentOf(fixture)).toBe("2.0.0");
    expect(fixture.workflows.versions.size).toBe(2);
  });

  it("a_repeat_writes_nothing", async () => {
    const fixture = setUp();
    await publishOf(fixture, "1.0.0");
    const savesBefore = fixture.workflows.saves;

    await publishOf(fixture, "1.0.0");

    expect(fixture.workflows.saves).toBe(savesBefore);
  });

  it("other_content_under_a_published_version_writes_nothing", async () => {
    const fixture = setUp();
    await publishOf(fixture, "1.0.0");
    const savesBefore = fixture.workflows.saves;

    const result = await fixture.publish.execute({
      source: JSON.stringify(aDocument({}, changedTasks)),
      publisherId: "author-1",
      workflow: name,
    });

    expect(result).toEqual({
      ok: false,
      failure: WorkflowRefusal.VersionTaken,
    });
    expect(fixture.workflows.saves).toBe(savesBefore);
    expect(fixture.workflows.versions.size).toBe(1);
    expect(await currentOf(fixture)).toBe("1.0.0");
  });

  it("the_same_version_of_another_workflow_is_not_taken", async () => {
    const fixture = setUp();
    await publishOf(fixture, "1.0.0");

    const other = await fixture.publish.execute({
      source: JSON.stringify(aDocument({ name: "other" })),
      publisherId: "author-1",
      workflow: new WorkflowName("sales", "other"),
    });

    expect(other.ok && other.value.created).toBe(true);
    expect(fixture.workflows.rows.size).toBe(2);
  });

  it("a_refused_document_writes_nothing", async () => {
    const fixture = setUp();
    const problem = {
      code: "syntax",
      pointer: "",
      detail: "x",
      line: 1,
      column: 1,
    };
    fixture.compiler.refused.set("route-lead", [problem]);

    await publishOf(fixture, "1.0.0");

    expect(fixture.workflows.saves).toBe(0);
    expect(fixture.workflows.versions.size).toBe(0);
  });
});

describe("publishing and archiving together", () => {
  it("archiving_keeps_the_current_version_and_the_first_moment", async () => {
    const fixture = setUp();
    await publishOf(fixture, "1.0.0");
    const current = await currentOf(fixture);

    const first = await fixture.archive.execute({ name });
    vi.setSystemTime(later);
    const second = await fixture.archive.execute({ name });

    const workflow = await fixture.workflows.findByName(name);
    expect(first).toEqual({ ok: true, value: undefined });
    expect(second).toEqual({ ok: true, value: undefined });
    expect(workflow?.status).toBe(WorkflowStatus.Archived);
    expect(workflow?.archivedAt).toEqual(T0);
    expect(workflow?.versionToRun(null)?.semver).toBe(current);
  });

  it("an_archived_workflow_answers_a_repeat_of_the_same_document", async () => {
    const fixture = setUp();
    await publishOf(fixture, "1.0.0");
    await fixture.archive.execute({ name });

    const repeat = await publishOf(fixture, "1.0.0");

    expect(repeat).toEqual({
      ok: true,
      value: {
        namespace: "sales",
        name: "route-lead",
        version: "1.0.0",
        created: false,
      },
    });
    const workflow = await fixture.workflows.findByName(name);
    expect(workflow?.status).toBe(WorkflowStatus.Archived);
    expect(fixture.workflows.versions.size).toBe(1);
  });

  it("an_archived_workflow_refuses_a_new_version_and_stores_nothing", async () => {
    const fixture = setUp();
    await publishOf(fixture, "1.0.0");
    await fixture.archive.execute({ name });
    const savesBefore = fixture.workflows.saves;

    const next = await publishOf(fixture, "2.0.0");

    expect(next).toEqual({ ok: false, failure: WorkflowRefusal.Archived });
    expect(fixture.workflows.saves).toBe(savesBefore);
    expect(fixture.workflows.versions.size).toBe(1);
    expect(await currentOf(fixture)).toBe("1.0.0");
  });

  it("an_archived_workflow_answers_other_content_under_a_published_version_as_taken", async () => {
    const fixture = setUp();
    await publishOf(fixture, "1.0.0");
    await fixture.archive.execute({ name });

    const result = await fixture.publish.execute({
      source: JSON.stringify(aDocument({}, changedTasks)),
      publisherId: "author-1",
      workflow: name,
    });

    expect(result).toEqual({
      ok: false,
      failure: WorkflowRefusal.VersionTaken,
    });
  });

  it("an_unknown_workflow_is_not_archived_and_nothing_is_written", async () => {
    const fixture = setUp();

    const result = await fixture.archive.execute({ name });

    expect(result).toEqual({ ok: false, failure: Missing.Workflow });
    expect(fixture.workflows.saves).toBe(0);
  });
});
