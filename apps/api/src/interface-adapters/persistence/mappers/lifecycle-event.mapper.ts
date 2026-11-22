import { createHash } from "node:crypto";
import { Injectable } from "@nestjs/common";
import { lifecycleEventCatalogue } from "interpreter";
import { ApiRoute } from "../../api/enums.js";
import type { LifecycleEvent } from "../../../domain/automation/instances/interfaces.js";
import type {
  InstanceNames,
  LifecycleCloudEvent,
  LifecycleEventName,
} from "../interfaces.js";

@Injectable()
export class LifecycleEventMapper {
  private static readonly TASK_COMPLETED = "task.completed";
  private static readonly INSTANCES = `${ApiRoute.Prefix}/instances`;

  readonly #apiBase: string;

  constructor(apiBaseUrl: string) {
    const rooted = apiBaseUrl.endsWith("/");
    this.#apiBase = rooted ? apiBaseUrl : `${apiBaseUrl}/`;
  }

  ofLifecycle(
    instanceId: string,
    names: InstanceNames,
    event: LifecycleEvent,
    at: Date,
    outputs: readonly string[],
  ): LifecycleCloudEvent[] {
    const claimed = this.#claimed(instanceId, event, outputs);
    return this.#events(claimed, instanceId, names, at);
  }

  #outputUriOf(instanceId: string, execution: string): string {
    const task = encodeURIComponent(execution);
    const path = `${LifecycleEventMapper.INSTANCES}/${instanceId}/tasks/${task}/output`;
    return new URL(path, this.#apiBase).href;
  }

  #claimed(
    instanceId: string,
    event: LifecycleEvent,
    outputs: readonly string[],
  ): LifecycleEvent {
    const execution = event.execution;

    if (event.name !== LifecycleEventMapper.TASK_COMPLETED) return event;

    if (execution === null) return event;

    const written = outputs.includes(execution);

    if (!written) return event;

    const outputUri = this.#outputUriOf(instanceId, execution);
    const data = { ...event.data, outputUri };
    return {
      name: event.name,
      types: event.types,
      data,
      execution,
    };
  }

  #sourceOf(instanceId: string, names: InstanceNames): string {
    return `/workflows/${names.namespace}/${names.name}/instances/${instanceId}`;
  }

  #events(
    event: LifecycleEvent,
    instanceId: string,
    names: InstanceNames,
    at: Date,
  ): LifecycleCloudEvent[] {
    const source = this.#sourceOf(instanceId, names);
    const time = at.toISOString();
    const name = this.#nameOf(event.name);
    const once = name !== null && lifecycleEventCatalogue[name].once;
    const content = once ? "" : JSON.stringify(event.data);
    const execution = event.execution ?? "";
    const data = event.data;
    return event.types.map((type, index) => {
      const id = createHash("sha256")
        .update(`${type}\n${source}\n${execution}\n${content}`)
        .digest("hex");
      const cloudEvent = {
        specversion: "1.0",
        id,
        source,
        type,
        time,
        datacontenttype: "application/json",
        data,
      };
      const lifecycle = index === 0 ? name : null;
      return { cloudEvent, lifecycle };
    });
  }

  #nameOf(name: string): LifecycleEventName | null {
    const catalogued = this.#isCatalogued(name);
    return catalogued ? name : null;
  }

  #isCatalogued(name: string): name is LifecycleEventName {
    return Object.hasOwn(lifecycleEventCatalogue, name);
  }
}
