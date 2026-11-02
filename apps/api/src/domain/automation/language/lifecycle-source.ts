import type { WorkflowName } from './workflow-name.js';

// The platform owns the sources of its lifecycle events, so no emitted event can stand in for one.
export class LifecycleSource {
  static readonly #PREFIX = '/workflows/';

  static of(workflow: WorkflowName, instanceId: string): string {
    return `${LifecycleSource.#PREFIX}${workflow.namespace}/${workflow.name}/instances/${instanceId}`;
  }

  static claims(source: string): boolean {
    return source.startsWith(LifecycleSource.#PREFIX);
  }
}
