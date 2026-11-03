import type {
  InstanceDetail,
  InstancePage,
  InstanceSummary,
  TaskPage,
} from '../../../application/automation/instances/queries.js';
import { CursorMapper } from '../mappers/cursor.mapper.js';
import type {
  ResponseJson,
  InstancePageResponse,
  InstanceResponse,
  InstanceSummaryResponse,
  TaskPageResponse,
} from '../schemas/instance.schemas.js';

export class InstancePresenter {
  static summary(instance: InstanceSummary): InstanceSummaryResponse {
    return {
      id: instance.id,
      namespace: instance.namespace,
      name: instance.name,
      version: instance.version,
      phase: instance.phase,
      trigger: instance.trigger,
      createdAt: instance.createdAt.toISOString(),
      startedAt: instance.startedAt?.toISOString() ?? null,
      endedAt: instance.endedAt?.toISOString() ?? null,
    };
  }

  static instance(instance: InstanceDetail): InstanceResponse {
    const summary = InstancePresenter.summary(instance);
    return {
      ...summary,
      input: instance.input as ResponseJson,
      output: instance.output as ResponseJson,
      error: instance.error as ResponseJson,
      originId: instance.originId,
      starterId: instance.starterId,
    };
  }

  static page(page: InstancePage): InstancePageResponse {
    const items = page.items.map((item) => InstancePresenter.summary(item));
    const next = CursorMapper.fromInstancePosition(page.next);
    return { items, next };
  }

  static tasks(page: TaskPage): TaskPageResponse {
    const items = page.items.map((task) => ({
      execution: task.execution,
      reference: task.reference,
      name: task.name,
      status: task.status,
      input: task.input as ResponseJson,
      output: task.output as ResponseJson,
      error: task.error as ResponseJson,
      startedAt: task.startedAt.toISOString(),
      endedAt: task.endedAt?.toISOString() ?? null,
      attempt: task.attempt,
      retryAt: task.retryAt?.toISOString() ?? null,
    }));
    const next = page.next === null ? null : String(page.next);
    return { items, next };
  }
}
