import { Draft } from "../../../../src/domain/automation/drafts/draft.js";
import { DraftRefusal } from "../../../../src/domain/automation/drafts/enums.js";
import { WorkflowName } from "../../../../src/domain/automation/workflows/workflow-name.js";

const name = new WorkflowName("sales", "route-lead");
const ada = { id: "ada", name: "Ada" };
const ben = { id: "ben", name: "Ben" };
const created = new Date("2026-01-01T10:00:00Z");
const later = new Date("2026-01-01T10:05:00Z");

function aDraft(): Draft {
  return Draft.create({
    name,
    source: "document: {}",
    layout: { greet: { x: 1, y: 2 } },
    author: ada,
    now: created,
  });
}

describe("a draft", () => {
  it("a_save_on_the_current_revision_makes_a_new_revision_and_names_who_saved_it_and_when", () => {
    const draft = aDraft();
    const before = draft.revision;

    const saved = draft.save({
      expected: before,
      source: "document: { edited: true }",
      layout: {},
      author: ben,
      now: later,
    });

    expect(saved).toEqual({ ok: true, value: true });
    expect(draft.revision).not.toBe(before);
    expect(draft.source).toBe("document: { edited: true }");
    expect(draft.savedBy).toEqual(ben);
    expect(draft.savedAt).toEqual(later);
  });

  it("a_save_on_an_older_revision_is_refused_and_changes_nothing", () => {
    const draft = aDraft();
    const first = draft.revision;
    draft.save({
      expected: first,
      source: "a",
      layout: {},
      author: ada,
      now: later,
    });
    const current = draft.revision;

    const stale = draft.save({
      expected: first,
      source: "b",
      layout: {},
      author: ben,
      now: later,
    });

    expect(stale).toEqual({ ok: false, failure: DraftRefusal.Stale });
    expect(draft.revision).toBe(current);
    expect(draft.source).toBe("a");
  });

  it("a_retried_save_already_applied_by_the_same_author_keeps_the_revision", () => {
    const draft = aDraft();
    const first = draft.revision;
    const edit = {
      expected: first,
      source: "a",
      layout: { greet: { y: 2, x: 1 } },
      author: ada,
      now: later,
    };
    draft.save(edit);
    const current = draft.revision;

    const retried = draft.save(edit);

    expect(retried).toEqual({ ok: true, value: false });
    expect(draft.revision).toBe(current);
  });
});
