import { Injectable } from "@nestjs/common";
import type { EventPage } from "../../../application/automation/events/interfaces.js";
import type {
  FailingWorkflows,
  InstanceCounts,
  InstanceDetail,
  InstancePage,
  InstanceSummary,
  ListedInstance,
  PhaseCount,
  TaskOutput,
  TaskPage,
  WindowCount,
} from "../../../application/automation/instances/interfaces.js";
import type { Person } from "../../../application/identity/users/interfaces.js";
import { Phase } from "../../../domain/automation/instances/enums.js";
import {
  type EventPageResponse,
  type FailingWorkflowsResponse,
  type InstanceCountsResponse,
  type InstancePageResponse,
  type InstanceResponse,
  type InstanceSummaryResponse,
  type PhaseCounts,
  type ResponseJson,
  type TaskPageResponse,
} from "../schemas/instance.schema.js";

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
      test: instance.test,
      createdAt: instance.createdAt.toISOString(),
      startedAt: instance.startedAt?.toISOString() ?? null,
      endedAt: instance.endedAt?.toISOString() ?? null,
    };
  }

  detail(instance: InstanceDetail): InstanceResponse {
    const summary = this.summary(instance);
    const startedBy = this.#personOf(instance.startedBy);
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
    const items = page.items.map((item) => this.#listedOf(item));
    return { items, total: page.total };
  }

  #listedOf(item: ListedInstance): InstancePageResponse["items"][number] {
    const summary = this.summary(item);
    const startedBy = this.#personOf(item.startedBy);
    const waits = item.waits.map((wait) => ({
      kind: wait.kind,
      until: wait.until?.toISOString() ?? null,
      stream: wait.stream,
    }));
    return { ...summary, startedBy, durationMs: item.durationMs, waits };
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

  failing(failing: FailingWorkflows): FailingWorkflowsResponse {
    const items = failing.items.map((workflow) => ({
      namespace: workflow.namespace,
      name: workflow.name,
      failed: workflow.failed,
      runs: workflow.runs,
      firstFailedAt: workflow.firstFailedAt.toISOString(),
      lastFailedAt: workflow.lastFailedAt.toISOString(),
      lastError: {
        status: workflow.lastError.status,
        type: workflow.lastError.type,
        title: workflow.lastError.title,
        detail: workflow.lastError.detail,
      },
      stillFailing: workflow.stillFailing,
    }));
    return { items, workflows: failing.workflows, failed: failing.failed };
  }

  counts(counted: InstanceCounts): InstanceCountsResponse {
    const buckets = counted.buckets.map((bucket) => ({
      start: bucket.start.toISOString(),
      counts: this.#byPhase(bucket.counts),
    }));
    const total = this.#byPhase(counted.total);
    const previous = this.#previousOf(counted.previous);
    const now = this.#liveOf(counted.live);
    return { to: counted.to.toISOString(), buckets, total, previous, now };
  }

  #previousOf(
    previous: WindowCount | null,
  ): InstanceCountsResponse["previous"] {
    if (previous === null) return null;

    const counts = this.#byPhase(previous.counts);
    return { from: previous.from.toISOString(), counts };
  }

  #liveOf(live: readonly PhaseCount[]): InstanceCountsResponse["now"] {
    return {
      [Phase.Pending]: this.#countOf(live, Phase.Pending),
      [Phase.Running]: this.#countOf(live, Phase.Running),
      [Phase.Waiting]: this.#countOf(live, Phase.Waiting),
      [Phase.Suspended]: this.#countOf(live, Phase.Suspended),
    };
  }

  #byPhase(counted: readonly PhaseCount[]): PhaseCounts {
    const phases = Object.values(Phase);
    const entries = phases.map((phase) => [
      phase,
      this.#countOf(counted, phase),
    ]);
    return Object.fromEntries(entries) as PhaseCounts;
  }

  #countOf(counted: readonly PhaseCount[], phase: Phase): number {
    const found = counted.find((count) => count.phase === phase);
    return found?.count ?? 0;
  }

  #personOf(starter: Person | null): InstanceResponse["startedBy"] {
    if (starter === null) return null;

    return { id: starter.id, name: starter.name };
  }
}
