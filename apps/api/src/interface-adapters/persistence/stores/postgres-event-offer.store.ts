import { Injectable } from "@nestjs/common";
import {
  Propagation,
  Transactional,
  TransactionHost,
} from "@nestjs-cls/transactional";
import { Outbox } from "@nestjs/outbox";
import { and, asc, eq, isNull, lte, or, type SQL, sql } from "drizzle-orm";
import type { AcceptedEvent } from "../../../application/automation/events/interfaces.js";
import type { EventOffers } from "../../../application/automation/events/ports.js";
import type {
  ProgramReference,
  RoutingMatch,
} from "../../../domain/automation/instances/interfaces.js";
import { ScheduleKind } from "../../../domain/automation/workflows/enums.js";
import { MessageTopic } from "../../messaging/enums.js";
import type {
  EventOfferedMessage,
  TriggerOfferedMessage,
} from "../../messaging/interfaces.js";
import { OutboxTracer } from "../../messaging/outbox.tracer.js";
import type { Transaction } from "../interfaces.js";
import {
  listener as listeners,
  workflow as workflows,
  workflowInstance as instances,
  workflowVersion as versions,
} from "../schema/index.js";

@Injectable()
export class PostgresEventOfferStore implements EventOffers {
  private static readonly ON = JSON.stringify({ kind: ScheduleKind.On });

  constructor(
    private readonly txHost: TransactionHost<Transaction>,
    private readonly outbox: Outbox,
    private readonly tracer: OutboxTracer,
  ) {}

  async programsFor(event: AcceptedEvent): Promise<ProgramReference[]> {
    const listening = this.txHost.tx
      .selectDistinct({ versionId: instances.versionId })
      .from(listeners)
      .innerJoin(instances, eq(instances.id, listeners.instanceId))
      .where(
        and(lte(listeners.since, event.acceptedAt), isNull(instances.endedAt)),
      );
    const triggered = this.txHost.tx
      .selectDistinct({ versionId: versions.id })
      .from(workflows)
      .innerJoin(versions, eq(versions.id, workflows.currentVersionId))
      .where(and(eq(workflows.on, true), this.#startsOnEvents()));
    const rows = await listening.union(triggered);
    return rows.map((row) => ({ versionId: row.versionId }));
  }

  @Transactional(Propagation.Mandatory)
  async offer(
    matches: readonly RoutingMatch[],
    event: AcceptedEvent,
  ): Promise<void> {
    if (matches.length === 0) return;

    const matching = matches.map((match) => this.#listening(match));
    const rows = await this.txHost.tx
      .select({
        instanceId: listeners.instanceId,
        execution: listeners.execution,
      })
      .from(listeners)
      .innerJoin(instances, eq(instances.id, listeners.instanceId))
      .where(
        and(
          or(...matching),
          lte(listeners.since, event.acceptedAt),
          isNull(instances.endedAt),
        ),
      )
      .orderBy(asc(listeners.instanceId), asc(listeners.since));
    const candidates = new Map<string, string[]>();

    for (const row of rows) {
      const listens = candidates.get(row.instanceId) ?? [];
      candidates.set(row.instanceId, listens.concat([row.execution]));
    }

    const entries = Array.from(candidates, ([instanceId, listens]) => ({
      topic: MessageTopic.EventOffered,
      key: instanceId,
      payload: this.#offered(instanceId, event, listens),
      headers: this.tracer.headers(),
    }));

    if (entries.length > 0) await this.outbox.add(this.txHost.tx, entries);
  }

  @Transactional(Propagation.Mandatory)
  async trigger(
    matches: readonly RoutingMatch[],
    event: AcceptedEvent,
  ): Promise<void> {
    if (matches.length === 0) return;

    const matching = matches.map((match) =>
      and(
        eq(versions.id, match.versionId),
        sql`${versions.schedule} ->> 'stream' = ${match.stream}`,
      ),
    );
    const rows = await this.txHost.tx
      .selectDistinct({ workflowId: workflows.id })
      .from(workflows)
      .innerJoin(versions, eq(versions.id, workflows.currentVersionId))
      .where(
        and(eq(workflows.on, true), this.#startsOnEvents(), or(...matching)),
      );
    const entries = rows.map((row) => ({
      topic: MessageTopic.TriggerOffered,
      key: row.workflowId,
      payload: this.#triggered(row.workflowId, event),
      headers: this.tracer.headers(),
    }));

    if (entries.length > 0) await this.outbox.add(this.txHost.tx, entries);
  }

  #offered(
    instanceId: string,
    event: AcceptedEvent,
    candidates: readonly string[],
  ): EventOfferedMessage {
    return { instanceId, sequence: event.sequence, candidates };
  }

  #triggered(workflowId: string, event: AcceptedEvent): TriggerOfferedMessage {
    return { workflowId, sequence: event.sequence };
  }

  #listening(match: RoutingMatch): SQL | undefined {
    const filter = { level: match.level, filter: match.filter };
    const open = JSON.stringify([filter]);
    return and(
      eq(instances.versionId, match.versionId),
      eq(listeners.stream, match.stream),
      sql`${listeners.open} @> ${open}::jsonb`,
    );
  }

  #startsOnEvents(): SQL {
    return sql`${versions.schedule} @> ${PostgresEventOfferStore.ON}::jsonb`;
  }
}
