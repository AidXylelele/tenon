import { Injectable } from "@nestjs/common";
import type { EventPage } from "../../../application/automation/events/interfaces.js";
import type {
  InstanceDetail,
  InstancePage,
  InstanceSummary,
  PhaseCount,
  TaskOutput,
  TaskPage,
} from "../../../application/automation/instances/interfaces.js";
import { Phase } from "../../../domain/automation/instances/enums.js";
import {
  type EventPageResponse,
  InstanceCursor,
  type InstanceCountsResponse,
  type InstancePageResponse,
  type InstanceResponse,
  type InstanceSummaryResponse,
  type ResponseJson,
  type TaskPageResponse,
} from "../schemas/instance.schemas.js";

@Injectable()
export class InstancePresenter {
  summary(instance: InstanceSummary): InstanceSummaryResponse {
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

  detail(instance: InstanceDetail): InstanceResponse {
    const summary = this.summary(instance);
    const startedBy = this.#startedByOf(instance);
    const waits = instance.waits.map((wait) => ({
      kind: wait.kind,
      until: wait.until?.toISOString() ?? null,
      stream: wait.stream,
      instanceId: wait.instanceId,
    }));
    return {
      ...summary,
      input: instance.input as ResponseJson,
      output: instance.output as ResponseJson,
      error: instance.error as ResponseJson,
      originId: instance.originId,
      startedBy,
      controls: instance.controls.slice(),
      cancelReason: instance.cancelReason,
      waits,
    };
  }

  page(page: InstancePage): InstancePageResponse {
    const items = page.items.map((item) => this.summary(item));
    const next = page.next === null ? null : InstanceCursor.encode(page.next);
    return { items, next };
  }

  output(output: TaskOutput): string {
    return JSON.stringify(output.value);
  }

  tasks(page: TaskPage): TaskPageResponse {
    const items = page.items.map((task) => ({
      execution: task.execution,
      reference: task.reference,
      name: task.name,
      status: task.status,
      error: task.error as ResponseJson,
      startedAt: task.startedAt.toISOString(),
      endedAt: task.endedAt?.toISOString() ?? null,
      attempt: task.attempt,
      input: task.input as ResponseJson,
      output: task.output as ResponseJson,
      retryAt: task.retryAt?.toISOString() ?? null,
    }));
    const next = page.next === null ? null : String(page.next);
    return { items, next };
  }

  events(page: EventPage): EventPageResponse {
    const items = page.items as ResponseJson[];
    const next = page.next === null ? null : String(page.next);
    return { items, next };
  }

  counts(
    from: Date,
    to: Date,
    counted: readonly PhaseCount[],
  ): InstanceCountsResponse {
    const phases = Object.values(Phase);
    const entries = phases.map((phase) => [
      phase,
      this.#countOf(counted, phase),
    ]);
    return {
      from: from.toISOString(),
      to: to.toISOString(),
      counts: Object.fromEntries(entries) as InstanceCountsResponse["counts"],
    };
  }

  #countOf(counted: readonly PhaseCount[], phase: Phase): number {
    const found = counted.find((count) => count.phase === phase);
    return found?.count ?? 0;
  }

  #startedByOf(instance: InstanceDetail): InstanceResponse["startedBy"] {
    const starter = instance.startedBy;

    if (starter === null) return null;

    return { id: starter.id, name: starter.name };
  }
}
