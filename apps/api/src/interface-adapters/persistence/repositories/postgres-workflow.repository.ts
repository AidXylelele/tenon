import { Injectable } from "@nestjs/common";
import {
  Propagation,
  Transactional,
  TransactionHost,
} from "@nestjs-cls/transactional";
import { Outbox } from "@nestjs/outbox";
import { and, eq } from "drizzle-orm";
import type { WorkflowRepository } from "../../../application/automation/workflows/ports.js";
import type { WorkflowName } from "../../../domain/automation/workflows/workflow-name.js";
import type { Workflow } from "../../../domain/automation/workflows/workflow.js";
import { StaleWriteError } from "../../../domain/errors.js";
import type { WorkflowMessage } from "../../messaging/interfaces.js";
import { OutboxTracer } from "../../messaging/outbox.tracer.js";
import type { Transaction, WorkflowRow } from "../interfaces.js";
import { WorkflowMapper } from "../mappers/workflow.mapper.js";
import { WorkflowVersionMapper } from "../mappers/workflow-version.mapper.js";
import {
  workflow as workflows,
  workflowVersion as versions,
} from "../schema/index.js";

@Injectable()
export class PostgresWorkflowRepository implements WorkflowRepository {
  constructor(
    private readonly txHost: TransactionHost<Transaction>,
    private readonly outbox: Outbox,
    private readonly workflowMapper: WorkflowMapper,
    private readonly workflowVersionMapper: WorkflowVersionMapper,
    private readonly tracer: OutboxTracer,
  ) {}

  async findByName(name: WorkflowName): Promise<Workflow | null> {
    const [row] = await this.txHost.tx
      .select()
      .from(workflows)
      .where(
        and(
          eq(workflows.namespace, name.namespace),
          eq(workflows.name, name.name),
        ),
      );

    if (!row) return null;

    return this.#withCatalogue(row);
  }

  async findById(id: string): Promise<Workflow | null> {
    const [row] = await this.txHost.tx
      .select()
      .from(workflows)
      .where(eq(workflows.id, id));

    if (!row) return null;

    return this.#withCatalogue(row);
  }

  @Transactional(Propagation.Mandatory)
  async save(workflow: Workflow): Promise<void> {
    const row = this.workflowMapper.toRow(workflow);
    const nextVersion = workflow.version + 1;
    const saved =
      workflow.version === 0
        ? await this.txHost.tx
            .insert(workflows)
            .values({ ...row, version: nextVersion })
            .onConflictDoNothing()
            .returning({ id: workflows.id })
        : await this.txHost.tx
            .update(workflows)
            .set({
              status: row.status,
              on: row.on,
              currentVersionId: row.currentVersionId,
              archivedAt: row.archivedAt,
              version: nextVersion,
            })
            .where(
              and(
                eq(workflows.id, row.id),
                eq(workflows.version, workflow.version),
              ),
            )
            .returning({ id: workflows.id });

    if (saved.length === 0) throw new StaleWriteError();

    await this.#insertPublications(workflow);
    await this.#publishEvents(workflow);
  }

  async #withCatalogue(row: WorkflowRow): Promise<Workflow> {
    const rows = await this.txHost.tx
      .select({
        id: versions.id,
        semver: versions.semver,
        dsl: versions.dsl,
        digest: versions.digest,
        programFingerprint: versions.programFingerprint,
        schedule: versions.schedule,
        secrets: versions.secrets,
        publisherId: versions.publisherId,
        publishedAt: versions.publishedAt,
      })
      .from(versions)
      .where(eq(versions.workflowId, row.id));
    const catalogue = rows.map((version) =>
      this.workflowVersionMapper.toEntity(version),
    );
    return this.workflowMapper.toEntity(row, catalogue);
  }

  async #insertPublications(workflow: Workflow): Promise<void> {
    const rows = workflow.publications.map((publication) =>
      this.workflowVersionMapper.toRow(workflow.id, publication),
    );
    workflow.clearPublications();

    if (rows.length > 0) await this.txHost.tx.insert(versions).values(rows);
  }

  async #publishEvents(workflow: Workflow): Promise<void> {
    const entries = workflow.events.map((change) => {
      const payload: WorkflowMessage = { workflowId: change.workflowId };
      return {
        topic: change.kind,
        key: change.workflowId,
        payload,
        headers: this.tracer.headers(),
      };
    });
    workflow.clearEvents();

    if (entries.length > 0) await this.outbox.add(this.txHost.tx, entries);
  }
}
