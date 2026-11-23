import { Injectable } from "@nestjs/common";
import { DraftRefusal } from "../../../domain/automation/drafts/enums.js";
import type { WorkflowName } from "../../../domain/automation/workflows/workflow-name.js";
import { Missing } from "../enums.js";
import { SecretRepository } from "../secrets/ports.js";
import { DefinitionRefusal } from "../workflows/enums.js";
import { DefinitionCompiler } from "../workflows/ports.js";
import type { DraftCompilationResult } from "./interfaces.js";
import { DraftRepository } from "./ports.js";

@Injectable()
export class DraftCompilation {
  constructor(
    private readonly drafts: DraftRepository,
    private readonly secrets: SecretRepository,
    private readonly compiler: DefinitionCompiler,
  ) {}

  async compile(
    name: WorkflowName,
    expected: string,
    ownerId: string,
  ): Promise<DraftCompilationResult> {
    const draft = await this.drafts.findByName(name);

    if (draft === null) return { ok: false, failure: Missing.Draft };

    const current = draft.isAt(expected);

    if (!current)
      return {
        ok: false,
        failure: { refusal: DraftRefusal.Stale, current: draft.snapshot },
      };

    const owned = await this.secrets.findOwnedBy(ownerId);
    const compiled = await this.compiler.compile(draft.source, owned);

    if (!compiled.ok) return compiled;

    const definition = compiled.value;
    const foreign = !draft.name.equals(definition.name);

    if (foreign) return { ok: false, failure: DefinitionRefusal.OtherWorkflow };

    return { ok: true, value: { draft, definition } };
  }
}
