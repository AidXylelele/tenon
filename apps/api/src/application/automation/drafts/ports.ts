import type { Draft } from "../../../domain/automation/drafts/draft.js";
import type { WorkflowName } from "../../../domain/automation/workflows/workflow-name.js";

export abstract class DraftRepository {
  abstract findByName(name: WorkflowName): Promise<Draft | null>;
  abstract save(draft: Draft): Promise<void>;
  abstract remove(draft: Draft): Promise<void>;
}
