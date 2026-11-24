import { Injectable } from "@nestjs/common";
import { TransactionHost } from "@nestjs-cls/transactional";
import { and, asc, eq, isNull, lte, or, type SQL, sql } from "drizzle-orm";
import type {
  AcceptedEvent,
  InstanceOffer,
} from "../../../application/automation/events/interfaces.js";
import type { EventListeners } from "../../../application/automation/events/ports.js";
import type {
  ProgramReference,
  RoutingMatch,
} from "../../../domain/automation/instances/interfaces.js";
import { ScheduleKind } from "../../../domain/automation/workflows/enums.js";
import type { Transaction } from "../interfaces.js";
import {
  listener as listeners,
  workflow as workflows,
  workflowInstance as instances,
  workflowVersion as versions,
} from "../schema/index.js";

@Injectable()
export class PostgresEventListenerStore implements EventListeners {
  private static readonly ON = JSON.stringify({ kind: ScheduleKind.On });

  constructor(private readonly txHost: TransactionHost<Transaction>) {}

  async programsFor(event: AcceptedEvent): Promise<ProgramReference[]> {
    const listening = this.txHost.tx
      .selectDistinct({ versionId: instances.versionId })
      .from(listeners)
      .innerJoin(instances, eq(instances.id, listeners.instanceId))
      .where(
        and(lte(listeners.since, event.acceptedAt), isNull(instances.endedAt)),
      );
    const startsOnEvents = this.#startsOnEvents();
    const triggered = this.txHost.tx
      .selectDistinct({ versionId: versions.id })
      .from(workflows)
      .innerJoin(versions, eq(versions.id, workflows.currentVersionId))
      .where(and(eq(workflows.on, true), startsOnEvents));
    const rows = await listening.union(triggered);
    return rows.map((row) => ({ versionId: row.versionId }));
  }

  async instancesFor(
    matches: readonly RoutingMatch[],
    event: AcceptedEvent,
  ): Promise<InstanceOffer[]> {
    if (matches.length === 0) return [];

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
      const listed = listens.concat([row.execution]);
      candidates.set(row.instanceId, listed);
    }

    return Array.from(candidates, ([instanceId, listens]) => ({
      instanceId,
      candidates: listens,
    }));
  }

  async workflowsFor(matches: readonly RoutingMatch[]): Promise<string[]> {
    if (matches.length === 0) return [];

    const matching = matches.map((match) =>
      and(
        eq(versions.id, match.versionId),
        sql`${versions.schedule} ->> 'stream' = ${match.stream}`,
      ),
    );
    const startsOnEvents = this.#startsOnEvents();
    const rows = await this.txHost.tx
      .selectDistinct({ workflowId: workflows.id })
      .from(workflows)
      .innerJoin(versions, eq(versions.id, workflows.currentVersionId))
      .where(and(eq(workflows.on, true), startsOnEvents, or(...matching)));
    return rows.map((row) => row.workflowId);
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
    return sql`${versions.schedule} @> ${PostgresEventListenerStore.ON}::jsonb`;
  }
}
