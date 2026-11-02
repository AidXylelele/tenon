import type { WorkflowName } from './workflow-name.js';

// The platform owns the sources of its lifecycle events, so no emitted event can stand in for one;
// other sources under `/workflows/` stay the author's.
export class LifecycleSource {
  static readonly #PREFIX = '/workflows/';
  static readonly #SHAPE = /^\/workflows\/[^/]+\/[^/]+\/instances\/[^/]+$/;

  static of(workflow: WorkflowName, instanceId: string): string {
    return `${LifecycleSource.#PREFIX}${workflow.namespace}/${workflow.name}/instances/${instanceId}`;
  }

  static claims(source: string): boolean {
    return LifecycleSource.#SHAPE.test(source);
  }
}
