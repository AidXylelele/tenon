import { Injectable } from "@nestjs/common";
import { TransactionHost } from "@nestjs-cls/transactional";
import { eq } from "drizzle-orm";
import type { WorkflowInstance } from "../../../domain/automation/instances/workflow-instance.js";
import type {
  InstanceNames,
  LifecycleCloudEvent,
  Transaction,
} from "../interfaces.js";
import { LifecycleEventMapper } from "../mappers/lifecycle-event.mapper.js";
import {
  workflow as workflows,
  workflowInstance as instances,
} from "../schema/index.js";
import { PostgresEventStore } from "./postgres-event.store.js";
import { PostgresTaskValueStore } from "./postgres-task-value.store.js";

@Injectable()
export class PostgresLifecycleEventStore {
  private static readonly MOST_CACHED_NAMES = 10_000;

  private readonly cachedNames = new Map<string, InstanceNames>();

  constructor(
    private readonly txHost: TransactionHost<Transaction>,
    private readonly events: PostgresEventStore,
    private readonly taskValues: PostgresTaskValueStore,
    private readonly lifecycleEventMapper: LifecycleEventMapper,
  ) {}

  async record(instance: WorkflowInstance, at: Date): Promise<void> {
    const names = await this.#namesOf(instance.id);

    if (names === null) return;

    const outputs = await this.taskValues.keep(instance, at);

    for (const event of instance.lifecycle) {
      const cloudEvents = this.lifecycleEventMapper.ofLifecycle(
        instance.id,
        names,
        event,
        at,
        outputs,
      );
      await this.#accept(instance.id, cloudEvents, event.execution, at);
    }
  }

  async #accept(
    instanceId: string,
    cloudEvents: readonly LifecycleCloudEvent[],
    execution: string | null,
    at: Date,
  ): Promise<void> {
    for (const told of cloudEvents)
      await this.events.acceptLifecycle(told, instanceId, execution, at);
  }

  async #namesOf(instanceId: string): Promise<InstanceNames | null> {
    const known = this.cachedNames.get(instanceId);

    if (known !== undefined) return known;

    const [row] = await this.txHost.tx
      .select({
        namespace: workflows.namespace,
        name: workflows.name,
      })
      .from(instances)
      .innerJoin(workflows, eq(workflows.id, instances.workflowId))
      .where(eq(instances.id, instanceId));

    if (!row) return null;

    if (this.cachedNames.size >= PostgresLifecycleEventStore.MOST_CACHED_NAMES)
      this.cachedNames.clear();

    this.cachedNames.set(instanceId, row);
    return row;
  }
}
