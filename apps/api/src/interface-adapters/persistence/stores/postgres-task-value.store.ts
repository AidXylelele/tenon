import { Injectable } from "@nestjs/common";
import { TransactionHost } from "@nestjs-cls/transactional";
import { sql } from "drizzle-orm";
import { TaskValueKind } from "../../../domain/automation/instances/enums.js";
import type { WorkflowInstance } from "../../../domain/automation/instances/workflow-instance.js";
import type { Transaction } from "../interfaces.js";
import { TaskValueMapper } from "../mappers/task-value.mapper.js";
import { taskValue as taskValues } from "../schema/index.js";

@Injectable()
export class PostgresTaskValueStore {
  constructor(
    private readonly txHost: TransactionHost<Transaction>,
    private readonly taskValueMapper: TaskValueMapper,
  ) {}

  async keep(instance: WorkflowInstance, at: Date): Promise<readonly string[]> {
    const outputs: string[] = [];

    for (const taskValue of instance.taskValues) {
      const sealedValue = this.taskValueMapper.sealedOf(taskValue.value);

      if (sealedValue === null) continue;

      await this.txHost.tx
        .insert(taskValues)
        .values({
          instanceId: instance.id,
          execution: taskValue.execution,
          kind: taskValue.kind,
          sealedValue,
          recordedAt: at,
        })
        .onConflictDoUpdate({
          target: [
            taskValues.instanceId,
            taskValues.execution,
            taskValues.kind,
          ],
          set: {
            sealedValue: sql`excluded.sealed_value`,
            recordedAt: sql`excluded.recorded_at`,
          },
        });

      if (taskValue.kind === TaskValueKind.Output)
        outputs.push(taskValue.execution);
    }

    return outputs;
  }
}
