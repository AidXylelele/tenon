import { randomUUID } from 'node:crypto';
import { WorkflowName } from '../language/workflow-name.js';
import type { WorkflowProps } from './interfaces.js';
import type { WorkflowVersion } from './workflow-version.js';

export class Workflow {
  readonly #id: string;
  readonly #namespace: string;
  readonly #name: string;
  readonly #isOn: boolean;
  readonly #version: number;
  #currentVersionId: string | null;

  constructor(props: WorkflowProps) {
    this.#id = props.id;
    this.#namespace = props.namespace;
    this.#name = props.name;
    this.#isOn = props.isOn;
    this.#currentVersionId = props.currentVersionId;
    this.#version = props.version;
  }

  static register(name: WorkflowName): Workflow {
    const id = randomUUID();
    return new Workflow({
      id,
      namespace: name.namespace,
      name: name.name,
      isOn: false,
      currentVersionId: null,
      version: 0,
    });
  }

  get id(): string {
    return this.#id;
  }

  get namespace(): string {
    return this.#namespace;
  }

  get name(): string {
    return this.#name;
  }

  get workflowName(): WorkflowName {
    return new WorkflowName(this.#namespace, this.#name);
  }

  get isOn(): boolean {
    return this.#isOn;
  }

  get currentVersionId(): string | null {
    return this.#currentVersionId;
  }

  get version(): number {
    return this.#version;
  }

  isCurrent(version: WorkflowVersion): boolean {
    return this.#currentVersionId === version.id;
  }

  publish(version: WorkflowVersion): void {
    const own = version.workflowId === this.#id;

    if (!own) throw new TypeError('The version belongs to another workflow');

    this.#currentVersionId = version.id;
  }
}
