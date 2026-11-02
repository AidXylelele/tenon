import { CursorMapper } from '../mappers/cursor.mapper.js';
import type {
  ErrorView,
  EventPage,
  EventView,
  InstancePage,
  InstanceSummary,
  InstanceView,
  TaskRecord,
  TaskRecordPage,
} from '../../../application/automation/instances/queries.js';
import type { WorkflowInstance } from '../../../domain/automation/instances/workflow-instance.js';
import type { JsonValue } from '../../../domain/automation/language/interfaces.js';
import type {
  CloudEventPageResponse,
  CloudEventResponse,
  InstancePageResponse,
  InstanceResponse,
  InstanceSummaryResponse,
  TaskRecordPageResponse,
  TaskRecordResponse,
} from '../schemas/instance.schemas.js';

type Phase = InstanceSummaryResponse['phase'];

export class InstancePresenter {
  private static readonly SKIPPED = 'skipped';
  private static readonly SPEC_VERSION = '1.0';
  private static readonly MAXIMUM_EVENT_BYTES = 64 * 1024;
  private static readonly OUTPUT = 'output';

  static started(instance: WorkflowInstance): InstanceSummaryResponse {
    return {
      id: instance.id,
      namespace: instance.workflow.namespace,
      name: instance.workflow.name,
      version: instance.semver,
      phase: instance.phase.name as Phase,
      startedAt: instance.startedAt.toISOString(),
      endedAt: instance.endedAt?.toISOString() ?? null,
    };
  }

  static summary(instance: InstanceSummary): InstanceSummaryResponse {
    return {
      id: instance.id,
      namespace: instance.namespace,
      name: instance.name,
      version: instance.version,
      phase: instance.phase as Phase,
      startedAt: instance.startedAt.toISOString(),
      endedAt: instance.endedAt?.toISOString() ?? null,
    };
  }

  static page(page: InstancePage): InstancePageResponse {
    const items = page.items.map((item) => InstancePresenter.summary(item));
    const next = CursorMapper.fromInstancePosition(page.next);
    return { items, next };
  }

  static instance(instance: InstanceView): InstanceResponse {
    const summary = InstancePresenter.summary(instance);
    const error = InstancePresenter.error(instance.error);
    return {
      id: summary.id,
      namespace: summary.namespace,
      name: summary.name,
      version: summary.version,
      phase: summary.phase,
      startedAt: summary.startedAt,
      endedAt: summary.endedAt,
      parentId: instance.parentId,
      input: instance.input,
      output: instance.output,
      error,
    };
  }

  static task(task: TaskRecord): TaskRecordResponse {
    const status = (task.phase ?? InstancePresenter.SKIPPED) as
      Phase | 'skipped';
    const error = InstancePresenter.error(task.error);
    return {
      id: task.id,
      reference: task.reference,
      name: task.name,
      status,
      parentId: task.parentId,
      input: task.input,
      output: task.output,
      error,
      retries: task.retries,
      startedAt: task.startedAt.toISOString(),
      endedAt: task.endedAt?.toISOString() ?? null,
    };
  }

  static tasks(page: TaskRecordPage): TaskRecordPageResponse {
    const items = page.items.map((task) => InstancePresenter.task(task));
    const next = CursorMapper.fromPosition(page.next);
    return { items, next };
  }

  static event(event: EventView): CloudEventResponse {
    const complete = InstancePresenter.cloudEvent(event, event.data);
    const text = JSON.stringify(complete);
    const size = Buffer.byteLength(text, 'utf8');

    if (size <= InstancePresenter.MAXIMUM_EVENT_BYTES) return complete;

    const data = InstancePresenter.withoutOutput(event.data);
    return InstancePresenter.cloudEvent(event, data);
  }

  static events(page: EventPage): CloudEventPageResponse {
    const items = page.items.map((event) => InstancePresenter.event(event));
    const next = CursorMapper.fromPosition(page.next);
    return { items, next };
  }

  private static cloudEvent(
    event: EventView,
    data: JsonValue,
  ): CloudEventResponse {
    const cloudEvent: Record<string, JsonValue> = {};

    for (const name of Object.keys(event.extensions)) {
      const value = event.extensions[name];

      if (value !== undefined) cloudEvent[name] = value;
    }

    if (event.subject !== null) cloudEvent.subject = event.subject;

    if (event.dataContentType !== null)
      cloudEvent.datacontenttype = event.dataContentType;

    if (event.dataSchema !== null) cloudEvent.dataschema = event.dataSchema;

    cloudEvent.data = data;
    return {
      ...cloudEvent,
      specversion: InstancePresenter.SPEC_VERSION,
      id: event.id,
      source: event.source,
      type: event.type,
      time: event.time.toISOString(),
    };
  }

  // A lifecycle event that would outgrow 64 KiB leaves its output out; the task records keep it.
  private static withoutOutput(data: JsonValue): JsonValue {
    const object =
      typeof data === 'object' && data !== null && !Array.isArray(data);

    if (!object) return data;

    const kept: Record<string, JsonValue> = {};

    for (const name of Object.keys(data)) {
      const value = data[name];

      if (name !== InstancePresenter.OUTPUT && value !== undefined)
        kept[name] = value;
    }

    return kept;
  }

  private static error(error: ErrorView | null): InstanceResponse['error'] {
    if (error === null) return null;

    const view: NonNullable<InstanceResponse['error']> = {
      type: error.type,
      status: error.status,
      instance: error.instance,
    };

    if (error.title !== null) view.title = error.title;

    if (error.detail !== null) view.detail = error.detail;

    return view;
  }
}
