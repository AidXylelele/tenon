import { HttpStatus, Injectable } from "@nestjs/common";
import type { ExpectedStarts } from "../../../application/automation/schedules/interfaces.js";
import type {
  LastRun,
  PublishedVersion,
  VersionSummary,
  WorkflowPage,
  WorkflowSummary,
} from "../../../application/automation/workflows/interfaces.js";
import { ScheduleKind } from "../../../domain/automation/workflows/enums.js";
import type { Schedule } from "../../../domain/automation/workflows/interfaces.js";
import {
  type ExpectedStartsResponse,
  type VersionListResponse,
  type VersionResponse,
  WorkflowCursor,
  type WorkflowPageResponse,
  type WorkflowResponse,
} from "../schemas/workflow.schema.js";
import { ApiRoute } from "../enums.js";

@Injectable()
export class WorkflowPresenter {
  private static readonly PREFIX = `/${ApiRoute.Prefix}/workflows`;

  statusOf(published: PublishedVersion): HttpStatus {
    if (published.created) return HttpStatus.CREATED;

    return HttpStatus.OK;
  }

  locationOf(published: PublishedVersion): string {
    return `${WorkflowPresenter.PREFIX}/${published.namespace}/${published.name}/versions/${published.version}`;
  }

  version(version: VersionSummary): VersionResponse {
    const publishedBy = {
      id: version.publishedBy.id,
      name: version.publishedBy.name,
    };
    return {
      namespace: version.namespace,
      name: version.name,
      version: version.version,
      dsl: version.dsl,
      current: version.current,
      publishedBy,
      publishedAt: version.publishedAt.toISOString(),
    };
  }

  versions(versions: readonly VersionSummary[]): VersionListResponse {
    return versions.map((version) => this.version(version));
  }

  workflow(workflow: WorkflowSummary): WorkflowResponse {
    const lastRun = this.#lastRunOf(workflow.lastRun);
    const schedule = this.#scheduleOf(workflow.schedule);
    return {
      namespace: workflow.namespace,
      name: workflow.name,
      title: workflow.title,
      status: workflow.status,
      on: workflow.on,
      currentVersion: workflow.currentVersion,
      schedule,
      starts: workflow.starts,
      lastRun,
    };
  }

  page(page: WorkflowPage): WorkflowPageResponse {
    const items = page.items.map((summary) => this.workflow(summary));
    const next = page.next === null ? null : WorkflowCursor.encode(page.next);
    return { items, next };
  }

  expectedStarts(expected: readonly ExpectedStarts[]): ExpectedStartsResponse {
    return expected.map((workflow) => ({
      namespace: workflow.namespace,
      name: workflow.name,
      schedule: this.#scheduleOf(workflow.schedule),
      next: workflow.next.map((at) => at.toISOString()),
      missed: workflow.missed,
      missedSince: workflow.missedSince.toISOString(),
    }));
  }

  #scheduleOf(schedule: Schedule | null): WorkflowResponse["schedule"] {
    if (schedule?.kind !== ScheduleKind.On) return schedule;

    return { kind: schedule.kind, types: schedule.types.slice() };
  }

  #lastRunOf(lastRun: LastRun | null): WorkflowResponse["lastRun"] {
    if (lastRun === null) return null;

    return {
      id: lastRun.id,
      phase: lastRun.phase,
      createdAt: lastRun.createdAt.toISOString(),
    };
  }
}
