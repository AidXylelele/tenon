import { Injectable } from "@nestjs/common";
import { TransactionHost } from "@nestjs-cls/transactional";
import { and, eq } from "drizzle-orm";
import type { DraftView } from "../../../application/automation/drafts/interfaces.js";
import type { DraftQueries } from "../../../application/automation/drafts/queries.js";
import type { WorkflowName } from "../../../domain/automation/workflows/workflow-name.js";
import type { Transaction } from "../interfaces.js";
import { draft as drafts } from "../schema/index.js";

@Injectable()
export class PostgresDraftQueries implements DraftQueries {
  constructor(private readonly txHost: TransactionHost<Transaction>) {}

  async find(name: WorkflowName): Promise<DraftView | null> {
    const [row] = await this.txHost.tx
      .select()
      .from(drafts)
      .where(
        and(eq(drafts.namespace, name.namespace), eq(drafts.name, name.name)),
      );

    if (!row) return null;

    const savedBy = { id: row.savedBy, name: row.savedByName };
    return {
      source: row.source,
      layout: row.layout,
      revision: row.revision,
      savedBy,
      savedAt: row.savedAt,
    };
  }
}
