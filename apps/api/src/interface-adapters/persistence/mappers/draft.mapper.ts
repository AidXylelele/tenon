import { Injectable } from "@nestjs/common";
import { Draft } from "../../../domain/automation/drafts/draft.js";
import { WorkflowName } from "../../../domain/automation/workflows/workflow-name.js";
import type { DraftRow } from "../interfaces.js";

@Injectable()
export class DraftMapper {
  toRow(draft: Draft): DraftRow {
    return {
      namespace: draft.name.namespace,
      name: draft.name.name,
      source: draft.source,
      layout: draft.layout,
      revision: draft.revision,
      savedBy: draft.savedBy.id,
      savedByName: draft.savedBy.name,
      savedAt: draft.savedAt,
    };
  }

  toEntity(row: DraftRow): Draft {
    const name = new WorkflowName(row.namespace, row.name);
    const savedBy = { id: row.savedBy, name: row.savedByName };
    return new Draft({
      name,
      source: row.source,
      layout: row.layout,
      revision: row.revision,
      basis: row.revision,
      savedBy,
      savedAt: row.savedAt,
    });
  }
}
