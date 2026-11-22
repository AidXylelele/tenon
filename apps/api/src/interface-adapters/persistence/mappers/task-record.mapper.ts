import { Injectable } from "@nestjs/common";
import { lifecycleEventCatalogue } from "interpreter";
import { TaskStatus } from "../../../application/automation/instances/enums.js";
import type { TaskRecordView } from "../../../application/automation/instances/interfaces.js";
import type {
  JsonObject,
  JsonValue,
} from "../../../domain/automation/interfaces.js";
import type {
  LifecycleEventName,
  LifecycleEventRow,
  TaskEventRow,
  TaskPosition,
  TaskValues,
} from "../interfaces.js";

@Injectable()
export class TaskRecordMapper {
  private static readonly ENDINGS: ReadonlyMap<LifecycleEventName, TaskStatus> =
    new Map([
      ["task.completed", TaskStatus.Completed],
      ["task.faulted", TaskStatus.Faulted],
      ["task.cancelled", TaskStatus.Cancelled],
    ]);
  private static readonly NO_VALUES: TaskValues = {
    input: null,
    output: null,
  };

  recordsOf(
    positions: readonly TaskPosition[],
    events: readonly TaskEventRow[],
    finish: LifecycleEventRow | null,
    retries: ReadonlyMap<string, Date>,
    values: ReadonlyMap<string, TaskValues>,
  ): TaskRecordView[] {
    const byExecution = this.#byExecution(events);
    return positions
      .map((position) => {
        const execution = position.execution;
        const own = byExecution.get(execution) ?? [];
        const retryAt = retries.get(execution) ?? null;
        const kept = values.get(execution) ?? TaskRecordMapper.NO_VALUES;
        return this.#recordOf(execution, own, finish, retryAt, kept);
      })
      .filter((record) => record !== null);
  }

  #byExecution(
    events: readonly TaskEventRow[],
  ): ReadonlyMap<string, readonly TaskEventRow[]> {
    const grouped = new Map<string, TaskEventRow[]>();

    for (const event of events) {
      const own = grouped.get(event.execution) ?? [];
      own.push(event);
      grouped.set(event.execution, own);
    }

    return grouped;
  }

  #recordOf(
    execution: string,
    events: readonly TaskEventRow[],
    finish: LifecycleEventRow | null,
    retryAt: Date | null,
    values: TaskValues,
  ): TaskRecordView | null {
    const ending =
      events.find((event) => TaskRecordMapper.ENDINGS.has(event.name)) ?? null;
    const lived = this.#livedOf(events, ending);
    const started =
      lived.find((event) => event.name === "task.started") ?? null;
    const opening = started ?? ending;
    const reference = opening?.data.task;

    if (opening === null || typeof reference !== "string") return null;

    const end = ending ?? finish;
    const endedAt = end === null ? null : this.#momentOf(end);
    const retries = lived.filter((event) => event.name === "task.retried");
    return {
      execution,
      reference,
      name: this.#nameOf(reference),
      status: this.#statusOf(started, ending, finish),
      error: this.#errorOf(end),
      startedAt: this.#momentOf(opening),
      endedAt,
      attempt: retries.length + 1,
      input: values.input,
      output: values.output,
      retryAt: endedAt === null ? retryAt : null,
    };
  }

  #livedOf(
    events: readonly TaskEventRow[],
    ending: TaskEventRow | null,
  ): readonly TaskEventRow[] {
    if (ending === null) return events;

    const last = events.indexOf(ending);
    const end = last + 1;
    return events.slice(0, end);
  }

  #statusOf(
    started: TaskEventRow | null,
    ending: TaskEventRow | null,
    finish: LifecycleEventRow | null,
  ): TaskStatus {
    if (ending === null) return this.#unendedOf(finish);

    const completed = ending.name === "task.completed";

    if (completed && started === null) return TaskStatus.Skipped;

    return TaskRecordMapper.ENDINGS.get(ending.name) ?? TaskStatus.Running;
  }

  #unendedOf(finish: LifecycleEventRow | null): TaskStatus {
    if (finish === null) return TaskStatus.Running;

    if (finish.name === "workflow.cancelled") return TaskStatus.Cancelled;

    return TaskStatus.Faulted;
  }

  #errorOf(end: LifecycleEventRow | null): JsonObject | null {
    const error = end?.data.error;
    const object = this.#isObject(error);

    if (!object) return null;

    return error;
  }

  #momentOf(event: LifecycleEventRow): Date {
    const key = lifecycleEventCatalogue[event.name].at;
    const written = event.data[key];

    if (typeof written !== "string") return event.acceptedAt;

    return new Date(written);
  }

  #nameOf(reference: string): string {
    const slash = reference.lastIndexOf("/");
    const start = slash + 1;
    const token = reference.slice(start);
    return token.replaceAll("~1", "/").replaceAll("~0", "~");
  }

  #isObject(value: JsonValue | undefined): value is JsonObject {
    const list = Array.isArray(value);
    return typeof value === "object" && value !== null && !list;
  }
}
