import { Injectable } from "@nestjs/common";
import { TransactionHost } from "@nestjs-cls/transactional";
import { eq } from "drizzle-orm";
import { LRUCache } from "lru-cache";
import type { AcceptedEvent } from "../../../application/automation/events/interfaces.js";
import type { LifecycleEvents } from "../../../application/automation/instances/ports.js";
import type { WorkflowInstance } from "../../../domain/automation/instances/workflow-instance.js";
import type { InstanceNames, Transaction } from "../interfaces.js";
import { LifecycleEventMapper } from "../mappers/lifecycle-event.mapper.js";
import { TaskValueMapper } from "../mappers/task-value.mapper.js";
import {
  workflow as workflows,
  workflowInstance as instances,
} from "../schema/index.js";
import { PostgresEventStore } from "./postgres-event.store.js";

@Injectable()
export class PostgresLifecycleEventStore implements LifecycleEvents {
  private static readonly MOST_CACHED_NAMES = 10_000;

  private readonly cachedNames = new LRUCache<string, InstanceNames>({
    max: PostgresLifecycleEventStore.MOST_CACHED_NAMES,
    fetchMethod: (instanceId) => this.#namesOf(instanceId),
  });

  constructor(
    private readonly txHost: TransactionHost<Transaction>,
    private readonly events: PostgresEventStore,
    private readonly taskValueMapper: TaskValueMapper,
    private readonly lifecycleEventMapper: LifecycleEventMapper,
  ) {}

  async append(instance: WorkflowInstance): Promise<AcceptedEvent[]> {
    const names = await this.cachedNames.fetch(instance.id);

    if (names === undefined) return [];

    const at = new Date();
    const outputs = this.taskValueMapper.outputsOf(instance.taskValues);
    const told = instance.lifecycle.flatMap((event) =>
      this.lifecycleEventMapper.ofLifecycle(
        instance.id,
        names,
        event,
        at,
        outputs,
      ),
    );
    const appended: AcceptedEvent[] = [];

    for (const each of told) {
      const accepted = await this.events.acceptLifecycle(each, instance, at);

      if (accepted !== null) appended.push(accepted);
    }

    return appended;
  }

  async #namesOf(instanceId: string): Promise<InstanceNames | undefined> {
    const [row] = await this.txHost.tx
      .select({
        namespace: workflows.namespace,
        name: workflows.name,
      })
      .from(instances)
      .innerJoin(workflows, eq(workflows.id, instances.workflowId))
      .where(eq(instances.id, instanceId));
    return row;
  }
}
