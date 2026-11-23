import { Injectable } from "@nestjs/common";
import { TransactionHost } from "@nestjs-cls/transactional";
import { and, eq, type SQL } from "drizzle-orm";
import type { DraftRepository } from "../../../application/automation/drafts/ports.js";
import type { Draft } from "../../../domain/automation/drafts/draft.js";
import type { WorkflowName } from "../../../domain/automation/workflows/workflow-name.js";
import { StaleWriteError } from "../../../domain/stale-write.error.js";
import type { DraftRow, Transaction } from "../interfaces.js";
import { DraftMapper } from "../mappers/draft.mapper.js";
import { draft as drafts } from "../schema/index.js";

@Injectable()
export class PostgresDraftRepository implements DraftRepository {
  constructor(
    private readonly txHost: TransactionHost<Transaction>,
    private readonly draftMapper: DraftMapper,
  ) {}

  async findByName(name: WorkflowName): Promise<Draft | null> {
    const named = this.named(name);
    const [row] = await this.txHost.tx.select().from(drafts).where(named);

    if (!row) return null;

    return this.draftMapper.toEntity(row);
  }

  async save(draft: Draft): Promise<void> {
    const row = this.draftMapper.toRow(draft);

    if (draft.basis === null) {
      await this.insert(row);
      return;
    }

    const named = this.named(draft.name);
    const saved = await this.txHost.tx
      .update(drafts)
      .set({
        source: row.source,
        layout: row.layout,
        revision: row.revision,
        savedBy: row.savedBy,
        savedByName: row.savedByName,
        savedAt: row.savedAt,
      })
      .where(and(named, eq(drafts.revision, draft.basis)))
      .returning({ revision: drafts.revision });

    if (saved.length === 0) throw new StaleWriteError();
  }

  async remove(draft: Draft): Promise<void> {
    const named = this.named(draft.name);
    const removed = await this.txHost.tx
      .delete(drafts)
      .where(and(named, eq(drafts.revision, draft.revision)))
      .returning({ revision: drafts.revision });

    if (removed.length === 0) throw new StaleWriteError();
  }

  private async insert(row: DraftRow): Promise<void> {
    const inserted = await this.txHost.tx
      .insert(drafts)
      .values(row)
      .onConflictDoNothing()
      .returning({ revision: drafts.revision });

    if (inserted.length === 0) throw new StaleWriteError();
  }

  private named(name: WorkflowName): SQL | undefined {
    return and(
      eq(drafts.namespace, name.namespace),
      eq(drafts.name, name.name),
    );
  }
}
