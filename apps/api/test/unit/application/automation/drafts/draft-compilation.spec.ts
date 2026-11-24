import { DraftCompilation } from "../../../../../src/application/automation/drafts/draft-compilation.js";
import { Missing } from "../../../../../src/application/automation/enums.js";
import { DefinitionRefusal } from "../../../../../src/application/automation/workflows/enums.js";
import { Draft } from "../../../../../src/domain/automation/drafts/draft.js";
import { DraftRefusal } from "../../../../../src/domain/automation/drafts/enums.js";
import { WorkflowName } from "../../../../../src/domain/automation/workflows/workflow-name.js";
import { aDocument } from "../../../../support/builders.js";
import {
  FakeDefinitionCompiler,
  StoredDrafts,
  StoredSecrets,
  T0,
} from "../../../../support/fakes.js";

const name = new WorkflowName("sales", "route-lead");
const author = { id: "author-1", name: "Ada" };

async function setUp(document = aDocument()) {
  const drafts = new StoredDrafts();
  const compiler = new FakeDefinitionCompiler();
  const source = JSON.stringify(document);
  const draft = Draft.create({ name, source, layout: {}, author, now: T0 });
  await drafts.save(draft);
  const compilation = new DraftCompilation(
    drafts,
    new StoredSecrets(),
    compiler,
  );
  return { draft, compiler, compilation };
}

describe("compiling a draft", () => {
  it("answers_the_draft_and_its_checked_definition", async () => {
    const fixture = await setUp();

    const compiled = await fixture.compilation.compile(
      name,
      fixture.draft.revision,
      author.id,
    );

    expect(compiled).toMatchObject({
      ok: true,
      value: { draft: fixture.draft, definition: { version: "1.0.0" } },
    });
  });

  it("a_missing_draft_is_refused_as_missing", async () => {
    const fixture = await setUp();
    const other = new WorkflowName("sales", "nobody");

    const compiled = await fixture.compilation.compile(
      other,
      fixture.draft.revision,
      author.id,
    );

    expect(compiled).toEqual({ ok: false, failure: Missing.Draft });
  });

  it("a_stale_revision_is_answered_with_the_current_draft", async () => {
    const fixture = await setUp();

    const compiled = await fixture.compilation.compile(
      name,
      "an-old-revision",
      author.id,
    );

    expect(compiled).toEqual({
      ok: false,
      failure: { refusal: DraftRefusal.Stale, current: fixture.draft.snapshot },
    });
  });

  it("a_draft_naming_another_workflow_is_refused", async () => {
    const document = aDocument({ name: "other" });
    const fixture = await setUp(document);

    const compiled = await fixture.compilation.compile(
      name,
      fixture.draft.revision,
      author.id,
    );

    expect(compiled).toEqual({
      ok: false,
      failure: DefinitionRefusal.OtherWorkflow,
    });
  });

  it("a_draft_with_problems_is_answered_with_them", async () => {
    const fixture = await setUp();
    const problems = [
      { code: "x", pointer: "/do", detail: "bad", line: null, column: null },
    ];
    fixture.compiler.refused.set("route-lead", problems);

    const compiled = await fixture.compilation.compile(
      name,
      fixture.draft.revision,
      author.id,
    );

    expect(compiled).toEqual({ ok: false, failure: problems });
  });
});
