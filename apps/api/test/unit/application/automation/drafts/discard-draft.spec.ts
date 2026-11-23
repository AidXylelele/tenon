import { DiscardDraft } from "../../../../../src/application/automation/drafts/discard-draft.js";
import { Missing } from "../../../../../src/application/automation/enums.js";
import { Draft } from "../../../../../src/domain/automation/drafts/draft.js";
import { DraftRefusal } from "../../../../../src/domain/automation/drafts/enums.js";
import { WorkflowName } from "../../../../../src/domain/automation/workflows/workflow-name.js";
import { FakeUnitOfWork, StoredDrafts } from "../../../../support/fakes.js";

const name = new WorkflowName("sales", "route-lead");

describe("discarding a draft", () => {
  const drafts = new StoredDrafts();
  const discardDraft = new DiscardDraft(drafts, new FakeUnitOfWork());

  async function stored(): Promise<Draft> {
    const draft = Draft.create({
      name,
      source: "document: {}",
      layout: {},
      author: { id: "ada", name: "Ada" },
      now: new Date("2026-01-01T10:00:00Z"),
    });
    await drafts.save(draft);
    return draft;
  }

  it("the_current_revision_removes_the_draft", async () => {
    const draft = await stored();

    const discarded = await discardDraft.execute({
      name,
      expected: draft.revision,
    });

    expect(discarded).toEqual({ ok: true, value: undefined });
    expect(await drafts.findByName(name)).toBeNull();
  });

  it("an_older_revision_is_refused_with_the_current_draft", async () => {
    const draft = await stored();

    const discarded = await discardDraft.execute({ name, expected: "old" });

    expect(discarded).toEqual({
      ok: false,
      failure: { refusal: DraftRefusal.Stale, current: draft.snapshot },
    });
  });

  it("no_draft_is_missing", async () => {
    const other = new WorkflowName("sales", "other");

    const discarded = await discardDraft.execute({
      name: other,
      expected: "any",
    });

    expect(discarded).toEqual({ ok: false, failure: Missing.Draft });
  });
});
