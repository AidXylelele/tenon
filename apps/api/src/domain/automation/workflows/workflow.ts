import { randomUUID } from 'node:crypto';
import type { WorkflowName } from '../language/workflow-name.js';
import type { NewWorkflowVersion, WorkflowProps } from './interfaces.js';
import { WorkflowVersion } from './workflow-version.js';

export class Workflow {
  readonly #id: string;
  readonly #name: WorkflowName;
  readonly #isOn: boolean;
  readonly #version: number;
  #currentVersionId: string | null;

  constructor(props: WorkflowProps) {
    this.#id = props.id;
    this.#name = props.name;
    this.#isOn = props.isOn;
    this.#currentVersionId = props.currentVersionId;
    this.#version = props.version;
  }

  static register(name: WorkflowName): Workflow {
    const id = randomUUID();
    return new Workflow({
      id,
      name,
      isOn: false,
      currentVersionId: null,
      version: 0,
    });
  }

  get id(): string {
    return this.#id;
  }

  get name(): WorkflowName {
    return this.#name;
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

  publish(input: NewWorkflowVersion): WorkflowVersion {
    const definition = input.definition;
    const own = definition.workflow.equals(this.#name);

    if (!own) throw new TypeError('The definition belongs to another workflow');

    const id = randomUUID();
    const version = new WorkflowVersion({
      id,
      workflowId: this.#id,
      semver: definition.version,
      dslVersion: definition.dslVersion,
      source: input.source,
      publisherId: input.publisherId,
      publishedAt: input.now,
    });
    this.#currentVersionId = version.id;
    return version;
  }
}
